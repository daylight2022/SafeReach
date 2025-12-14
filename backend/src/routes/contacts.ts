import { Hono } from 'hono';
import { eq, and, count, desc, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { contacts, persons, users, leaves, reminders } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validation.js';
import {
  CreateContactSchema,
  UpdateContactSchema,
  ContactQuerySchema,
} from '../types/index.js';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  paginatedResponse,
  serverErrorResponse,
} from '../utils/response.js';
import { convertDbToApi } from '../utils/fieldMapping.js';
import { z } from 'zod';

const contactsRouter = new Hono();

// 所有联系记录路由都需要认证
contactsRouter.use('*', authMiddleware);

/**
 * 获取联系记录列表
 * GET /contacts
 */
contactsRouter.get('/', validateQuery(ContactQuerySchema), async c => {
  try {
    const { page, limit, personId, leaveId, contactBy, startDate, endDate } =
      c.get('validatedQuery');
    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [];

    if (personId) {
      conditions.push(eq(contacts.personId, personId));
    }

    if (leaveId) {
      conditions.push(eq(contacts.leaveId, leaveId));
    }

    if (contactBy) {
      conditions.push(eq(contacts.contactBy, contactBy));
    }

    if (startDate) {
      conditions.push(gte(contacts.contactDate, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(
        lte(contacts.contactDate, new Date(endDate + 'T23:59:59')),
      );
    }

    const finalWhereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const [{ total }] = await db
      .select({ total: count() })
      .from(contacts)
      .leftJoin(persons, eq(contacts.personId, persons.id))
      .where(finalWhereClause);

    // 获取联系记录列表
    const contactList = await db
      .select({
        id: contacts.id,
        person_id: contacts.personId,
        leave_id: contacts.leaveId,
        contact_date: contacts.contactDate,
        contact_by: contacts.contactBy,
        contact_method: contacts.contactMethod,
        notes: contacts.notes,
        created_at: contacts.createdAt,
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
        contact_user: {
          id: users.id,
          username: users.username,
          real_name: users.realName,
        },
      })
      .from(contacts)
      .leftJoin(persons, eq(contacts.personId, persons.id))
      .leftJoin(leaves, eq(contacts.leaveId, leaves.id))
      .leftJoin(users, eq(contacts.contactBy, users.id))
      .where(finalWhereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(contacts.contactDate));

    // 转换字段名为驼峰命名
    const convertedContactList = convertDbToApi(contactList);
    return paginatedResponse(c, convertedContactList, total, page, limit);
  } catch (error) {
    console.error('获取联系记录列表失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取指定联系记录
 * GET /contacts/:id
 */
contactsRouter.get(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');

      const contact = await db
        .select({
          id: contacts.id,
          person_id: contacts.personId,
          leave_id: contacts.leaveId,
          contact_date: contacts.contactDate,
          contact_by: contacts.contactBy,
          contact_method: contacts.contactMethod,
          notes: contacts.notes,
          created_at: contacts.createdAt,
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
          contact_user: {
            id: users.id,
            username: users.username,
            real_name: users.realName,
          },
        })
        .from(contacts)
        .leftJoin(persons, eq(contacts.personId, persons.id))
        .leftJoin(leaves, eq(contacts.leaveId, leaves.id))
        .leftJoin(users, eq(contacts.contactBy, users.id))
        .where(eq(contacts.id, id))
        .limit(1);

      if (contact.length === 0) {
        return notFoundResponse(c, '联系记录不存在或无权限访问');
      }

      // 转换字段名为驼峰命名
      const convertedContact = convertDbToApi(contact[0]);
      return successResponse(c, convertedContact);
    } catch (error) {
      console.error('获取联系记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 创建联系记录
 * POST /contacts
 */
contactsRouter.post('/', validateBody(CreateContactSchema), async c => {
  try {
    const contactData = c.get('validatedBody');
    const currentUser = c.get('user');

    // 检查人员是否存在
    const person = await db
      .select({ id: persons.id, departmentId: persons.departmentId })
      .from(persons)
      .where(eq(persons.id, contactData.personId))
      .limit(1);

    if (person.length === 0) {
      return notFoundResponse(c, '人员不存在');
    }

    // 如果指定了休假记录，检查是否存在
    if (contactData.leaveId) {
      const leave = await db
        .select({ id: leaves.id })
        .from(leaves)
        .where(eq(leaves.id, contactData.leaveId))
        .limit(1);

      if (leave.length === 0) {
        return notFoundResponse(c, '休假记录不存在');
      }
    }

    // 创建联系记录
    const [newContact] = await db
      .insert(contacts)
      .values({
        ...contactData,
        contactDate: new Date(contactData.contactDate), // 确保转换为Date对象
        contactBy: currentUser.userId,
      })
      .returning();

    // 更新人员的最后联系信息
    await db
      .update(persons)
      .set({
        lastContactDate: new Date(contactData.contactDate)
          .toISOString()
          .split('T')[0],
        lastContactBy: currentUser.userId,
        updatedAt: new Date(),
      })
      .where(eq(persons.id, contactData.personId));

    // 自动标记该人员的未处理提醒为已处理（每人最多只有一条）
    try {
      const handledReminders = await db
        .update(reminders)
        .set({
          isHandled: true,
          handledBy: currentUser.userId,
          handledAt: new Date(),
        })
        .where(
          and(
            eq(reminders.personId, contactData.personId),
            eq(reminders.isHandled, false)
          )
        )
        .returning();
      
      if (handledReminders.length > 0) {
        console.log(`✅ 自动标记提醒为已处理 (personId: ${contactData.personId})`);
      }
    } catch (reminderError) {
      // 不影响联系记录的创建，只记录错误
      console.error('标记提醒失败:', reminderError);
    }

    // 转换返回数据为API格式
    const convertedContact = convertDbToApi(newContact);
    return successResponse(c, convertedContact, '联系记录创建成功');
  } catch (error) {
    console.error('创建联系记录失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 更新联系记录
 * PUT /contacts/:id
 */
contactsRouter.put(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateContactSchema),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const contactData = c.get('validatedBody');
      const currentUser = c.get('user');

      // 检查联系记录是否存在
      const existingContact = await db
        .select({ id: contacts.id, contactBy: contacts.contactBy })
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);

      if (existingContact.length === 0) {
        return notFoundResponse(c, '联系记录不存在');
      }

      // 检查是否是记录创建者或管理员
      if (
        currentUser.role !== 'admin' &&
        existingContact[0].contactBy !== currentUser.userId
      ) {
        return errorResponse(c, '只能修改自己创建的联系记录', 403);
      }

      // 更新联系记录 - 直接使用API数据，因为Drizzle schema已经定义了正确的字段映射
      const [updatedContact] = await db
        .update(contacts)
        .set(contactData)
        .where(eq(contacts.id, id))
        .returning();

      // 转换返回数据为API格式
      const convertedContact = convertDbToApi(updatedContact);
      return successResponse(c, convertedContact, '联系记录更新成功');
    } catch (error) {
      console.error('更新联系记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 删除联系记录
 * DELETE /contacts/:id
 */
contactsRouter.delete(
  '/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  async c => {
    try {
      const { id } = c.get('validatedParams');
      const currentUser = c.get('user');

      // 检查联系记录是否存在
      const existingContact = await db
        .select({ id: contacts.id, contactBy: contacts.contactBy })
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);

      if (existingContact.length === 0) {
        return notFoundResponse(c, '联系记录不存在');
      }

      // 检查是否是记录创建者或管理员
      if (
        currentUser.role !== 'admin' &&
        existingContact[0].contactBy !== currentUser.userId
      ) {
        return errorResponse(c, '只能删除自己创建的联系记录', 403);
      }

      // 删除联系记录
      await db.delete(contacts).where(eq(contacts.id, id));

      return successResponse(c, null, '联系记录删除成功');
    } catch (error) {
      console.error('删除联系记录失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

export default contactsRouter;
