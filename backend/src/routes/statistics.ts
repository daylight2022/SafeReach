import { Hono } from 'hono';
import { eq, and, count, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { persons, contacts, leaves, reminders, users, departments } from '../db/schema.js';
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

    // 计算人员状态分布（带人数）
    const allPersons = await db
      .select({
        id: persons.id,
        lastContactDate: persons.lastContactDate,
        currentLeave: leaves,
      })
      .from(persons)
      .leftJoin(
        leaves,
        and(
          eq(leaves.personId, persons.id),
          eq(leaves.status, 'active'),
          gte(leaves.endDate, new Date().toISOString().split('T')[0]),
        ),
      )
      .where(departmentFilter);

    // 计算每个人的状态（只统计在假人员）
    let normalCount = 0;
    let suggestCount = 0;
    let urgentCount = 0;
    let activePersons = 0; // 在假人员数量

    for (const person of allPersons) {
      // 只统计有活跃假期的人员
      if (!person.currentLeave) {
        continue;
      }

      activePersons++;

      if (!person.lastContactDate) {
        urgentCount++;
        continue;
      }

      const daysSinceContact = Math.floor(
        (new Date().getTime() - new Date(person.lastContactDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysSinceContact > 7) {
        urgentCount++;
      } else if (daysSinceContact > 3) {
        suggestCount++;
      } else {
        normalCount++;
      }
    }

    // 状态分布只包含在假人员的三种状态
    const statusDistribution = {
      normal: {
        count: normalCount,
        percentage: activePersons > 0 ? Math.round((normalCount / activePersons) * 100) : 0,
      },
      suggest: {
        count: suggestCount,
        percentage: activePersons > 0 ? Math.round((suggestCount / activePersons) * 100) : 0,
      },
      urgent: {
        count: urgentCount,
        percentage: activePersons > 0 ? Math.round((urgentCount / activePersons) * 100) : 0,
      },
    };

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

    // 计算提醒处理率
    const reminderProcessRate =
      metrics.totalReminders > 0
        ? Math.round(
            ((metrics.handledOnTime + metrics.handledLate) /
              metrics.totalReminders) *
              100,
          )
        : 100;

    // 计算及时处理率
    const onTimeRate =
      metrics.totalReminders > 0
        ? Math.round((metrics.handledOnTime / metrics.totalReminders) * 100)
        : 100;

    // 计算健康度评分
    const healthScore = calculateHealthScore({
      onTimeRate,
      reminderProcessRate,
      urgentPercentage: activePersons > 0 ? (urgentCount / activePersons) * 100 : 0,
      proactiveRate: contactCount > 0 ? (metrics.proactiveContacts / contactCount) * 100 : 0,
      unhandledReminders: metrics.unhandledReminders,
    });
    console.log('🏥 健康度评分:', healthScore);

    // 获取上期数据用于趋势对比
    const previousPeriod = getPreviousPeriod(timeRangeStart, timeRangeEnd);
    console.log('📅 上期时间范围:', previousPeriod);
    
    const previousMetrics = await calculatePreviousMetrics(
      previousPeriod.start,
      previousPeriod.end,
      departmentFilter,
    );
    console.log('📊 上期指标:', previousMetrics);

    // 计算趋势
    const trends = {
      onTimeRate: calculateTrend(onTimeRate, previousMetrics.onTimeRate),
      urgentCount: calculateTrend(urgentCount, previousMetrics.urgentCount),
      unhandledReminders: calculateTrend(
        metrics.unhandledReminders,
        previousMetrics.unhandledReminders,
      ),
    };
    console.log('📈 趋势数据:', trends);

    // 获取部门排名（管理员可见多部门）
    let departmentRanking = [];
    console.log('👤 用户角色:', currentUser.role);
    if (currentUser.role === 'admin') {
      console.log('🔍 管理员查询所有部门排名...');
      departmentRanking = await getDepartmentRanking(timeRangeStart, timeRangeEnd);
    } else {
      console.log('🔍 普通用户仅显示当前部门...');
      departmentRanking = [
        {
          departmentId: currentUser.departmentId || '',
          name: '当前部门',
          reminderProcessRate,
          onTimeRate,
          urgentCount,
          totalReminders: metrics.totalReminders,
          unhandledReminders: metrics.unhandledReminders,
        },
      ];
    }
    console.log('🏆 部门排名结果:', departmentRanking);

    const responseData = {
      totalContacts: contactCount,
      totalPersons: personCount,
      activePersons: activePersons,
      weeklyData,
      statusDistribution,
      departmentRanking,
      responseMetrics: {
        ...metrics,
        reminderProcessRate,
        onTimeRate,
      },
      healthScore,
      trends,
    };
    
    console.log('✅ 最终返回数据:', JSON.stringify(responseData, null, 2));
    return successResponse(c, responseData);
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

/**
 * 计算健康度评分
 * 基于多个指标综合计算：及时处理率40% + 提醒处理率30% + 非紧急占比20% + 主动联系率10%
 */
function calculateHealthScore(params: {
  onTimeRate: number;
  reminderProcessRate: number;
  urgentPercentage: number;
  proactiveRate: number;
  unhandledReminders: number;
}): number {
  const { onTimeRate, reminderProcessRate, urgentPercentage, proactiveRate, unhandledReminders } = params;
  
  // 基础分数计算
  let score =
    onTimeRate * 0.4 +
    reminderProcessRate * 0.3 +
    (100 - urgentPercentage) * 0.2 +
    Math.min(proactiveRate, 100) * 0.1;

  // 未处理提醒惩罚
  if (unhandledReminders > 0) {
    score -= Math.min(unhandledReminders * 2, 20); // 每个未处理提醒扣2分，最多扣20分
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * 获取上期时间范围
 */
function getPreviousPeriod(
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  
  return { start: previousStart, end: previousEnd };
}

/**
 * 计算上期指标
 */
async function calculatePreviousMetrics(
  startDate: Date,
  endDate: Date,
  departmentFilter: any,
): Promise<{ onTimeRate: number; urgentCount: number; unhandledReminders: number }> {
  try {
    // 获取上期提醒数据
    const previousReminders = await db
      .select({
        isHandled: reminders.isHandled,
        handledAt: reminders.handledAt,
        reminderDate: reminders.reminderDate,
        createdAt: reminders.createdAt,
      })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .where(
        and(
          gte(reminders.reminderDate, startDate.toISOString().split('T')[0]),
          lte(reminders.reminderDate, endDate.toISOString().split('T')[0]),
          departmentFilter,
        ),
      );

    // 计算及时处理的数量
    let handledOnTime = 0;
    let unhandledReminders = 0;

    for (const reminder of previousReminders) {
      if (!reminder.isHandled) {
        unhandledReminders++;
      } else if (reminder.handledAt) {
        const reminderDate = new Date(reminder.reminderDate);
        const handledDate = new Date(reminder.handledAt);
        const delayDays = Math.floor(
          (handledDate.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (delayDays <= 0) {
          handledOnTime++;
        }
      }
    }

    const onTimeRate =
      previousReminders.length > 0
        ? Math.round((handledOnTime / previousReminders.length) * 100)
        : 100;

    // 获取上期紧急人数
    const previousPersons = await db
      .select({
        id: persons.id,
        lastContactDate: persons.lastContactDate,
        currentLeave: leaves,
      })
      .from(persons)
      .leftJoin(
        leaves,
        and(
          eq(leaves.personId, persons.id),
          eq(leaves.status, 'active'),
          gte(leaves.endDate, startDate.toISOString().split('T')[0]),
          lte(leaves.startDate, endDate.toISOString().split('T')[0]),
        ),
      )
      .where(departmentFilter);

    let urgentCount = 0;
    for (const person of previousPersons) {
      if (!person.currentLeave) continue;
      if (!person.lastContactDate) {
        urgentCount++;
        continue;
      }
      const daysSinceContact = Math.floor(
        (endDate.getTime() - new Date(person.lastContactDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceContact > 7) {
        urgentCount++;
      }
    }

    return { onTimeRate, urgentCount, unhandledReminders };
  } catch (error) {
    console.error('计算上期指标失败:', error);
    return { onTimeRate: 0, urgentCount: 0, unhandledReminders: 0 };
  }
}

/**
 * 计算趋势
 */
function calculateTrend(
  current: number,
  previous: number,
): { current: number; previous: number; change: number; trend: 'up' | 'down' | 'stable' } {
  const change = current - previous;
  let trend: 'up' | 'down' | 'stable' = 'stable';
  
  if (Math.abs(change) > 0) {
    trend = change > 0 ? 'up' : 'down';
  }

  return {
    current,
    previous,
    change: Math.abs(change),
    trend,
  };
}

/**
 * 获取所有部门的排名（仅管理员）
 */
async function getDepartmentRanking(
  startDate: Date,
  endDate: Date,
): Promise<Array<{
  departmentId: string;
  name: string;
  reminderProcessRate: number;
  onTimeRate: number;
  urgentCount: number;
  totalReminders: number;
  unhandledReminders: number;
}>> {
  try {
    // 获取所有有人员的部门
    const deptList = await db
      .select({
        id: departments.id,
        name: departments.name,
      })
      .from(departments)
      .leftJoin(persons, eq(departments.id, persons.departmentId))
      .where(sql`${persons.id} IS NOT NULL`)
      .groupBy(departments.id, departments.name);

    console.log('📋 找到的部门列表:', deptList);

    const ranking = [];

    for (const dept of deptList) {
      const deptFilter = eq(persons.departmentId, dept.id);
      
      console.log(`📊 处理部门: ${dept.name} (${dept.id})`);

      // 获取该部门的提醒数据
      const deptReminders = await db
        .select({
          isHandled: reminders.isHandled,
          handledAt: reminders.handledAt,
          reminderDate: reminders.reminderDate,
        })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(
          and(
            gte(reminders.reminderDate, startDate.toISOString().split('T')[0]),
            lte(reminders.reminderDate, endDate.toISOString().split('T')[0]),
            deptFilter,
          ),
        );

      let handledOnTime = 0;
      let unhandledReminders = 0;

      for (const reminder of deptReminders) {
        if (!reminder.isHandled) {
          unhandledReminders++;
        } else if (reminder.handledAt) {
          const reminderDate = new Date(reminder.reminderDate);
          const handledDate = new Date(reminder.handledAt);
          const delayDays = Math.floor(
            (handledDate.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (delayDays <= 0) {
            handledOnTime++;
          }
        }
      }

      const totalReminders = deptReminders.length;
      const onTimeRate =
        totalReminders > 0 ? Math.round((handledOnTime / totalReminders) * 100) : 100;
      const reminderProcessRate =
        totalReminders > 0
          ? Math.round(((totalReminders - unhandledReminders) / totalReminders) * 100)
          : 100;

      // 获取紧急人数
      const deptPersons = await db
        .select({
          id: persons.id,
          lastContactDate: persons.lastContactDate,
          currentLeave: leaves,
        })
        .from(persons)
        .leftJoin(
          leaves,
          and(
            eq(leaves.personId, persons.id),
            eq(leaves.status, 'active'),
            gte(leaves.endDate, new Date().toISOString().split('T')[0]),
          ),
        )
        .where(deptFilter);

      let urgentCount = 0;
      for (const person of deptPersons) {
        if (!person.currentLeave) continue;
        if (!person.lastContactDate) {
          urgentCount++;
          continue;
        }
        const daysSinceContact = Math.floor(
          (new Date().getTime() - new Date(person.lastContactDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysSinceContact > 7) {
          urgentCount++;
        }
      }

      const deptData = {
        departmentId: dept.id,
        name: dept.name,
        reminderProcessRate,
        onTimeRate,
        urgentCount,
        totalReminders,
        unhandledReminders,
      };
      
      console.log(`✅ 部门数据:`, deptData);
      ranking.push(deptData);
    }

    // 按综合得分排序：及时处理率40% + 提醒处理率30% + 低紧急人数30%
    ranking.sort((a, b) => {
      const scoreA = a.onTimeRate * 0.4 + a.reminderProcessRate * 0.3 + (10 - Math.min(a.urgentCount, 10)) * 3;
      const scoreB = b.onTimeRate * 0.4 + b.reminderProcessRate * 0.3 + (10 - Math.min(b.urgentCount, 10)) * 3;
      return scoreB - scoreA;
    });

    console.log('📊 最终部门排名:', ranking);
    return ranking;
  } catch (error) {
    console.error('获取部门排名失败:', error);
    return [];
  }
}

export default statisticsRouter;
