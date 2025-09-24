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
  sql,
} from 'drizzle-orm';
import { db } from '../db/connection.js';
import { persons, users, leaves, contacts, departments } from '../db/schema.js';
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

    // 获取总数（只计算有活跃休假且未结束的人员）
    const [{ total }] = await db
      .select({ total: count() })
      .from(persons)
      .where(
        and(
          whereClause,
          // 只包含有活跃休假且休假未结束的人员
          sql`EXISTS (
            SELECT 1 FROM ${leaves} l
            WHERE l.person_id = ${persons.id}
            AND l.status = 'active'
            AND l.end_date >= ${currentDate}
          )`,
        ),
      );

    // 获取人员列表（包含创建者信息），只包含有活跃休假的人员
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
        and(
          whereClause,
          // 只包含有活跃休假且休假未结束的人员
          sql`EXISTS (
            SELECT 1 FROM ${leaves} l
            WHERE l.person_id = ${persons.id}
            AND l.status = 'active'
            AND l.end_date >= ${currentDate}
          )`,
        ),
      )
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy(orderColumn));

    // 为每个人员获取当前活跃的休假和最后联系记录
    const enrichedPersonList = await Promise.all(
      personList.map(async person => {
        // 获取当前活跃的休假（我们已经确保所有人员都有活跃且未结束的休假）
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
              gte(leaves.endDate, currentDate),
            ),
          )
          .orderBy(desc(leaves.createdAt))
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

        return {
          ...person,
          current_leave: currentLeave || null,
          last_contact: lastContact || null,
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

      // 转换字段名为驼峰命名
      const convertedPerson = convertDbToApi(person[0]);
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

      // 只有管理员可以删除人员
      if (currentUser.role !== 'admin') {
        return errorResponse(c, '权限不足', 403);
      }

      // 检查人员是否存在
      const existingPerson = await db
        .select({ id: persons.id })
        .from(persons)
        .where(eq(persons.id, id))
        .limit(1);

      if (existingPerson.length === 0) {
        return notFoundResponse(c, '人员不存在');
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
