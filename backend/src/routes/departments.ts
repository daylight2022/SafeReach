import { Hono } from 'hono';
import { eq, like, and, count, asc, or } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { departments } from '../db/schema.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  PaginationSchema,
} from '../types/index.js';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  paginatedResponse,
  serverErrorResponse,
} from '../utils/response.js';
import {
  updateDepartmentPath,
  validateDepartmentHierarchy,
  getUserAccessibleDepartments,
} from '../utils/departmentUtils.js';
import { convertDbToApi } from '../utils/fieldMapping.js';
import { z } from 'zod';

const departmentsRouter = new Hono();

// 所有部门路由都需要认证
departmentsRouter.use('*', authMiddleware);

/**
 * 获取部门列表
 * GET /departments
 */
departmentsRouter.get(
  '/',
  validateQuery(
    PaginationSchema.extend({
      search: z.string().optional(),
      parentId: z.string().uuid().optional(),
      level: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    }),
  ),
  async c => {
    try {
      const { page, limit, search, parentId, level, isActive } =
        c.get('validatedQuery');
      const currentUser = c.get('user');

      // 获取用户可访问的部门
      const accessibleDepartments = await getUserAccessibleDepartments(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      const accessibleIds = accessibleDepartments.map(dept => dept.id);

      if (accessibleIds.length === 0) {
        return paginatedResponse(c, [], 0, page, limit);
      }

      // 构建查询条件 - 使用 inArray 来匹配可访问的部门ID
      let whereClause =
        accessibleIds.length === 1
          ? eq(departments.id, accessibleIds[0])
          : or(...accessibleIds.map(id => eq(departments.id, id)));

      // 添加其他过滤条件
      const additionalConditions = [];

      if (search) {
        additionalConditions.push(
          or(
            like(departments.name, `%${search}%`),
            like(departments.code, `%${search}%`),
            like(departments.description, `%${search}%`),
          ),
        );
      }

      if (parentId !== undefined) {
        additionalConditions.push(eq(departments.parentId, parentId));
      }

      if (level !== undefined) {
        additionalConditions.push(eq(departments.level, level));
      }

      if (isActive !== undefined) {
        additionalConditions.push(eq(departments.isActive, isActive));
      }

      if (additionalConditions.length > 0) {
        whereClause = and(whereClause, ...additionalConditions);
      }

      // 获取总数
      const [{ total }] = await db
        .select({ total: count() })
        .from(departments)
        .where(whereClause);

      // 获取分页数据
      const departmentList = await db
        .select()
        .from(departments)
        .where(whereClause)
        .orderBy(
          asc(departments.level),
          asc(departments.sortOrder),
          asc(departments.name),
        )
        .limit(limit)
        .offset((page - 1) * limit);

      // 转换字段名为驼峰命名
      const convertedDepartmentList = convertDbToApi(departmentList);
      return paginatedResponse(c, convertedDepartmentList, total, page, limit);
    } catch (error) {
      console.error('获取部门列表失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 获取部门树形结构
 * GET /departments/tree
 */
departmentsRouter.get('/tree', async c => {
  try {
    const currentUser = c.get('user');

    // 获取用户可访问的部门
    const accessibleDepartments = await getUserAccessibleDepartments(
      currentUser.userId,
      currentUser.role,
      currentUser.departmentId,
    );

    // 构建树形结构
    const buildTree = (
      departments: any[],
      parentId: string | null = null,
    ): any[] => {
      return departments
        .filter(dept => dept.parentId === parentId)
        .map(dept => ({
          ...dept,
          children: buildTree(departments, dept.id),
        }))
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );
    };

    const tree = buildTree(accessibleDepartments);

    // 转换字段名为驼峰命名
    const convertedTree = convertDbToApi(tree);
    return successResponse(c, convertedTree);
  } catch (error) {
    console.error('获取部门树形结构失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取指定部门信息
 * GET /departments/:id
 */
departmentsRouter.get(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const currentUser = c.get('user');

      // 检查用户是否有权限访问该部门
      const accessibleDepartments = await getUserAccessibleDepartments(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      const hasAccess = accessibleDepartments.some(dept => dept.id === id);
      if (!hasAccess) {
        return errorResponse(c, '权限不足', 403);
      }

      const department = await db
        .select()
        .from(departments)
        .where(eq(departments.id, id))
        .limit(1);

      if (department.length === 0) {
        return notFoundResponse(c, '部门不存在');
      }

      // 转换字段名为驼峰命名
      const convertedDepartment = convertDbToApi(department[0]);
      return successResponse(c, convertedDepartment);
    } catch (error) {
      console.error('获取部门信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 创建部门
 * POST /departments
 */
departmentsRouter.post(
  '/',
  requireAdmin,
  validateBody(CreateDepartmentSchema),
  async c => {
    try {
      const departmentData = c.get('validatedBody');

      // 检查部门编码是否重复
      const existingDepartment = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.code, departmentData.code))
        .limit(1);

      if (existingDepartment.length > 0) {
        return errorResponse(c, '部门编码已存在', 409);
      }

      // 如果指定了父部门，验证父部门是否存在
      if (departmentData.parentId) {
        const parentDepartment = await db
          .select({ id: departments.id, level: departments.level })
          .from(departments)
          .where(eq(departments.id, departmentData.parentId))
          .limit(1);

        if (parentDepartment.length === 0) {
          return errorResponse(c, '父部门不存在', 400);
        }
      }

      // 创建部门 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [newDepartment] = await db
        .insert(departments)
        .values({
          ...departmentData,
          sortOrder: departmentData.sortOrder || 0,
          path: '', // 临时值，稍后更新
          level: 1, // 临时值，稍后更新
        })
        .returning();

      // 更新部门路径和层级
      await updateDepartmentPath(newDepartment.id);

      // 获取更新后的部门信息
      const [updatedDepartment] = await db
        .select()
        .from(departments)
        .where(eq(departments.id, newDepartment.id));

      // 转换返回数据为API格式
      const convertedDepartment = convertDbToApi(updatedDepartment);
      return successResponse(c, convertedDepartment, '部门创建成功');
    } catch (error) {
      console.error('创建部门失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 更新部门信息
 * PUT /departments/:id
 */
departmentsRouter.put(
  '/:id',
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateDepartmentSchema),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const departmentData = c.get('validatedBody');

      // 检查部门是否存在
      const existingDepartment = await db
        .select()
        .from(departments)
        .where(eq(departments.id, id))
        .limit(1);

      if (existingDepartment.length === 0) {
        return notFoundResponse(c, '部门不存在');
      }

      // 如果更新部门编码，检查是否重复
      if (
        departmentData.code &&
        departmentData.code !== existingDepartment[0].code
      ) {
        const duplicateDepartment = await db
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.code, departmentData.code))
          .limit(1);

        if (duplicateDepartment.length > 0) {
          return errorResponse(c, '部门编码已存在', 409);
        }
      }

      // 如果更新父部门，验证层级关系
      if (departmentData.parentId !== undefined) {
        if (departmentData.parentId) {
          const isValidHierarchy = await validateDepartmentHierarchy(
            id,
            departmentData.parentId,
          );
          if (!isValidHierarchy) {
            return errorResponse(c, '无效的部门层级关系，会形成循环引用', 400);
          }

          // 检查父部门是否存在
          const parentDepartment = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, departmentData.parentId))
            .limit(1);

          if (parentDepartment.length === 0) {
            return errorResponse(c, '父部门不存在', 400);
          }
        }
      }

      // 更新部门 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [updatedDepartment] = await db
        .update(departments)
        .set({
          ...departmentData,
          updatedAt: new Date(),
        })
        .where(eq(departments.id, id))
        .returning();

      // 如果更新了父部门或编码，需要重新计算路径
      if (departmentData.parentId !== undefined || departmentData.code) {
        await updateDepartmentPath(id);

        // 获取更新后的部门信息
        const [finalDepartment] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, id));

        // 转换返回数据为API格式
        const convertedFinalDepartment = convertDbToApi(finalDepartment);
        return successResponse(c, convertedFinalDepartment, '部门信息更新成功');
      }

      // 转换返回数据为API格式
      const convertedUpdatedDepartment = convertDbToApi(updatedDepartment);
      return successResponse(c, convertedUpdatedDepartment, '部门信息更新成功');
    } catch (error) {
      console.error('更新部门信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 删除部门
 * DELETE /departments/:id
 */
departmentsRouter.delete(
  '/:id',
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');

      // 检查部门是否存在
      const existingDepartment = await db
        .select()
        .from(departments)
        .where(eq(departments.id, id))
        .limit(1);

      if (existingDepartment.length === 0) {
        return notFoundResponse(c, '部门不存在');
      }

      // 检查是否有子部门
      const childDepartments = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.parentId, id))
        .limit(1);

      if (childDepartments.length > 0) {
        return errorResponse(c, '该部门下还有子部门，无法删除', 400);
      }

      // 检查是否有关联的用户或人员
      // 这里应该检查users和persons表，但为了简化，我们先软删除
      await db
        .update(departments)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(departments.id, id));

      return successResponse(c, null, '部门删除成功');
    } catch (error) {
      console.error('删除部门失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

export default departmentsRouter;
