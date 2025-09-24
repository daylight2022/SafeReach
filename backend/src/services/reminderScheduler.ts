import cron from 'node-cron';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { db } from '../db/connection.js';
import {
  persons,
  leaves,
  reminders,
  reminderSettings,
  contacts,
  users,
} from '../db/schema.js';

export class ReminderScheduler {
  private static instance: ReminderScheduler;
  private tasks: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): ReminderScheduler {
    if (!ReminderScheduler.instance) {
      ReminderScheduler.instance = new ReminderScheduler();
    }
    return ReminderScheduler.instance;
  }

  /**
   * 启动定时任务
   */
  public start(): void {
    console.log('🕐 启动提醒定时任务调度器...');

    // 每日凌晨1点执行提醒更新
    const dailyTask = cron.schedule(
      '0 1 * * *',
      async () => {
        console.log('🔔 开始执行每日提醒更新任务...');
        try {
          await this.updateDailyReminders();
          console.log('✅ 每日提醒更新任务完成');
        } catch (error) {
          console.error('❌ 每日提醒更新任务失败:', error);
        }
      },
      {
        timezone: 'Asia/Shanghai',
      } as any,
    );

    this.tasks.set('daily-reminders', dailyTask);

    // 启动任务
    dailyTask.start();

    console.log('✅ 定时任务调度器启动成功');
  }

  /**
   * 停止定时任务
   */
  public stop(): void {
    console.log('🛑 停止定时任务调度器...');
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`  - 已停止任务: ${name}`);
    });
    this.tasks.clear();
    console.log('✅ 定时任务调度器已停止');
  }

  /**
   * 手动执行提醒更新
   */
  public async executeManually(): Promise<void> {
    console.log('🔧 手动执行提醒更新任务...');
    await this.updateDailyReminders();
    console.log('✅ 手动执行完成');
  }

  /**
   * 更新休假状态（将已结束的休假标记为completed）
   */
  private async updateLeaveStatus(): Promise<void> {
    // 使用上海时区的当前日期
    const currentDate = new Date()
      .toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');

    const result = await db
      .update(leaves)
      .set({ status: 'completed' })
      .where(
        and(
          eq(leaves.status, 'active'),
          sql`${leaves.endDate} < ${currentDate}`,
        ),
      );

    console.log(
      `📅 已更新 ${(result as any).rowCount || 0} 条已结束的休假记录`,
    );
  }

  /**
   * 每日提醒更新任务
   */
  private async updateDailyReminders(): Promise<void> {
    // 使用上海时区的当前日期
    const currentDate = new Date()
      .toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');
    let reminderCount = 0;

    try {
      // 1. 清理今日已存在的提醒记录（避免重复）
      await db.delete(reminders).where(eq(reminders.reminderDate, currentDate));

      // 2. 更新已结束的休假状态（合并到每日任务中）
      await this.updateLeaveStatus();

      // 3. 处理休假相关提醒
      await this.processLeaveReminders(currentDate);

      // 4. 处理基于阈值的联系提醒
      reminderCount = await this.processContactReminders(currentDate);

      // 5. 清理过期的系统日志记录（保留最近7天）
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo
        .toLocaleDateString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\//g, '-');

      await db
        .delete(reminders)
        .where(
          and(
            eq(reminders.reminderType, 'system'),
            sql`${reminders.reminderDate} < ${sevenDaysAgoStr}`,
          ),
        );

      // 6. 记录执行日志
      await db.insert(reminders).values({
        personId: null,
        leaveId: null,
        reminderType: 'system',
        reminderDate: currentDate,
        priority: 'low',
        isHandled: true,
      });

      console.log(`🎯 提醒更新完成，共创建 ${reminderCount} 条新提醒记录`);
    } catch (error) {
      console.error('❌ 提醒更新过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 处理休假相关提醒
   */
  private async processLeaveReminders(currentDate: string): Promise<void> {
    // 获取所有活跃的休假记录
    const activeLeaves = await db
      .select({
        id: leaves.id,
        personId: leaves.personId,
        startDate: leaves.startDate,
        endDate: leaves.endDate,
        leaveType: leaves.leaveType,
        personName: persons.name,
        lastContactDate: persons.lastContactDate,
      })
      .from(leaves)
      .leftJoin(persons, eq(leaves.personId, persons.id))
      .where(
        and(
          eq(leaves.status, 'active'),
          sql`DATE(${leaves.endDate}) >= DATE(${currentDate})`,
        ),
      );

    for (const leave of activeLeaves) {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);

      // 休假前提醒（休假开始前1天）
      const beforeDate = new Date(startDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      const beforeDateStr = beforeDate
        .toLocaleDateString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\//g, '-');

      if (beforeDateStr === currentDate) {
        await db.insert(reminders).values({
          personId: leave.personId,
          leaveId: leave.id,
          reminderType: 'before',
          reminderDate: currentDate,
          priority: 'medium',
          isHandled: false,
        });
        console.log(`📋 创建休假前提醒: ${leave.personName} (明日开始休假)`);
      }

      // 休假结束前提醒（休假结束前1天）
      const endingDate = new Date(endDate);
      endingDate.setDate(endingDate.getDate() - 1);
      const endingDateStr = endingDate
        .toLocaleDateString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\//g, '-');

      if (endingDateStr === currentDate) {
        await db.insert(reminders).values({
          personId: leave.personId,
          leaveId: leave.id,
          reminderType: 'ending',
          reminderDate: currentDate,
          priority: 'medium',
          isHandled: false,
        });
        console.log(
          `📋 创建休假结束前提醒: ${leave.personName} (明日结束休假)`,
        );
      }

      // 注意：移除了休假中每3天提醒的逻辑，避免与基于阈值的联系提醒重复
      // 休假期间的联系提醒已经通过 processContactReminders 中的排除逻辑处理
    }
  }

  /**
   * 处理基于阈值的联系提醒
   */
  private async processContactReminders(currentDate: string): Promise<number> {
    let reminderCount = 0;

    // 获取所有非休假期间的人员及其配置
    const personsWithSettings = await db
      .select({
        id: persons.id,
        name: persons.name,
        departmentId: persons.departmentId,
        lastContactDate: persons.lastContactDate,
        createdBy: persons.createdBy,
        urgentThreshold: reminderSettings.urgentThreshold,
        suggestThreshold: reminderSettings.suggestThreshold,
      })
      .from(persons)
      .leftJoin(
        reminderSettings,
        eq(persons.createdBy, reminderSettings.userId),
      )
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${leaves} l
          WHERE l.person_id = ${persons.id}
          AND l.status = 'active'
          AND ${currentDate} BETWEEN l.start_date AND l.end_date
        )`,
      );

    for (const person of personsWithSettings) {
      // 计算距离上次联系的天数（排除管理员联系记录）
      const daysSinceContact = await this.calculateDaysSinceLastContact(
        person.id,
        person.departmentId,
        currentDate,
      );

      // 使用配置的阈值，如果没有配置则使用默认值
      const urgentThreshold = person.urgentThreshold || 10;
      const suggestThreshold = person.suggestThreshold || 7;

      if (daysSinceContact >= urgentThreshold) {
        // 紧急提醒
        await db.insert(reminders).values({
          personId: person.id,
          leaveId: null,
          reminderType: 'overdue',
          reminderDate: currentDate,
          priority: 'high',
          isHandled: false,
        });
        console.log(
          `🚨 创建紧急联系提醒: ${person.name} (已${daysSinceContact}天未联系)`,
        );
        reminderCount++;
      } else if (daysSinceContact >= suggestThreshold) {
        // 建议提醒
        await db.insert(reminders).values({
          personId: person.id,
          leaveId: null,
          reminderType: 'overdue',
          reminderDate: currentDate,
          priority: 'medium',
          isHandled: false,
        });
        console.log(
          `💡 创建建议联系提醒: ${person.name} (已${daysSinceContact}天未联系)`,
        );
        reminderCount++;
      }
    }

    // 处理休假中途添加的人员（没有联系记录但正在休假中）
    const midLeavePersons = await this.processMidLeavePersons(currentDate);
    reminderCount += midLeavePersons;

    return reminderCount;
  }

  /**
   * 处理休假中途添加的人员
   * 为正在休假但没有联系记录的人员创建medium优先级提醒
   */
  private async processMidLeavePersons(currentDate: string): Promise<number> {
    let reminderCount = 0;

    // 查找正在休假中但没有联系记录的人员
    const midLeavePersons = await db
      .select({
        id: persons.id,
        name: persons.name,
        departmentId: persons.departmentId,
        leaveId: leaves.id,
        startDate: leaves.startDate,
        endDate: leaves.endDate,
      })
      .from(persons)
      .innerJoin(leaves, eq(leaves.personId, persons.id))
      .where(
        and(
          // 休假状态为活跃
          eq(leaves.status, 'active'),
          // 当前日期在休假期间
          sql`${currentDate} BETWEEN ${leaves.startDate} AND ${leaves.endDate}`,
          // 休假已经开始（不是今天开始）
          sql`${leaves.startDate} < ${currentDate}`,
          // 没有联系记录
          sql`NOT EXISTS (
            SELECT 1 FROM ${contacts} c
            WHERE c.person_id = ${persons.id}
          )`,
        ),
      );

    for (const person of midLeavePersons) {
      // 为这些人员创建medium优先级的联系提醒
      await db.insert(reminders).values({
        personId: person.id,
        leaveId: person.leaveId,
        reminderType: 'during',
        reminderDate: currentDate,
        priority: 'medium',
        isHandled: false,
      });

      console.log(
        `📋 创建休假中途添加人员提醒: ${person.name} (休假期间: ${person.startDate} - ${person.endDate})`,
      );
      reminderCount++;
    }

    return reminderCount;
  }

  /**
   * 计算距离上次联系的天数（排除管理员联系记录）
   * 只要是本部门的联系记录都算，无需具体到用户
   */
  private async calculateDaysSinceLastContact(
    personId: string,
    personDepartmentId: string | null,
    currentDate: string,
  ): Promise<number> {
    if (!personDepartmentId) {
      return 999; // 如果人员没有部门，返回最大值
    }

    // 查询该人员最近的非管理员联系记录
    const lastContact = await db
      .select({
        contactDate: contacts.contactDate,
      })
      .from(contacts)
      .leftJoin(users, eq(contacts.contactBy, users.id))
      .where(
        and(
          eq(contacts.personId, personId),
          // 排除管理员的联系记录
          ne(users.role, 'admin'),
          // 只考虑本部门的联系记录
          eq(users.departmentId, personDepartmentId),
        ),
      )
      .orderBy(desc(contacts.contactDate))
      .limit(1);

    if (lastContact.length === 0) {
      return 999; // 如果没有找到联系记录，返回最大值
    }

    const lastContactDate = new Date(lastContact[0].contactDate);
    const current = new Date(currentDate);
    const daysDiff = Math.floor(
      (current.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, daysDiff);
  }
}

export default ReminderScheduler;
