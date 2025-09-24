import { Hono } from 'hono';
import { eq, and, count, desc, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { reminders, persons, users, leaves } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  CreateReminderSchema,
  UpdateReminderSchema,
  ReminderQuerySchema,
} from '../types/index.js';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
} from '../utils/response.js';
import { getUserAccessibleDepartmentIds } from '../utils/departmentUtils.js';
import { convertDbToApi } from '../utils/fieldMapping.js';
import { z } from 'zod';

const remindersRouter = new Hono();

// 所有提醒记录路由都需要认证
remindersRouter.use('*', authMiddleware);

/**
 * 获取提醒记录列表
 * GET /reminders
 */
remindersRouter.get('/', validateQuery(ReminderQuerySchema), async c => {
  try {
    const {
      page,
      limit,
      personId,
      reminderType,
      priority,
      isHandled,
      reminderDate,
    } = c.get('validatedQuery');
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
        const response = {
          success: true,
          data: {
            reminders: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          },
        };
        return c.json(response);
      }
    }

    if (personId) {
      conditions.push(eq(reminders.personId, personId));
    }

    if (reminderType) {
      conditions.push(eq(reminders.reminderType, reminderType));
    }

    if (priority) {
      conditions.push(eq(reminders.priority, priority));
    }

    if (isHandled !== undefined) {
      conditions.push(eq(reminders.isHandled, isHandled));
    }

    if (reminderDate) {
      conditions.push(eq(reminders.reminderDate, reminderDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ total }] = await db
      .select({ total: count() })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .where(whereClause);

    // 获取提醒记录列表
    const reminderList = await db
      .select({
        id: reminders.id,
        reminder_type: reminders.reminderType,
        reminder_date: reminders.reminderDate,
        priority: reminders.priority,
        is_handled: reminders.isHandled,
        handled_at: reminders.handledAt,
        created_at: reminders.createdAt,
        person: {
          id: persons.id,
          name: persons.name,
          department_id: persons.departmentId,
        },
        leave: {
          id: leaves.id,
          leave_type: leaves.leaveType,
          location: leaves.location,
        },
        handler: {
          id: users.id,
          username: users.username,
          real_name: users.realName,
        },
      })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .leftJoin(leaves, eq(reminders.leaveId, leaves.id))
      .leftJoin(users, eq(reminders.handledBy, users.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(reminders.reminderDate));

    // 转换字段名为驼峰命名
    const convertedReminderList = convertDbToApi(reminderList);

    // 返回符合前端期望的格式
    const response = {
      success: true,
      data: {
        reminders: convertedReminderList,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('获取提醒记录列表失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取指定提醒记录
 * GET /reminders/:id
 */
remindersRouter.get(
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
      const conditions = [eq(reminders.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '提醒记录不存在或无权限访问');
        }
      }

      const reminder = await db
        .select({
          id: reminders.id,
          reminder_type: reminders.reminderType,
          reminder_date: reminders.reminderDate,
          priority: reminders.priority,
          is_handled: reminders.isHandled,
          handled_at: reminders.handledAt,
          created_at: reminders.createdAt,
          person: {
            id: persons.id,
            name: persons.name,
            department_id: persons.departmentId,
          },
          leave: {
            id: leaves.id,
            leave_type: leaves.leaveType,
            location: leaves.location,
          },
          handler: {
            id: users.id,
            username: users.username,
            real_name: users.realName,
          },
        })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .leftJoin(leaves, eq(reminders.leaveId, leaves.id))
        .leftJoin(users, eq(reminders.handledBy, users.id))
        .where(and(...conditions))
        .limit(1);

      if (reminder.length === 0) {
        return notFoundResponse(c, '提醒记录不存在或无权限访问');
      }

      // 转换字段名为驼峰命名
      const convertedReminder = convertDbToApi(reminder[0]);
      return successResponse(c, convertedReminder);
    } catch (error) {
      console.error('获取提醒记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 创建提醒记录
 * POST /reminders
 */
remindersRouter.post('/', validateBody(CreateReminderSchema), async c => {
  try {
    const reminderData = c.get('validatedBody');
    const currentUser = c.get('user');

    // 如果指定了人员，检查是否存在且有权限访问
    if (reminderData.personId) {
      const person = await db
        .select({ id: persons.id, departmentId: persons.departmentId })
        .from(persons)
        .where(eq(persons.id, reminderData.personId))
        .limit(1);

      if (person.length === 0) {
        return notFoundResponse(c, '人员不存在');
      }

      // 检查权限
      if (
        currentUser.role !== 'admin' &&
        person[0].departmentId !== currentUser.departmentId
      ) {
        return errorResponse(c, '权限不足', 403);
      }
    }

    // 如果指定了休假记录，检查是否存在
    if (reminderData.leaveId) {
      const leave = await db
        .select({ id: leaves.id })
        .from(leaves)
        .where(eq(leaves.id, reminderData.leaveId))
        .limit(1);

      if (leave.length === 0) {
        return notFoundResponse(c, '休假记录不存在');
      }
    }

    // 创建提醒记录 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
    const [newReminder] = await db
      .insert(reminders)
      .values(reminderData)
      .returning();

    // 转换返回数据为API格式
    const convertedReminder = convertDbToApi(newReminder);
    return successResponse(c, convertedReminder, '提醒记录创建成功');
  } catch (error) {
    console.error('创建提醒记录失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 更新提醒记录
 * PUT /reminders/:id
 */
remindersRouter.put(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateReminderSchema),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const reminderData = c.get('validatedBody');
      const currentUser = c.get('user');

      // 获取用户可访问的部门ID列表
      const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      // 构建查询条件
      const conditions = [eq(reminders.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '提醒记录不存在或无权限访问');
        }
      }

      // 检查提醒记录是否存在且有权限访问
      const existingReminder = await db
        .select({ id: reminders.id })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(and(...conditions))
        .limit(1);

      if (existingReminder.length === 0) {
        return notFoundResponse(c, '提醒记录不存在或无权限访问');
      }

      // 更新提醒记录 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [updatedReminder] = await db
        .update(reminders)
        .set(reminderData)
        .where(eq(reminders.id, id))
        .returning();

      // 转换返回数据为API格式
      const convertedReminder = convertDbToApi(updatedReminder);
      return successResponse(c, convertedReminder, '提醒记录更新成功');
    } catch (error) {
      console.error('更新提醒记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 标记提醒为已处理
 * POST /reminders/:id/handle
 */
remindersRouter.post(
  '/:id/handle',
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
      const conditions = [eq(reminders.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '提醒记录不存在或无权限访问');
        }
      }

      // 检查提醒记录是否存在且有权限访问
      const existingReminder = await db
        .select({ id: reminders.id, isHandled: reminders.isHandled })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(and(...conditions))
        .limit(1);

      if (existingReminder.length === 0) {
        return notFoundResponse(c, '提醒记录不存在或无权限访问');
      }

      if (existingReminder[0].isHandled) {
        return errorResponse(c, '提醒已经被处理', 400);
      }

      // 标记为已处理
      const [updatedReminder] = await db
        .update(reminders)
        .set({
          isHandled: true,
          handledBy: currentUser.userId,
          handledAt: new Date(),
        })
        .where(eq(reminders.id, id))
        .returning();

      return successResponse(c, updatedReminder, '提醒标记为已处理');
    } catch (error) {
      console.error('处理提醒失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 删除提醒记录
 * DELETE /reminders/:id
 */
remindersRouter.delete(
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
      const conditions = [eq(reminders.id, id)];

      // 根据用户权限过滤数据
      if (currentUser.role !== 'admin') {
        if (accessibleDepartmentIds.length > 0) {
          conditions.push(
            inArray(persons.departmentId, accessibleDepartmentIds),
          );
        } else {
          return notFoundResponse(c, '提醒记录不存在或无权限访问');
        }
      }

      // 检查提醒记录是否存在且有权限访问
      const existingReminder = await db
        .select({ id: reminders.id })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(and(...conditions))
        .limit(1);

      if (existingReminder.length === 0) {
        return notFoundResponse(c, '提醒记录不存在或无权限访问');
      }

      // 删除提醒记录
      await db.delete(reminders).where(eq(reminders.id, id));

      return successResponse(c, null, '提醒记录删除成功');
    } catch (error) {
      console.error('删除提醒记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

export default remindersRouter;
