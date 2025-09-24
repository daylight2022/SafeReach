import { Hono } from 'hono';
import { eq, and, count, desc, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { leaves, persons, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  CreateLeaveSchema,
  UpdateLeaveSchema,
  LeaveQuerySchema,
} from '../types/index.js';
import {
  successResponse,
  notFoundResponse,
  paginatedResponse,
  serverErrorResponse,
} from '../utils/response.js';
import { getUserAccessibleDepartmentIds } from '../utils/departmentUtils.js';
import { convertDbToApi } from '../utils/fieldMapping.js';
import { z } from 'zod';

const leavesRouter = new Hono();

// 所有休假路由都需要认证
leavesRouter.use('*', authMiddleware);

/**
 * 获取休假记录列表
 * GET /leaves
 */
leavesRouter.get('/', validateQuery(LeaveQuerySchema), async c => {
  try {
    const { page, limit, personId, leaveType, status, startDate, endDate } =
      c.get('validatedQuery');
    const currentUser = c.get('user');
    const offset = (page - 1) * limit;

    // 获取用户可访问的部门ID列表
    const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
      currentUser.userId,
      currentUser.role,
      currentUser.departmentId,
    );

    // 构建查询条件
    const conditions = [];

    // 根据用户权限过滤数据
    if (currentUser.role !== 'admin') {
      if (accessibleDepartmentIds.length > 0) {
        conditions.push(inArray(persons.departmentId, accessibleDepartmentIds));
      } else {
        // 如果用户没有可访问的部门，返回空结果
        return paginatedResponse(c, [], 0, page, limit);
      }
    }

    if (personId) {
      conditions.push(eq(leaves.personId, personId));
    }

    if (leaveType) {
      conditions.push(eq(leaves.leaveType, leaveType));
    }

    if (status) {
      conditions.push(eq(leaves.status, status));
    }

    if (startDate) {
      conditions.push(gte(leaves.startDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(leaves.endDate, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ total }] = await db
      .select({ total: count() })
      .from(leaves)
      .leftJoin(persons, eq(leaves.personId, persons.id))
      .where(whereClause);

    // 获取休假记录列表
    const leaveList = await db
      .select({
        id: leaves.id,
        person_id: leaves.personId,
        leave_type: leaves.leaveType,
        location: leaves.location,
        start_date: leaves.startDate,
        end_date: leaves.endDate,
        days: leaves.days,
        status: leaves.status,
        created_at: leaves.createdAt,
        person: {
          id: persons.id,
          name: persons.name,
          department_id: persons.departmentId,
        },
        creator: {
          id: users.id,
          username: users.username,
          real_name: users.realName,
        },
      })
      .from(leaves)
      .leftJoin(persons, eq(leaves.personId, persons.id))
      .leftJoin(users, eq(leaves.createdBy, users.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(leaves.createdAt));

    // 转换字段名为驼峰命名
    const convertedLeaveList = convertDbToApi(leaveList);
    return paginatedResponse(c, convertedLeaveList, total, page, limit);
  } catch (error) {
    console.error('获取休假记录列表失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取指定休假记录
 * GET /leaves/:id
 */
leavesRouter.get(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const currentUser = c.get('user');

      // 获取用户可访问的部门ID列表
      const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      // 构建查询条件
      const conditions = [eq(leaves.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '休假记录不存在或无权限访问');
        }
      }

      const leave = await db
        .select({
          id: leaves.id,
          person_id: leaves.personId,
          leave_type: leaves.leaveType,
          location: leaves.location,
          start_date: leaves.startDate,
          end_date: leaves.endDate,
          days: leaves.days,
          status: leaves.status,
          created_at: leaves.createdAt,
          person: {
            id: persons.id,
            name: persons.name,
            department_id: persons.departmentId,
          },
          creator: {
            id: users.id,
            username: users.username,
            real_name: users.realName,
          },
        })
        .from(leaves)
        .leftJoin(persons, eq(leaves.personId, persons.id))
        .leftJoin(users, eq(leaves.createdBy, users.id))
        .where(and(...conditions))
        .limit(1);

      if (leave.length === 0) {
        return notFoundResponse(c, '休假记录不存在或无权限访问');
      }

      // 转换字段名为驼峰命名
      const convertedLeave = convertDbToApi(leave[0]);
      return successResponse(c, convertedLeave);
    } catch (error) {
      console.error('获取休假记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 创建休假记录
 * POST /leaves
 */
leavesRouter.post('/', validateBody(CreateLeaveSchema), async c => {
  try {
    const leaveData = c.get('validatedBody');
    const currentUser = c.get('user');

    // 获取用户可访问的部门ID列表
    const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
      currentUser.userId,
      currentUser.role,
      currentUser.departmentId,
    );

    // 检查人员是否存在且有权限访问
    const person = await db
      .select({ id: persons.id, departmentId: persons.departmentId })
      .from(persons)
      .where(
        and(
          eq(persons.id, leaveData.personId),
          currentUser.role === 'admin' || accessibleDepartmentIds.length === 0
            ? undefined
            : inArray(persons.departmentId, accessibleDepartmentIds),
        ),
      )
      .limit(1);

    if (person.length === 0) {
      return notFoundResponse(c, '人员不存在或无权限访问');
    }

    // 创建休假记录 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
    const [newLeave] = await db
      .insert(leaves)
      .values({
        ...leaveData,
        createdBy: currentUser.userId,
      })
      .returning();

    // 转换返回数据为API格式
    const convertedLeave = convertDbToApi(newLeave);
    return successResponse(c, convertedLeave, '休假记录创建成功');
  } catch (error) {
    console.error('创建休假记录失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 更新休假记录
 * PUT /leaves/:id
 */
leavesRouter.put(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateLeaveSchema),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const leaveData = c.get('validatedBody');
      const currentUser = c.get('user');

      // 获取用户可访问的部门ID列表
      const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      // 构建查询条件
      const conditions = [eq(leaves.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '休假记录不存在或无权限访问');
        }
      }

      // 检查休假记录是否存在且有权限访问
      const existingLeave = await db
        .select({ id: leaves.id })
        .from(leaves)
        .leftJoin(persons, eq(leaves.personId, persons.id))
        .where(and(...conditions))
        .limit(1);

      if (existingLeave.length === 0) {
        return notFoundResponse(c, '休假记录不存在或无权限访问');
      }

      // 更新休假记录 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [updatedLeave] = await db
        .update(leaves)
        .set(leaveData)
        .where(eq(leaves.id, id))
        .returning();

      // 转换返回数据为API格式
      const convertedLeave = convertDbToApi(updatedLeave);
      return successResponse(c, convertedLeave, '休假记录更新成功');
    } catch (error) {
      console.error('更新休假记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 删除休假记录
 * DELETE /leaves/:id
 */
leavesRouter.delete(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const currentUser = c.get('user');

      // 获取用户可访问的部门ID列表
      const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      // 构建查询条件
      const conditions = [eq(leaves.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '休假记录不存在或无权限访问');
        }
      }

      // 检查休假记录是否存在且有权限访问
      const existingLeave = await db
        .select({ id: leaves.id })
        .from(leaves)
        .leftJoin(persons, eq(leaves.personId, persons.id))
        .where(and(...conditions))
        .limit(1);

      if (existingLeave.length === 0) {
        return notFoundResponse(c, '休假记录不存在或无权限访问');
      }

      // 删除休假记录
      await db.delete(leaves).where(eq(leaves.id, id));

      return successResponse(c, null, '休假记录删除成功');
    } catch (error) {
      console.error('删除休假记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

export default leavesRouter;
