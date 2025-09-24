import { Hono } from 'hono';
import { eq, like, and, count } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  PaginationSchema,
} from '../types/index.js';
import { hashPassword } from '../utils/password.js';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  paginatedResponse,
  serverErrorResponse,
} from '../utils/response.js';
import { convertDbToApi } from '../utils/fieldMapping.js';
import { z } from 'zod';

const usersRouter = new Hono();

// 所有用户路由都需要认证
usersRouter.use('*', authMiddleware);

/**
 * 获取用户列表
 * GET /users
 */
usersRouter.get(
  '/',
  requireAdmin,
  validateQuery(
    PaginationSchema.extend({
      search: z.string().optional(),
      role: z.enum(['admin', 'operator', 'liaison']).optional(),
      department: z.string().optional(),
    }),
  ),
  async c => {
    try {
      const { page, limit, search, role, department } = c.get('validatedQuery');
      const offset = (page - 1) * limit;

      // 构建查询条件
      const conditions = [];
      if (search) {
        conditions.push(
          like(users.username, `%${search}%`),
          like(users.realName, `%${search}%`),
        );
      }
      if (role) {
        conditions.push(eq(users.role, role));
      }
      if (department) {
        conditions.push(eq(users.departmentId, department));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // 获取总数
      const [{ total }] = await db
        .select({ total: count() })
        .from(users)
        .where(whereClause);

      // 获取用户列表
      const userList = await db
        .select({
          id: users.id,
          username: users.username,
          real_name: users.realName,
          role: users.role,
          department_id: users.departmentId,
          phone: users.phone,
          created_at: users.createdAt,
          updated_at: users.updatedAt,
        })
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt);

      // 转换字段名为驼峰命名
      const convertedUserList = convertDbToApi(userList);
      return paginatedResponse(c, convertedUserList, total, page, limit);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 获取当前用户信息
 * GET /users/me
 */
usersRouter.get('/me', async c => {
  try {
    const currentUser = c.get('user');

    const user = await db
      .select({
        id: users.id,
        username: users.username,
        real_name: users.realName,
        role: users.role,
        department_id: users.departmentId,
        phone: users.phone,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, currentUser.userId))
      .limit(1);

    if (user.length === 0) {
      return notFoundResponse(c, '用户不存在');
    }

    // 转换字段名为驼峰命名
    const convertedUser = convertDbToApi(user[0]);
    return successResponse(c, convertedUser);
  } catch (error) {
    console.error('获取当前用户信息失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取指定用户信息
 * GET /users/:id
 */
usersRouter.get(
  '/:id',
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');

      const user = await db
        .select({
          id: users.id,
          username: users.username,
          real_name: users.realName,
          role: users.role,
          department_id: users.departmentId,
          phone: users.phone,
          created_at: users.createdAt,
          updated_at: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (user.length === 0) {
        return notFoundResponse(c, '用户不存在');
      }

      // 转换字段名为驼峰命名
      const convertedUser = convertDbToApi(user[0]);
      return successResponse(c, convertedUser);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 创建用户
 * POST /users
 */
usersRouter.post('/', requireAdmin, validateBody(CreateUserSchema), async c => {
  try {
    const userData = c.get('validatedBody');

    // 检查用户名是否已存在
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, userData.username))
      .limit(1);

    if (existingUser.length > 0) {
      return errorResponse(c, '用户名已存在', 409);
    }

    // 加密密码
    const hashedPassword = hashPassword(userData.password);

    // 创建用户 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning({
        id: users.id,
        username: users.username,
        real_name: users.realName,
        role: users.role,
        department_id: users.departmentId,
        phone: users.phone,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
      });

    // 转换返回数据为API格式
    const convertedUser = convertDbToApi(newUser);
    return successResponse(c, convertedUser, '用户创建成功');
  } catch (error) {
    console.error('创建用户失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 更新用户信息
 * PUT /users/:id
 */
usersRouter.put(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateUserSchema),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const userData = c.get('validatedBody');
      const currentUser = c.get('user');

      // 检查权限：只有管理员可以修改其他用户，用户只能修改自己
      if (currentUser.role !== 'admin' && currentUser.userId !== id) {
        return errorResponse(c, '权限不足', 403);
      }

      // 检查用户是否存在
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (existingUser.length === 0) {
        return notFoundResponse(c, '用户不存在');
      }

      // 如果更新用户名，检查是否重复
      if (userData.username) {
        const duplicateUser = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, userData.username), eq(users.id, id)))
          .limit(1);

        if (duplicateUser.length > 0) {
          return errorResponse(c, '用户名已存在', 409);
        }
      }

      // 更新用户 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [updatedUser] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          real_name: users.realName,
          role: users.role,
          department_id: users.departmentId,
          phone: users.phone,
          created_at: users.createdAt,
          updated_at: users.updatedAt,
        });

      // 转换返回数据为API格式
      const convertedUser = convertDbToApi(updatedUser);
      return successResponse(c, convertedUser, '用户信息更新成功');
    } catch (error) {
      console.error('更新用户信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 删除用户
 * DELETE /users/:id
 */
usersRouter.delete(
  '/:id',
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');

      // 检查用户是否存在
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (existingUser.length === 0) {
        return notFoundResponse(c, '用户不存在');
      }

      // 删除用户
      await db.delete(users).where(eq(users.id, id));

      return successResponse(c, null, '用户删除成功');
    } catch (error) {
      console.error('删除用户失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

export default usersRouter;
