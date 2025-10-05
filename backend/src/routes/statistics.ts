import { Hono } from 'hono';
import { eq, and, count, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { persons, contacts, leaves, reminders, users, departments, reminderSettings } from '../db/schema.js';
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

    // 计算在假人员数量
    const currentDate = new Date().toISOString().split('T')[0];
    const [{ activePersons: activePersonsCount }] = await db
      .select({ activePersons: count() })
      .from(leaves)
      .leftJoin(persons, eq(leaves.personId, persons.id))
      .where(
        and(
          eq(leaves.status, 'active'),
          gte(leaves.endDate, currentDate),
          departmentFilter,
        ),
      );
    const activePersons = activePersonsCount || 0;

    // 基于 reminder 表统计人员状态分布
    // 统计未处理的提醒记录按优先级分布
    const reminderDistribution = await db
      .select({
        priority: reminders.priority,
        count: count(),
      })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .where(
        and(
          eq(reminders.isHandled, false),
          gte(
            reminders.reminderDate,
            timeRangeStart.toISOString().split('T')[0],
          ),
          lte(reminders.reminderDate, timeRangeEnd.toISOString().split('T')[0]),
          departmentFilter,
        ),
      )
      .groupBy(reminders.priority);

    // 转换为状态分布
    let urgentCount = 0;
    let suggestCount = 0;
    let normalCount = 0;

    for (const item of reminderDistribution) {
      const itemCount = Number(item.count);
      switch (item.priority) {
        case 'high':
          urgentCount = itemCount;
          break;
        case 'medium':
          suggestCount = itemCount;
          break;
        case 'low':
          normalCount = itemCount;
          break;
      }
    }

    // 状态分布基于提醒记录的优先级
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

    // 从提醒设置中获取阈值
    const [userSettings] = await db
      .select()
      .from(reminderSettings)
      .where(eq(reminderSettings.userId, currentUser.userId));
    
    const suggestThreshold = userSettings?.suggestThreshold || 7; // 建议联系阈值，默认7天
    const urgentThreshold = userSettings?.urgentThreshold || 10; // 紧急联系阈值，默认10天
    
    // 计算响应指标：只有当天处理才算及时
    let timelyResponse = 0;        // 及时响应数（当天处理）
    let overdueProcessed = 0;      // 超期处理数（超过紧急阈值）
    
    for (const reminder of reminderList) {
      if (reminder.isHandled && reminder.handledAt) {
        // 已处理：看 handled_at 是否超过 created_at 一天及以上
        const createdDate = new Date(reminder.createdAt);
        const handledDate = new Date(reminder.handledAt);
        
        // 只比较日期部分
        createdDate.setHours(0, 0, 0, 0);
        handledDate.setHours(0, 0, 0, 0);
        
        const responseDays = Math.floor(
          (handledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        
        // 当天处理（responseDays = 0）才算及时
        if (responseDays === 0) {
          timelyResponse++;
        }
        
        // 超过紧急阈值才处理
        if (responseDays > urgentThreshold) {
          overdueProcessed++;
        }
      }
      // 未处理的情况：reminder_date 超过 created_at 一天及以上，说明已经拖延了
      // 这种情况不算及时（timelyResponse 不增加）
    }
    
    // 计算响应率
    const totalReminders = reminderList.length;
    
    // 及时响应率 = (当天处理的数量 / 总提醒数) * 100
    const timelyResponseRate =
      totalReminders > 0
        ? Math.round((timelyResponse / totalReminders) * 100)
        : 0;

    // 计算健康度评分 - 使用扣分制
    const healthScoreResult = await calculateHealthScoreByDeduction(reminderList);
    const healthScore = healthScoreResult.score;
    console.log('🏥 健康度评分:', healthScore);
    console.log('🏥 健康度详情:', healthScoreResult.details);

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
      timelyResponseRate: calculateTrend(timelyResponseRate, previousMetrics.timelyResponseRate),
      overdueProcessed: calculateTrend(overdueProcessed, previousMetrics.overdueProcessed),
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
          timelyResponseRate,
          overdueProcessed,
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
        timelyResponseRate,   // 及时响应率
        overdueProcessed,     // 超期处理数
        suggestThreshold,     // 建议阈值天数
        urgentThreshold,      // 紧急阈值天数
      },
      healthScore,
      healthScoreDetails: healthScoreResult.details,
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
 * 计算健康度评分 - 基于扣分制
 * 初始100分，根据提醒记录的响应速度扣分
 * 
 * 核心理解：reminder记录的创建本身就代表已经到了需要联系的时候
 * 
 * 扣分规则：
 * - 已处理：handled_at - created_at，超过0天（即拖延处理），每天扣3分
 * - 未处理：当前日期 - created_at，超过0天（即一直不处理），每天扣1分
 * 
 * 只比较日期部分，当天处理（0天）不扣分
 * 提醒记录是凌晨更新，当日没联系，从第二天开始就要扣分
 */
async function calculateHealthScoreByDeduction(
  reminderList: Array<{
    id: string;
    priority: 'high' | 'medium' | 'low';
    reminderDate: string;
    isHandled: boolean;
    handledAt?: string | null;
    createdAt: string;
  }>,
): Promise<{
  score: number;
  details: {
    totalReminders: number;
    handledReminders: number;
    unhandledReminders: number;
    totalDeduction: number;
    avgResponseDays: number;
  };
}> {
  let totalDeduction = 0;
  let totalResponseDays = 0;
  let handledCount = 0;

  for (const reminder of reminderList) {
    let responseDays = 0;

    if (reminder.isHandled && reminder.handledAt) {
      // 已处理：计算 handled_at - created_at 的天数
      const createdDate = new Date(reminder.createdAt);
      const handledDate = new Date(reminder.handledAt);
      
      // 只比较日期部分，忽略时间
      createdDate.setHours(0, 0, 0, 0);
      handledDate.setHours(0, 0, 0, 0);
      
      responseDays = Math.floor(
        (handledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      handledCount++;
      totalResponseDays += responseDays;
      
      console.log(`🔍 已处理提醒: id=${reminder.id}, created=${new Date(reminder.createdAt).toISOString().split('T')[0]}, handled=${new Date(reminder.handledAt).toISOString().split('T')[0]}, days=${responseDays}`);
      
      // 已处理：超过0天（拖延处理），每天扣3分
      if (responseDays > 0) {
        totalDeduction += responseDays * 3;
        console.log(`  → 扣分: ${responseDays}天 × 3 = ${responseDays * 3}分`);
      }
    } else {
      // 未处理：计算当前日期 - created_at 的天数（提醒存在了多久）
      const createdDate = new Date(reminder.createdAt);
      const currentDate = new Date();
      
      // 只比较日期部分，忽略时间
      createdDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      responseDays = Math.floor(
        (currentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      
      console.log(`🔍 未处理提醒: id=${reminder.id}, created=${new Date(reminder.createdAt).toISOString().split('T')[0]}, today=${currentDate.toISOString().split('T')[0]}, days=${responseDays}`);
      
      // 如果计算结果为负数（异常情况），跳过
      if (responseDays < 0) {
        console.warn(`⚠️ 异常提醒记录: today < created_at, id=${reminder.id}`);
        continue;
      }
      
      // 未处理：超过0天（一直不处理），每天扣1分
      if (responseDays > 0) {
        totalDeduction += responseDays * 1;
        console.log(`  → 扣分: ${responseDays}天 × 1 = ${responseDays * 1}分`);
      }
    }
  }

  // 计算最终分数，确保不低于0分
  const finalScore = Math.max(0, 100 - totalDeduction);
  const avgResponseDays = handledCount > 0 ? Math.round(totalResponseDays / handledCount) : 0;

  console.log(`📊 健康度计算汇总:`);
  console.log(`   - 总提醒数: ${reminderList.length}`);
  console.log(`   - 已处理: ${handledCount}, 未处理: ${reminderList.length - handledCount}`);
  console.log(`   - 平均响应天数: ${avgResponseDays}天`);
  console.log(`   - 总扣分: ${totalDeduction}分`);
  console.log(`   - 最终得分: ${finalScore}分`);

  return {
    score: Math.round(finalScore),
    details: {
      totalReminders: reminderList.length,
      handledReminders: handledCount,
      unhandledReminders: reminderList.length - handledCount,
      totalDeduction,
      avgResponseDays,
    },
  };
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
): Promise<{ 
  timelyResponseRate: number;
  overdueProcessed: number;
  urgentCount: number; 
  unhandledReminders: number;
}> {
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

    // 计算响应指标：只有当天处理才算及时
    let timelyResponse = 0;
    let overdueProcessed = 0;
    let unhandledReminders = 0;
    const urgentThreshold = 10;

    for (const reminder of previousReminders) {
      if (!reminder.isHandled) {
        unhandledReminders++;
      } else if (reminder.handledAt && reminder.createdAt) {
        const createdDate = new Date(reminder.createdAt);
        const handledDate = new Date(reminder.handledAt);
        
        createdDate.setHours(0, 0, 0, 0);
        handledDate.setHours(0, 0, 0, 0);
        
        const responseDays = Math.floor(
          (handledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        
        // 当天处理才算及时
        if (responseDays === 0) {
          timelyResponse++;
        }
        if (responseDays > urgentThreshold) {
          overdueProcessed++;
        }
      }
    }

    const totalReminders = previousReminders.length;
      
    const timelyResponseRate = totalReminders > 0
      ? Math.round((timelyResponse / totalReminders) * 100)
      : 0;

    // 获取上期紧急提醒数（基于 reminder 表）
    const [{ urgentCount: previousUrgentCount }] = await db
      .select({ urgentCount: count() })
      .from(reminders)
      .leftJoin(persons, eq(reminders.personId, persons.id))
      .where(
        and(
          eq(reminders.priority, 'high'),
          eq(reminders.isHandled, false),
          gte(reminders.reminderDate, startDate.toISOString().split('T')[0]),
          lte(reminders.reminderDate, endDate.toISOString().split('T')[0]),
          departmentFilter,
        ),
      );

    return { 
      timelyResponseRate,
      overdueProcessed,
      urgentCount: previousUrgentCount || 0, 
      unhandledReminders 
    };
  } catch (error) {
    console.error('计算上期指标失败:', error);
    return { 
      timelyResponseRate: 0,
      overdueProcessed: 0,
      urgentCount: 0, 
      unhandledReminders: 0 
    };
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
 * 使用扣分制健康度评分进行排名
 */
async function getDepartmentRanking(
  startDate: Date,
  endDate: Date,
): Promise<Array<{
  departmentId: string;
  name: string;
  timelyResponseRate: number;    // 及时响应率
  overdueProcessed: number;      // 超期处理数
  urgentCount: number;
  totalReminders: number;
  unhandledReminders: number;
  healthScore: number;
  avgResponseDays: number;
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
    const urgentThreshold = 10; // 紧急联系阈值

    for (const dept of deptList) {
      const deptFilter = eq(persons.departmentId, dept.id);
      
      console.log(`📊 处理部门: ${dept.name} (${dept.id})`);

      // 获取该部门的提醒数据（包含完整信息用于健康度计算）
      const deptReminders = await db
        .select({
          id: reminders.id,
          priority: reminders.priority,
          reminderDate: reminders.reminderDate,
          isHandled: reminders.isHandled,
          handledAt: reminders.handledAt,
          createdAt: reminders.createdAt,
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

      // 计算响应指标：只有当天处理才算及时
      let timelyResponse = 0;        // 及时响应数（当天处理）
      let overdueProcessed = 0;      // 超期处理数
      let unhandledReminders = 0;

      for (const reminder of deptReminders) {
        if (!reminder.isHandled) {
          unhandledReminders++;
        } else if (reminder.handledAt && reminder.createdAt) {
          const createdDate = new Date(reminder.createdAt);
          const handledDate = new Date(reminder.handledAt);
          
          // 只比较日期部分
          createdDate.setHours(0, 0, 0, 0);
          handledDate.setHours(0, 0, 0, 0);
          
          const responseDays = Math.floor(
            (handledDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          
          // 当天处理才算及时
          if (responseDays === 0) {
            timelyResponse++;
          }
          
          // 超过紧急阈值才处理
          if (responseDays > urgentThreshold) {
            overdueProcessed++;
          }
        }
      }

      const totalReminders = deptReminders.length;
      
      const timelyResponseRate = totalReminders > 0
        ? Math.round((timelyResponse / totalReminders) * 100)
        : 0;

      // 获取紧急提醒数（基于 reminder 表）
      const [{ urgentCount: deptUrgentCount }] = await db
        .select({ urgentCount: count() })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(
          and(
            eq(reminders.priority, 'high'),
            eq(reminders.isHandled, false),
            gte(reminders.reminderDate, startDate.toISOString().split('T')[0]),
            lte(reminders.reminderDate, endDate.toISOString().split('T')[0]),
            deptFilter,
          ),
        );

      const urgentCount = deptUrgentCount || 0;

      // 使用扣分制计算该部门的健康度评分
      const deptHealthResult = await calculateHealthScoreByDeduction(
        deptReminders.map(r => ({
          id: r.id,
          priority: r.priority as 'high' | 'medium' | 'low',
          reminderDate: r.reminderDate,
          isHandled: r.isHandled || false,
          handledAt: r.handledAt ? r.handledAt.toISOString() : null,
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
        })),
      );

      const deptData = {
        departmentId: dept.id,
        name: dept.name,
        timelyResponseRate,    // 及时响应率
        overdueProcessed,      // 超期处理数
        urgentCount,
        totalReminders,
        unhandledReminders,
        healthScore: deptHealthResult.score,
        avgResponseDays: deptHealthResult.details.avgResponseDays,
      };
      
      console.log(`✅ 部门数据:`, deptData);
      ranking.push(deptData);
    }

    // 按健康度评分排序（分数越高越好）
    ranking.sort((a, b) => b.healthScore - a.healthScore);

    console.log('📊 最终部门排名:', ranking);
    return ranking;
  } catch (error) {
    console.error('获取部门排名失败:', error);
    return [];
  }
}

export default statisticsRouter;
