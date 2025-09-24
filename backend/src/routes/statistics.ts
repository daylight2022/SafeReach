import { Hono } from 'hono';
import { eq, and, count, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { persons, contacts, leaves, reminders, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validation.js';
import { StatisticsQuerySchema } from '../types/index.js';
import { successResponse, serverErrorResponse } from '../utils/response.js';
import {
  ResponseCalculator,
  type ReminderData,
  type ContactData,
} from '../utils/responseCalculator.js';

const statisticsRouter = new Hono();

// 所有统计路由都需要认证
statisticsRouter.use('*', authMiddleware);

/**
 * 获取基础统计数据
 * GET /statistics
 */
statisticsRouter.get('/', validateQuery(StatisticsQuerySchema), async c => {
  try {
    const { startDate, endDate } = c.get('validatedQuery');
    const currentUser = c.get('user');

    // 构建部门过滤条件
    const departmentFilter =
      currentUser.role === 'admin'
        ? undefined
        : eq(persons.departmentId, currentUser.departmentId || '');

    // 获取人员总数
    const [{ personCount }] = await db
      .select({ personCount: count() })
      .from(persons)
      .where(departmentFilter);

    // 计算时间范围
    let timeRangeStart: Date;
    let timeRangeEnd: Date;

    if (startDate && endDate) {
      timeRangeStart = new Date(startDate);
      timeRangeEnd = new Date(endDate + 'T23:59:59');
    } else {
      // 默认使用本月
      timeRangeStart = new Date();
      timeRangeStart.setDate(1);
      timeRangeStart.setHours(0, 0, 0, 0);
      timeRangeEnd = new Date();
    }

    // 获取时间范围内的联系次数
    const [{ contactCount }] = await db
      .select({ contactCount: count() })
      .from(contacts)
      .leftJoin(persons, eq(contacts.personId, persons.id))
      .where(
        and(
          gte(contacts.contactDate, timeRangeStart),
          lte(contacts.contactDate, timeRangeEnd),
          departmentFilter,
        ),
      );

    // 获取时间范围内的提醒数据
    const reminderData = await db
      .select({
        id: reminders.id,
        priority: reminders.priority,
        reminderType: reminders.reminderType,
        reminderDate: reminders.reminderDate,
        isHandled: reminders.isHandled,
        handledAt: reminders.handledAt,
        createdAt: reminders.createdAt,
      })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .where(
        and(
          gte(
            reminders.reminderDate,
            timeRangeStart.toISOString().split('T')[0],
          ),
          lte(reminders.reminderDate, timeRangeEnd.toISOString().split('T')[0]),
          departmentFilter,
        ),
      );

    // 获取时间范围内的联系数据
    const contactData = await db
      .select({
        id: contacts.id,
        contactDate: contacts.contactDate,
        personId: contacts.personId,
      })
      .from(contacts)
      .leftJoin(persons, eq(contacts.personId, persons.id))
      .where(
        and(
          gte(contacts.contactDate, timeRangeStart),
          lte(contacts.contactDate, timeRangeEnd),
          departmentFilter,
        ),
      );

    // 转换数据格式
    const reminderList: ReminderData[] = reminderData.map(r => ({
      id: r.id,
      priority: r.priority as 'high' | 'medium' | 'low',
      reminderType: r.reminderType as
        | 'before'
        | 'during'
        | 'ending'
        | 'overdue'
        | 'system',
      reminderDate: r.reminderDate,
      isHandled: r.isHandled || false,
      handledAt: r.handledAt?.toISOString(),
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const contactList: ContactData[] = contactData.map(c => ({
      id: c.id,
      contactDate: c.contactDate.toISOString(),
      personId: c.personId,
      hasRelatedReminder: reminderData.some(
        r => r.reminderDate === c.contactDate.toISOString().split('T')[0],
      ),
    }));

    // 计算响应指标
    const metrics = ResponseCalculator.calculateResponseMetrics(
      reminderList,
      contactList,
      personCount,
    );

    // 计算状态分布
    const statusDistribution =
      ResponseCalculator.calculateStatusDistribution(metrics);

    // 获取最近7天的联系趋势
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [{ dailyCount }] = await db
        .select({ dailyCount: count() })
        .from(contacts)
        .leftJoin(persons, eq(contacts.personId, persons.id))
        .where(
          and(
            gte(contacts.contactDate, date),
            lte(contacts.contactDate, nextDate),
            departmentFilter,
          ),
        );

      weeklyData.push(dailyCount);
    }

    return successResponse(c, {
      totalContacts: contactCount,
      totalPersons: personCount,
      avgResponseDays: metrics.avgResponseDays,
      avgFrequency: (contactCount / Math.max(personCount, 1)).toFixed(1),
      weeklyData,
      statusDistribution,
      departmentRanking: [
        {
          name: '当前部门',
          avgResponse: metrics.avgResponseDays,
          percentage: metrics.totalScore,
        },
      ],
      responseMetrics: metrics,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取仪表板统计数据
 * GET /statistics/dashboard
 */
statisticsRouter.get('/dashboard', async c => {
  try {
    const currentUser = c.get('user');

    // 构建部门过滤条件
    const departmentFilter =
      currentUser.role === 'admin'
        ? undefined
        : eq(persons.departmentId, currentUser.departmentId || '');

    // 获取人员总数
    const [{ personCount }] = await db
      .select({ personCount: count() })
      .from(persons)
      .where(departmentFilter);

    // 获取本月联系次数
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ monthlyContactCount }] = await db
      .select({ monthlyContactCount: count() })
      .from(contacts)
      .leftJoin(persons, eq(contacts.personId, persons.id))
      .where(and(gte(contacts.contactDate, startOfMonth), departmentFilter));

    // 获取进行中的休假数量（排除已结束的休假）
    const currentDate = new Date().toISOString().split('T')[0];
    const [{ activeLeaveCount }] = await db
      .select({ activeLeaveCount: count() })
      .from(leaves)
      .leftJoin(persons, eq(leaves.personId, persons.id))
      .where(
        and(
          eq(leaves.status, 'active'),
          gte(leaves.endDate, currentDate),
          departmentFilter,
        ),
      );

    // 获取未处理的高优先级提醒数量
    const [{ urgentReminderCount }] = await db
      .select({ urgentReminderCount: count() })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .where(
        and(
          eq(reminders.priority, 'high'),
          eq(reminders.isHandled, false),
          departmentFilter,
        ),
      );

    // 获取最近7天的联系趋势
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [{ dailyCount }] = await db
        .select({ dailyCount: count() })
        .from(contacts)
        .leftJoin(persons, eq(contacts.personId, persons.id))
        .where(
          and(
            gte(contacts.contactDate, date),
            lte(contacts.contactDate, nextDate),
            departmentFilter,
          ),
        );

      last7Days.push({
        date: date.toISOString().split('T')[0],
        count: dailyCount,
      });
    }

    return successResponse(c, {
      personCount,
      monthlyContactCount,
      activeLeaveCount,
      urgentReminderCount,
      contactTrend: last7Days,
    });
  } catch (error) {
    console.error('获取仪表板统计数据失败:', error);
    return serverErrorResponse(c, error);
  }
});

/**
 * 获取联系统计数据
 * GET /statistics/contacts
 */
statisticsRouter.get(
  '/contacts',
  validateQuery(StatisticsQuerySchema),
  async c => {
    try {
      const { startDate, endDate, department } = c.get('validatedQuery');
      const currentUser = c.get('user');

      // 构建查询条件
      const conditions = [];

      // 根据用户角色过滤数据
      if (currentUser.role !== 'admin') {
        conditions.push(
          eq(persons.departmentId, currentUser.departmentId || ''),
        );
      } else if (department) {
        conditions.push(eq(persons.departmentId, department));
      }

      if (startDate) {
        conditions.push(gte(contacts.contactDate, new Date(startDate)));
      }

      if (endDate) {
        conditions.push(
          lte(contacts.contactDate, new Date(endDate + 'T23:59:59')),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // 获取联系总次数
      const [{ totalContacts }] = await db
        .select({ totalContacts: count() })
        .from(contacts)
        .leftJoin(persons, eq(contacts.personId, persons.id))
        .where(whereClause);

      // 按联系方式统计
      const contactMethodStats = await db
        .select({
          method: contacts.contactMethod,
          count: count(),
        })
        .from(contacts)
        .leftJoin(persons, eq(contacts.personId, persons.id))
        .where(whereClause)
        .groupBy(contacts.contactMethod);

      // 按部门统计（仅管理员可见）
      let departmentStats: any[] = [];
      if (currentUser.role === 'admin') {
        departmentStats = await db
          .select({
            department_id: persons.departmentId,
            count: count(),
          })
          .from(contacts)
          .leftJoin(persons, eq(contacts.personId, persons.id))
          .where(whereClause)
          .groupBy(persons.departmentId);
      }

      // 按用户统计
      const userStats = await db
        .select({
          user: {
            id: users.id,
            username: users.username,
            realName: users.realName,
          },
          count: count(),
        })
        .from(contacts)
        .leftJoin(persons, eq(contacts.personId, persons.id))
        .leftJoin(users, eq(contacts.contactBy, users.id))
        .where(whereClause)
        .groupBy(users.id, users.username, users.realName);

      return successResponse(c, {
        totalContacts,
        contactMethodStats,
        departmentStats,
        userStats,
      });
    } catch (error) {
      console.error('获取联系统计数据失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 获取休假统计数据
 * GET /statistics/leaves
 */
statisticsRouter.get(
  '/leaves',
  validateQuery(StatisticsQuerySchema),
  async c => {
    try {
      const { startDate, endDate, department } = c.get('validatedQuery');
      const currentUser = c.get('user');

      // 构建查询条件
      const conditions = [];

      // 根据用户角色过滤数据
      if (currentUser.role !== 'admin') {
        conditions.push(
          eq(persons.departmentId, currentUser.departmentId || ''),
        );
      } else if (department) {
        conditions.push(eq(persons.departmentId, department));
      }

      if (startDate) {
        conditions.push(gte(leaves.startDate, startDate));
      }

      if (endDate) {
        conditions.push(lte(leaves.endDate, endDate));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // 获取休假总数
      const [{ totalLeaves }] = await db
        .select({ totalLeaves: count() })
        .from(leaves)
        .leftJoin(persons, eq(leaves.personId, persons.id))
        .where(whereClause);

      // 按休假类型统计
      const leaveTypeStats = await db
        .select({
          type: leaves.leaveType,
          count: count(),
          totalDays: sql<number>`sum(${leaves.days})`,
        })
        .from(leaves)
        .leftJoin(persons, eq(leaves.personId, persons.id))
        .where(whereClause)
        .groupBy(leaves.leaveType);

      // 按状态统计
      const statusStats = await db
        .select({
          status: leaves.status,
          count: count(),
        })
        .from(leaves)
        .leftJoin(persons, eq(leaves.personId, persons.id))
        .where(whereClause)
        .groupBy(leaves.status);

      // 按部门统计（仅管理员可见）
      let departmentStats: any[] = [];
      if (currentUser.role === 'admin') {
        departmentStats = await db
          .select({
            department_id: persons.departmentId,
            count: count(),
            totalDays: sql<number>`sum(${leaves.days})`,
          })
          .from(leaves)
          .leftJoin(persons, eq(leaves.personId, persons.id))
          .where(whereClause)
          .groupBy(persons.departmentId);
      }

      return successResponse(c, {
        totalLeaves,
        leaveTypeStats,
        statusStats,
        departmentStats,
      });
    } catch (error) {
      console.error('获取休假统计数据失败:', error);
      return serverErrorResponse(c, error);
    }
  },
);

/**
 * 获取用户个人统计数据
 * GET /statistics/personal
 */
statisticsRouter.get('/personal', async c => {
  try {
    const currentUser = c.get('user');

    // 获取负责的人员数量
    const [{ managedPersons }] = await db
      .select({ managedPersons: count() })
      .from(persons)
      .where(eq(persons.createdBy, currentUser.userId));

    // 获取本月联系次数
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ monthlyContacts }] = await db
      .select({ monthlyContacts: count() })
      .from(contacts)
      .where(
        and(
          eq(contacts.contactBy, currentUser.userId),
          gte(contacts.contactDate, startOfMonth),
        ),
      );

    // 获取处理的提醒数量
    const [{ handledReminders }] = await db
      .select({ handledReminders: count() })
      .from(reminders)
      .where(eq(reminders.handledBy, currentUser.userId));

    // 获取最近的联系记录
    const recentContacts = await db
      .select({
        id: contacts.id,
        contactDate: contacts.contactDate,
        contactMethod: contacts.contactMethod,
        person: {
          id: persons.id,
          name: persons.name,
        },
      })
      .from(contacts)
      .leftJoin(persons, eq(contacts.personId, persons.id))
      .where(eq(contacts.contactBy, currentUser.userId))
      .orderBy(sql`${contacts.contactDate} DESC`)
      .limit(5);

    return successResponse(c, {
      managedPersons,
      monthlyContacts,
      handledReminders,
      recentContacts,
    });
  } catch (error) {
    console.error('获取个人统计数据失败:', error);
    return serverErrorResponse(c, error);
  }
});

export default statisticsRouter;
