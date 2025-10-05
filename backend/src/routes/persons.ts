import { Hono } from 'hono';
import {
  eq,
  like,
  and,
  count,
  desc,
  asc,
  or,
  gte,
  inArray,
  isNotNull,
} from 'drizzle-orm';
import { db } from '../db/connection.js';
import { persons, users, leaves, contacts, departments, reminders } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  CreatePersonSchema,
  UpdatePersonSchema,
  PersonQuerySchema,
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

const personsRouter = new Hono();

// 所有人员路由都需要认证
personsRouter.use('*', authMiddleware);

/**
 * 获取人员列表
 * GET /persons
 */
personsRouter.get('/', validateQuery(PersonQuerySchema), async c => {
  try {
    const { page, limit, search, department, personType, sortBy, sortOrder } =
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
    if (accessibleDepartmentIds.length > 0) {
      conditions.push(
        and(
          isNotNull(persons.departmentId),
          inArray(persons.departmentId, accessibleDepartmentIds),
        ),
      );
    } else {
      // 如果用户没有可访问的部门，返回空结果
      return successResponse(c, {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    if (search) {
      conditions.push(
        or(
          like(persons.name, `%${search}%`),
          like(persons.phone, `%${search}%`),
          like(persons.emergencyContact, `%${search}%`),
        ),
      );
    }

    if (department) {
      conditions.push(eq(persons.departmentId, department));
    }

    if (personType) {
      conditions.push(eq(persons.personType, personType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 排序
    const orderBy = sortOrder === 'asc' ? asc : desc;
    let orderColumn;
    switch (sortBy) {
      case 'name':
        orderColumn = persons.name;
        break;
      case 'lastContactDate':
        orderColumn = persons.lastContactDate;
        break;
      default:
        orderColumn = persons.createdAt;
    }

    // 获取当前日期
    const currentDate = new Date().toISOString().split('T')[0];

    // 构建子查询：只选择有活跃休假的人员
    const personsWithActiveLeaves = db
      .selectDistinct({ personId: leaves.personId })
      .from(leaves)
      .where(
        and(
          eq(leaves.status, 'active'),
          gte(leaves.endDate, currentDate),
        ),
      );

    // 获取总数（只包含有活跃休假的人员）
    const [{ total }] = await db
      .select({ total: count() })
      .from(persons)
      .where(
        whereClause
          ? and(
              whereClause,
              inArray(persons.id, personsWithActiveLeaves),
            )
          : inArray(persons.id, personsWithActiveLeaves),
      );

    // 获取人员列表（只包含有活跃休假的人员，包含创建者信息）
    const personList = await db
      .select({
        id: persons.id,
        name: persons.name,
        phone: persons.phone,
        emergency_contact: persons.emergencyContact,
        emergency_phone: persons.emergencyPhone,
        department_id: persons.departmentId,
        person_type: persons.personType,
        annual_leave_total: persons.annualLeaveTotal,
        annual_leave_used: persons.annualLeaveUsed,
        annual_leave_times: persons.annualLeaveTimes,
        notes: persons.notes,
        last_contact_date: persons.lastContactDate,
        created_at: persons.createdAt,
        updated_at: persons.updatedAt,
        creator: {
          id: users.id,
          username: users.username,
          real_name: users.realName,
        },
        department: {
          id: departments.id,
          name: departments.name,
          code: departments.code,
        },
      })
      .from(persons)
      .leftJoin(users, eq(persons.createdBy, users.id))
      .leftJoin(departments, eq(persons.departmentId, departments.id))
      .where(
        whereClause
          ? and(
              whereClause,
              inArray(persons.id, personsWithActiveLeaves),
            )
          : inArray(persons.id, personsWithActiveLeaves),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy(orderColumn));

    // 为每个人员获取当前活跃的休假、最后联系记录和当前提醒状态
    const enrichedPersonList = await Promise.all(
      personList.map(async person => {
        // 获取当前活跃的休假（包括即将开始和进行中的休假）
        const [currentLeave] = await db
          .select({
            id: leaves.id,
            leave_type: leaves.leaveType,
            location: leaves.location,
            start_date: leaves.startDate,
            end_date: leaves.endDate,
            days: leaves.days,
            status: leaves.status,
          })
          .from(leaves)
          .where(
            and(
              eq(leaves.personId, person.id),
              eq(leaves.status, 'active'),
              gte(leaves.endDate, currentDate), // 未结束的休假
            ),
          )
          .orderBy(desc(leaves.startDate)) // 按开始日期降序，优先显示最近的
          .limit(1);

        // 获取最后一次联系记录
        const [lastContact] = await db
          .select({
            id: contacts.id,
            contact_date: contacts.contactDate,
            contact_by: contacts.contactBy,
            contact_method: contacts.contactMethod,
            notes: contacts.notes,
          })
          .from(contacts)
          .where(eq(contacts.personId, person.id))
          .orderBy(desc(contacts.contactDate))
          .limit(1);

        // 获取当前未处理的提醒记录（用于确定人员状态）
        const [currentReminder] = await db
          .select({
            id: reminders.id,
            reminder_type: reminders.reminderType,
            reminder_date: reminders.reminderDate,
            priority: reminders.priority,
            is_handled: reminders.isHandled,
          })
          .from(reminders)
          .where(
            and(
              eq(reminders.personId, person.id),
              eq(reminders.isHandled, false),
            ),
          )
          .orderBy(desc(reminders.reminderDate))
          .limit(1);

        // 根据提醒记录的 priority 确定人员状态
        let status = 'inactive';
        if (currentLeave) {
          if (currentReminder) {
            // 根据提醒优先级确定状态
            switch (currentReminder.priority) {
              case 'high':
                status = 'urgent';
                break;
              case 'medium':
                status = 'suggest';
                break;
              case 'low':
                status = 'normal';
                break;
              default:
                status = 'normal';
            }
          } else {
            // 有活跃休假但没有提醒记录，说明联系正常
            status = 'normal';
          }
        }

        return {
          ...person,
          current_leave: currentLeave || null,
          last_contact: lastContact || null,
          current_reminder: currentReminder || null,
          status: status,
        };
      }),
    );

    // 转换字段名为驼峰命名
    const convertedPersonList = convertDbToApi(enrichedPersonList);

    return successResponse(c, {
      persons: convertedPersonList,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('获取人员列表失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取指定人员信息
 * GET /persons/:id
 */
personsRouter.get(
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

      // 获取当前日期
      const currentDate = new Date().toISOString().split('T')[0];

      // 检查该人员是否有活跃休假
      const [activeLeave] = await db
        .select({ id: leaves.id })
        .from(leaves)
        .where(
          and(
            eq(leaves.personId, id),
            eq(leaves.status, 'active'),
            gte(leaves.endDate, currentDate),
          ),
        )
        .limit(1);

      // 如果没有活跃休假，返回人员不存在（因为只显示在外人员）
      if (!activeLeave) {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      // 构建查询条件
      const conditions = [eq(persons.id, id)];

      // 根据用户权限过滤数据
      if (accessibleDepartmentIds.length > 0) {
        conditions.push(inArray(persons.departmentId, accessibleDepartmentIds));
      } else {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      const person = await db
        .select({
          id: persons.id,
          name: persons.name,
          phone: persons.phone,
          emergency_contact: persons.emergencyContact,
          emergency_phone: persons.emergencyPhone,
          department_id: persons.departmentId,
          person_type: persons.personType,
          annual_leave_total: persons.annualLeaveTotal,
          annual_leave_used: persons.annualLeaveUsed,
          annual_leave_times: persons.annualLeaveTimes,
          notes: persons.notes,
          last_contact_date: persons.lastContactDate,
          created_at: persons.createdAt,
          updated_at: persons.updatedAt,
          creator: {
            id: users.id,
            username: users.username,
            real_name: users.realName,
          },
          department: {
            id: departments.id,
            name: departments.name,
            code: departments.code,
          },
        })
        .from(persons)
        .leftJoin(users, eq(persons.createdBy, users.id))
        .leftJoin(departments, eq(persons.departmentId, departments.id))
        .where(and(...conditions))
        .limit(1);

      if (person.length === 0) {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      // 获取当前活跃的休假
      const [currentLeave] = await db
        .select({
          id: leaves.id,
          leave_type: leaves.leaveType,
          location: leaves.location,
          start_date: leaves.startDate,
          end_date: leaves.endDate,
          days: leaves.days,
          status: leaves.status,
        })
        .from(leaves)
        .where(
          and(
            eq(leaves.personId, id),
            eq(leaves.status, 'active'),
            gte(leaves.endDate, currentDate),
          ),
        )
        .orderBy(desc(leaves.startDate))
        .limit(1);

      // 获取最后一次联系记录
      const [lastContact] = await db
        .select({
          id: contacts.id,
          contact_date: contacts.contactDate,
          contact_by: contacts.contactBy,
          contact_method: contacts.contactMethod,
          notes: contacts.notes,
        })
        .from(contacts)
        .where(eq(contacts.personId, id))
        .orderBy(desc(contacts.contactDate))
        .limit(1);

      // 获取当前未处理的提醒记录
      const [currentReminder] = await db
        .select({
          id: reminders.id,
          reminder_type: reminders.reminderType,
          reminder_date: reminders.reminderDate,
          priority: reminders.priority,
          is_handled: reminders.isHandled,
        })
        .from(reminders)
        .where(
          and(
            eq(reminders.personId, id),
            eq(reminders.isHandled, false),
          ),
        )
        .orderBy(desc(reminders.reminderDate))
        .limit(1);

      // 根据提醒记录的 priority 确定人员状态
      let status = 'inactive';
      if (currentLeave) {
        if (currentReminder) {
          // 根据提醒优先级确定状态
          switch (currentReminder.priority) {
            case 'high':
              status = 'urgent';
              break;
            case 'medium':
              status = 'suggest';
              break;
            case 'low':
              status = 'normal';
              break;
            default:
              status = 'normal';
          }
        } else {
          // 有活跃休假但没有提醒记录，说明联系正常
          status = 'normal';
        }
      }

      // 构建包含额外信息的人员数据
      const enrichedPerson = {
        ...person[0],
        current_leave: currentLeave || null,
        last_contact: lastContact || null,
        current_reminder: currentReminder || null,
        status: status,
      };

      // 转换字段名为驼峰命名
      const convertedPerson = convertDbToApi(enrichedPerson);
      return successResponse(c, convertedPerson);
    } catch (error) {
      console.error('获取人员信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 创建人员
 * POST /persons
 */
personsRouter.post('/', validateBody(CreatePersonSchema), async c => {
  try {
    const personData = c.get('validatedBody');
    const currentUser = c.get('user');

    console.log('原始API数据:', personData);

    // 创建人员 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
    const [newPerson] = await db
      .insert(persons)
      .values({
        ...personData,
        createdBy: currentUser.userId,
      })
      .returning();

    console.log('数据库返回的数据:', newPerson);

    // 转换返回数据为API格式
    const convertedPerson = convertDbToApi(newPerson);
    console.log('转换后的API数据:', convertedPerson);

    return successResponse(c, convertedPerson, '人员创建成功');
  } catch (error) {
    console.error('创建人员失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 更新人员信息
 * PUT /persons/:id
 */
personsRouter.put(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdatePersonSchema),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const personData = c.get('validatedBody');
      const currentUser = c.get('user');

      // 获取用户可访问的部门ID列表
      const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
        currentUser.userId,
        currentUser.role,
        currentUser.departmentId,
      );

      // 构建查询条件 - 检查原始人员的权限
      const conditions = [eq(persons.id, id)];

      // 根据用户权限过滤数据 - 只检查原始部门权限
      if (accessibleDepartmentIds.length > 0) {
        conditions.push(inArray(persons.departmentId, accessibleDepartmentIds));
      } else {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      // 检查人员是否存在且有权限访问（基于原始部门）
      const existingPerson = await db
        .select({
          id: persons.id,
          departmentId: persons.departmentId,
        })
        .from(persons)
        .where(and(...conditions))
        .limit(1);

      if (existingPerson.length === 0) {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      // 如果要更新部门，检查目标部门权限
      if (
        personData.departmentId &&
        personData.departmentId !== existingPerson[0].departmentId
      ) {
        if (!accessibleDepartmentIds.includes(personData.departmentId)) {
          return errorResponse(c, '无权限将人员转移到目标部门');
        }
      }

      // 更新人员信息 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [updatedPerson] = await db
        .update(persons)
        .set({
          ...personData,
          updatedAt: new Date(),
        })
        .where(eq(persons.id, id))
        .returning();

      // 转换返回数据为API格式
      const convertedPerson = convertDbToApi(updatedPerson);
      return successResponse(c, convertedPerson, '人员信息更新成功');
    } catch (error) {
      console.error('更新人员信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 删除人员
 * DELETE /persons/:id
 */
personsRouter.delete(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const currentUser = c.get('user');

      // 管理员可以删除所有人员，操作员只能删除同部门的人员
      if (currentUser.role !== 'admin' && currentUser.role !== 'operator') {
        return errorResponse(c, '权限不足', 403);
      }

      // 检查人员是否存在
      const existingPerson = await db
        .select({ 
          id: persons.id,
          departmentId: persons.departmentId 
        })
        .from(persons)
        .where(eq(persons.id, id))
        .limit(1);

      if (existingPerson.length === 0) {
        return notFoundResponse(c, '人员不存在');
      }

      // 如果是操作员，需要检查是否同部门
      if (currentUser.role === 'operator') {
        // 获取用户可访问的部门ID列表
        const accessibleDepartmentIds = await getUserAccessibleDepartmentIds(
          currentUser.userId,
          currentUser.role,
          currentUser.departmentId,
        );

        // 检查目标人员的部门是否在可访问列表中
        if (
          !existingPerson[0].departmentId ||
          !accessibleDepartmentIds.includes(existingPerson[0].departmentId)
        ) {
          return errorResponse(c, '只能删除本部门的人员', 403);
        }
      }

      // 删除人员（级联删除相关记录）
      await db.delete(persons).where(eq(persons.id, id));

      return successResponse(c, null, '人员删除成功');
    } catch (error) {
      console.error('删除人员失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 更新人员最后联系信息
 * POST /persons/:id/contact
 */
personsRouter.post(
  '/:id/contact',
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
      const conditions = [eq(persons.id, id)];

      // 根据用户权限过滤数据
      if (accessibleDepartmentIds.length > 0) {
        conditions.push(inArray(persons.departmentId, accessibleDepartmentIds));
      } else {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      // 检查人员是否存在且有权限访问
      const existingPerson = await db
        .select({ id: persons.id })
        .from(persons)
        .where(and(...conditions))
        .limit(1);

      if (existingPerson.length === 0) {
        return notFoundResponse(c, '人员不存在或无权限访问');
      }

      // 更新最后联系信息
      const [updatedPerson] = await db
        .update(persons)
        .set({
          lastContactDate: new Date().toISOString().split('T')[0], // 只保留日期部分
          lastContactBy: currentUser.userId,
          updatedAt: new Date(),
        })
        .where(eq(persons.id, id))
        .returning();

      // 转换返回数据为API格式
      const convertedPerson = convertDbToApi(updatedPerson);
      return successResponse(c, convertedPerson, '联系信息更新成功');
    } catch (error) {
      console.error('更新联系信息失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

export default personsRouter;
