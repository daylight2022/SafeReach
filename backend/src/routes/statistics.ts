import { Hono } from 'hono';
import { eq, and, count, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { persons, contacts, leaves, reminders, users, departments } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validation.js';
import { StatisticsQuerySchema } from '../types/index.js';
import { successResponse, serverErrorResponse } from '../utils/response.js';

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

    // 获取时间范围内的联系次数（不限制是否休假结束）
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

    // 获取本月提醒总数（基于 reminder_date，不限制是否休假结束）
    const [{ totalRemindersCount }] = await db
      .select({ totalRemindersCount: count() })
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

    // 获取所有有活跃休假的人员（用于平均联系间隔和健康度计算）
    const currentDate = new Date().toISOString().split('T')[0];
    const activeLeavePersons = await db
      .select({
        personId: persons.id,
        personName: persons.name,
        leaveStartDate: leaves.startDate,
        lastContactDate: persons.lastContactDate,
        personCreatedAt: persons.createdAt,
      })
      .from(persons)
      .innerJoin(leaves, eq(persons.id, leaves.personId))
      .where(
        and(
          eq(leaves.status, 'active'),
          gte(leaves.endDate, currentDate),
          departmentFilter,
        ),
      );

    // 获取有活跃休假且有未处理提醒的人员（仅用于未处理提醒统计）
    const activeLeavePersonsWithReminders = await db
      .select({
        personId: persons.id,
        reminderId: reminders.id,
        reminderPriority: reminders.priority,
      })
      .from(persons)
      .innerJoin(leaves, eq(persons.id, leaves.personId))
      .innerJoin(reminders, and(
        eq(reminders.personId, persons.id),
        eq(reminders.isHandled, false)
      ))
      .where(
        and(
          eq(leaves.status, 'active'),
          gte(leaves.endDate, currentDate),
          departmentFilter,
        ),
      );

    // 计算在假人员数量：统计所有有活跃休假的人员（不管是否有提醒）
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
    // 统计未处理的、已到期的提醒记录按优先级分布（只统计当前需要处理的）
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
          lte(reminders.reminderDate, currentDate), // 只统计已到期的提醒
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

    // 计算未处理提醒数（有活跃休假且有未处理提醒的人数）
    const unhandledReminders = activeLeavePersonsWithReminders.length;

    // 计算平均联系间隔天数（新方案：统计所有有活跃休假人员的联系间隔综合平均值）
    const avgContactInterval = await calculateAvgContactInterval(
      activeLeavePersons,
      currentDate,
    );

    // 计算健康度评分 - 基于所有有活跃休假人员的所有历史联系间隔
    // 对每个人员的所有联系间隔（休假开始/人员添加→第一次联系、联系之间、最后联系→今天）进行扣分
    // 扣分规则（含1天宽容度）：
    // - ≤ 7天：不扣分
    // - 8-10天：每天扣1分
    // - > 10天：每天扣3分，但单个间隔最多扣到第12天（上限9分）
    let healthScore = 100;
    
    // 如果是管理员，按部门分别计算健康度，然后等比例累加
    if (currentUser.role === 'admin') {
      console.log('👨‍💼 管理员模式：按部门等比例计算综合健康度');
      
      // 获取部门排名（已包含各部门健康度）
      const deptRanking = await getDepartmentRanking(timeRangeStart, timeRangeEnd);
      
      if (deptRanking.length > 0) {
        // 每个部门分配的分数 = 100 / 部门数
        const scorePerDept = 100 / deptRanking.length;
        
        // 累加各部门的等比例健康度
        healthScore = deptRanking.reduce((total, dept) => {
          return total + (dept.healthScore / 100) * scorePerDept;
        }, 0);
        
        healthScore = Math.round(healthScore);
        console.log(`🏥 综合健康度评分: ${healthScore}分 (${deptRanking.length}个部门平均)`);
      }
    } else {
      // 普通用户：单个部门的健康度
      for (const person of activeLeavePersons) {
        const penalty = await calculatePersonHealthPenalty(
          person.personId,
          person.leaveStartDate,
          currentDate,
          person.personCreatedAt || undefined,
        );
        healthScore -= penalty;
      }
      
      healthScore = Math.max(0, Math.round(healthScore));
      console.log('🏥 部门健康度评分:', healthScore);
    }

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
          avgContactInterval,
          urgentCount,
          totalReminders: totalRemindersCount,
          unhandledReminders: unhandledReminders,
          healthScore,
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
        totalReminders: totalRemindersCount,  // 本月提醒总数
        unhandledReminders: unhandledReminders,  // 未处理提醒数（有活跃休假且有提醒）
        avgContactInterval: avgContactInterval,  // 平均联系间隔天数
      },
      healthScore,
      healthScoreDetails: {
        totalActiveLeavePersons: activeLeavePersons.length,
        avgContactInterval: avgContactInterval,
      },
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

    // 获取在假人员数量：统计所有有活跃休假的人员（不管是否有提醒）
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
 * 计算平均联系间隔（综合统计方案）
 * 统计所有有活跃休假人员的所有联系间隔：
 * - 第一次联系间隔：休假开始日期到第一次联系
 * - 中间联系间隔：每两次联系之间的差值
 * - 最后一次联系间隔：最后一次联系到当前日期（仅当休假未结束）
 * 返回所有间隔的平均值（保留1位小数）
 * 
 * @param activeLeavePersons 所有有活跃休假的人员列表
 * @param currentDate 当前日期
 * @returns 平均联系间隔天数（保留1位小数）
 */
async function calculateAvgContactInterval(
  activeLeavePersons: Array<{
    personId: string;
    leaveStartDate: string;
  }>,
  currentDate: string,
): Promise<number> {
  if (activeLeavePersons.length === 0) return 0;

  let totalIntervals = 0;
  let intervalCount = 0;

  for (const person of activeLeavePersons) {
    // 获取该人员当前活跃休假的信息
    const [activeLeave] = await db
      .select({
        id: leaves.id,
        startDate: leaves.startDate,
        endDate: leaves.endDate,
        status: leaves.status,
      })
      .from(leaves)
      .where(
        and(
          eq(leaves.personId, person.personId),
          eq(leaves.status, 'active'),
          gte(leaves.endDate, currentDate),
        ),
      )
      .orderBy(leaves.startDate)
      .limit(1);

    if (!activeLeave) continue;

    const leaveStartDate = new Date(activeLeave.startDate);
    const leaveEndDate = new Date(activeLeave.endDate);
    const today = new Date(currentDate);
    
    leaveStartDate.setHours(0, 0, 0, 0);
    leaveEndDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // 获取该人员在当前休假期间的所有联系记录（按日期升序）
    const contactRecords = await db
      .select({
        contactDate: contacts.contactDate,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.personId, person.personId),
          gte(contacts.contactDate, leaveStartDate),
        ),
      )
      .orderBy(contacts.contactDate);

    if (contactRecords.length === 0) {
      // 没有联系记录：间隔 = 休假开始到今天
      const interval = (today.getTime() - leaveStartDate.getTime()) / (1000 * 60 * 60 * 24);
      totalIntervals += interval;
      intervalCount++;
    } else {
      // 第一次联系间隔：休假开始到第一次联系
      const firstContactDate = new Date(contactRecords[0].contactDate);
      firstContactDate.setHours(0, 0, 0, 0);
      const firstInterval = (firstContactDate.getTime() - leaveStartDate.getTime()) / (1000 * 60 * 60 * 24);
      totalIntervals += firstInterval;
      intervalCount++;

      // 中间联系间隔：每两次联系之间
      for (let i = 1; i < contactRecords.length; i++) {
        const prevContactDate = new Date(contactRecords[i - 1].contactDate);
        const currContactDate = new Date(contactRecords[i].contactDate);
        prevContactDate.setHours(0, 0, 0, 0);
        currContactDate.setHours(0, 0, 0, 0);
        const interval = (currContactDate.getTime() - prevContactDate.getTime()) / (1000 * 60 * 60 * 24);
        totalIntervals += interval;
        intervalCount++;
      }

      // 最后一次联系间隔：最后一次联系到今天（仅当休假未结束）
      const lastContactDate = new Date(contactRecords[contactRecords.length - 1].contactDate);
      lastContactDate.setHours(0, 0, 0, 0);
      
      // 判断休假是否已结束
      const isLeaveEnded = today.getTime() > leaveEndDate.getTime();
      
      if (!isLeaveEnded) {
        const lastInterval = (today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24);
        totalIntervals += lastInterval;
        intervalCount++;
      }
    }
  }

  // 返回平均值，保留1位小数
  const avgInterval = intervalCount > 0 ? totalIntervals / intervalCount : 0;
  return Math.round(avgInterval * 10) / 10;
}

/**
 * 计算单个人员的健康度扣分
 * 检查该人员在活跃休假期间的所有联系间隔，对超过阈值的间隔进行扣分
 * 
 * @param personId 人员ID
 * @param leaveStartDate 休假开始日期
 * @param currentDate 当前日期
 * @param personCreatedAt 人员添加日期（用于判断第一次联系间隔起点）
 * @returns 该人员应扣除的分数
 */
async function calculatePersonHealthPenalty(
  personId: string,
  leaveStartDate: string,
  currentDate: string,
  personCreatedAt?: Date,
): Promise<number> {
  let penalty = 0;

  const leaveStart = new Date(leaveStartDate);
  const today = new Date(currentDate);
  leaveStart.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // 获取该人员当前活跃休假的信息
  const [activeLeave] = await db
    .select({
      id: leaves.id,
      startDate: leaves.startDate,
      endDate: leaves.endDate,
      status: leaves.status,
    })
    .from(leaves)
    .where(
      and(
        eq(leaves.personId, personId),
        eq(leaves.status, 'active'),
        gte(leaves.endDate, currentDate),
      ),
    )
    .orderBy(leaves.startDate)
    .limit(1);

  if (!activeLeave) return penalty;

  const leaveEndDate = new Date(activeLeave.endDate);
  leaveEndDate.setHours(0, 0, 0, 0);

  // 获取该人员在当前休假期间的所有联系记录（按日期升序）
  const contactRecords = await db
    .select({
      contactDate: contacts.contactDate,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.personId, personId),
        gte(contacts.contactDate, leaveStart),
      ),
    )
    .orderBy(contacts.contactDate);

  const intervals: number[] = [];

  // 确定第一次联系间隔的起点日期
  // 如果休假开始日期早于人员添加日期，则从人员添加日期开始计算
  let firstIntervalStartDate = leaveStart;
  if (personCreatedAt) {
    const personCreated = new Date(personCreatedAt);
    personCreated.setHours(0, 0, 0, 0);
    if (leaveStart.getTime() < personCreated.getTime()) {
      firstIntervalStartDate = personCreated;
    }
  }

  if (contactRecords.length === 0) {
    // 没有联系记录：间隔 = 第一次联系起点到今天
    const interval = Math.floor((today.getTime() - firstIntervalStartDate.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(interval);
  } else {
    // 第一次联系间隔：第一次联系起点到第一次联系
    const firstContactDate = new Date(contactRecords[0].contactDate);
    firstContactDate.setHours(0, 0, 0, 0);
    const firstInterval = Math.floor((firstContactDate.getTime() - firstIntervalStartDate.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(firstInterval);

    // 中间联系间隔：每两次联系之间
    for (let i = 1; i < contactRecords.length; i++) {
      const prevContactDate = new Date(contactRecords[i - 1].contactDate);
      const currContactDate = new Date(contactRecords[i].contactDate);
      prevContactDate.setHours(0, 0, 0, 0);
      currContactDate.setHours(0, 0, 0, 0);
      const interval = Math.floor((currContactDate.getTime() - prevContactDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(interval);
    }

    // 最后一次联系间隔：最后一次联系到今天（仅当休假未结束）
    const lastContactDate = new Date(contactRecords[contactRecords.length - 1].contactDate);
    lastContactDate.setHours(0, 0, 0, 0);
    
    const isLeaveEnded = today.getTime() > leaveEndDate.getTime();
    
    if (!isLeaveEnded) {
      const lastInterval = Math.floor((today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(lastInterval);
    }
  }

  // 对每个间隔应用扣分规则（含1天宽容度）
  // 单个间隔最多扣到第12天（上限9分）
  for (const interval of intervals) {
    let intervalPenalty = 0;
    
    if (interval > 10) {
      // 超过紧急阈值（10天），每天扣3分
      // 但最多扣到第12天（即最多再扣2天 × 3分 = 6分）
      const daysOver10 = Math.min(interval - 10, 2); // 最多算2天
      intervalPenalty += daysOver10 * 3;
      // 加上8-10天的扣分（3天 × 1分）
      intervalPenalty += 3;
    } else if (interval > 7) {
      // 超过建议阈值（7天），每天扣1分
      intervalPenalty += (interval - 7) * 1;
    }
    // interval ≤ 7：不扣分
    
    penalty += intervalPenalty;
  }

  return penalty;
}

/**
 * 获取所有部门的排名（仅管理员）
 * 基于所有有活跃休假人员的联系情况计算健康度评分并排名
 * 使用扣分制健康度评分进行排名（分数越高越好）
 */
async function getDepartmentRanking(
  startDate: Date,
  endDate: Date,
): Promise<Array<{
  departmentId: string;
  name: string;
  avgContactInterval: number;    // 平均联系间隔
  urgentCount: number;
  totalReminders: number;
  unhandledReminders: number;
  healthScore: number;
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
    const currentDate = new Date().toISOString().split('T')[0];

    for (const dept of deptList) {
      const deptFilter = eq(persons.departmentId, dept.id);
      
      console.log(`📊 处理部门: ${dept.name} (${dept.id})`);

      // 获取本月该部门的提醒总数（基于 reminder_date）
      const [{ totalRemindersCount: deptTotalReminders }] = await db
        .select({ totalRemindersCount: count() })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(
          and(
            gte(reminders.reminderDate, startDate.toISOString().split('T')[0]),
            lte(reminders.reminderDate, endDate.toISOString().split('T')[0]),
            deptFilter,
          ),
        );

      // 获取该部门所有有活跃休假的人员
      const deptActiveLeavePersons = await db
        .select({
          personId: persons.id,
          personName: persons.name,
          leaveStartDate: leaves.startDate,
          lastContactDate: persons.lastContactDate,
          personCreatedAt: persons.createdAt,
        })
        .from(persons)
        .innerJoin(leaves, eq(persons.id, leaves.personId))
        .where(
          and(
            eq(leaves.status, 'active'),
            gte(leaves.endDate, currentDate),
            deptFilter,
          ),
        );

      // 获取该部门有活跃休假且有未处理提醒的人员（仅用于未处理提醒统计）
      const deptActiveLeavePersonsWithReminders = await db
        .select({
          personId: persons.id,
          reminderId: reminders.id,
        })
        .from(persons)
        .innerJoin(leaves, eq(persons.id, leaves.personId))
        .innerJoin(reminders, and(
          eq(reminders.personId, persons.id),
          eq(reminders.isHandled, false)
        ))
        .where(
          and(
            eq(leaves.status, 'active'),
            gte(leaves.endDate, currentDate),
            deptFilter,
          ),
        );

      const unhandledReminders = deptActiveLeavePersonsWithReminders.length;

      // 计算该部门的平均联系间隔（使用综合统计方案，基于所有有活跃休假的人员）
      const avgContactInterval = await calculateAvgContactInterval(
        deptActiveLeavePersons,
        currentDate,
      );

      // 获取当前未处理的高优先级提醒数
      const [{ urgentCount: deptUrgentCount }] = await db
        .select({ urgentCount: count() })
        .from(reminders)
        .leftJoin(persons, eq(reminders.personId, persons.id))
        .where(
          and(
            eq(reminders.priority, 'high'),
            eq(reminders.isHandled, false),
            deptFilter,
          ),
        );
      const urgentCount = deptUrgentCount || 0;

      // 计算该部门的健康度评分（基于所有有活跃休假人员的所有历史联系间隔）
      let healthScore = 100;
      for (const person of deptActiveLeavePersons) {
        const penalty = await calculatePersonHealthPenalty(
          person.personId,
          person.leaveStartDate,
          currentDate,
          person.personCreatedAt || undefined,
        );
        healthScore -= penalty;
      }
      
      healthScore = Math.max(0, Math.round(healthScore));

      const deptData = {
        departmentId: dept.id,
        name: dept.name,
        avgContactInterval,
        urgentCount,
        totalReminders: deptTotalReminders || 0,
        unhandledReminders,
        healthScore,
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
