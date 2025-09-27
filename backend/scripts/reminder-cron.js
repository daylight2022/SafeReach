#!/usr/bin/env node

/**
 * SafeReach 提醒定时任务脚本
 * 用于在云服务器上通过 crontab 执行
 * 
 * 使用方法：
 * 1. 确保 Node.js 环境已安装
 * 2. 在项目根目录运行: node scripts/reminder-cron.js
 * 3. 或通过 crontab 定时执行
 */

import { config } from 'dotenv-flow';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, gte, sql } from 'drizzle-orm';
import { persons, leaves, reminders, reminderSettings } from '../src/db/schema.js';
import fs from 'fs';
import path from 'path';

// 加载环境变量
config();

// 数据库连接
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ 错误: 未找到 DATABASE_URL 环境变量');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

// 进程锁文件路径
const LOCK_FILE = path.join(process.cwd(), 'reminder-cron.lock');

/**
 * 检查并创建进程锁
 */
function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockContent = fs.readFileSync(LOCK_FILE, 'utf8');
      const lockData = JSON.parse(lockContent);
      const lockTime = new Date(lockData.timestamp);
      const now = new Date();

      // 如果锁文件超过1小时，认为是僵尸锁，删除它
      if (now.getTime() - lockTime.getTime() > 60 * 60 * 1000) {
        console.log('🧹 检测到僵尸锁文件，正在清理...');
        fs.unlinkSync(LOCK_FILE);
      } else {
        console.log('❌ 另一个提醒任务正在执行中，退出...');
        process.exit(0);
      }
    }

    // 创建锁文件
    const lockData = {
      pid: process.pid,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lockData));
    console.log(`🔒 已获取进程锁 (PID: ${process.pid})`);
    return true;
  } catch (error) {
    console.error('❌ 获取进程锁失败:', error);
    return false;
  }
}

/**
 * 释放进程锁
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      console.log('🔓 已释放进程锁');
    }
  } catch (error) {
    console.error('❌ 释放进程锁失败:', error);
  }
}

/**
 * 更新休假状态（将已结束的休假标记为completed）
 */
async function updateLeaveStatus() {
  const currentDate = new Date().toISOString().split('T')[0];
  
  try {
    const result = await db
      .update(leaves)
      .set({ status: 'completed' })
      .where(
        and(
          eq(leaves.status, 'active'),
          sql`${leaves.endDate} < ${currentDate}`
        )
      );

    console.log(`📅 已更新 ${result.rowCount || 0} 条已结束的休假记录`);
  } catch (error) {
    console.error('❌ 更新休假状态失败:', error);
    throw error;
  }
}

/**
 * 处理休假相关提醒
 */
async function processLeaveReminders(currentDate) {
  try {
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
          gte(leaves.endDate, currentDate)
        )
      );

    for (const leave of activeLeaves) {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      const current = new Date(currentDate);
      
      // 休假前提醒（休假开始前1天）
      const beforeDate = new Date(startDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      if (beforeDate.toISOString().split('T')[0] === currentDate) {
        await db.insert(reminders).values({
          personId: leave.personId,
          leaveId: leave.id,
          reminderType: 'before',
          reminderDate: currentDate,
          priority: 'high',
          isHandled: false,
        });
        console.log(`📋 创建休假前提醒: ${leave.personName} (明日开始休假)`);
      }

      // 休假结束前提醒（休假结束前1天）
      const endingDate = new Date(endDate);
      endingDate.setDate(endingDate.getDate() - 1);
      if (endingDate.toISOString().split('T')[0] === currentDate) {
        await db.insert(reminders).values({
          personId: leave.personId,
          leaveId: leave.id,
          reminderType: 'ending',
          reminderDate: currentDate,
          priority: 'high',
          isHandled: false,
        });
        console.log(`📋 创建休假结束前提醒: ${leave.personName} (明日结束休假)`);
      }

      // 休假中提醒（休假期间每3天提醒一次）
      if (current >= startDate && current <= endDate) {
        const daysSinceStart = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceStart > 0 && daysSinceStart % 3 === 0) {
          await db.insert(reminders).values({
            personId: leave.personId,
            leaveId: leave.id,
            reminderType: 'during',
            reminderDate: currentDate,
            priority: 'medium',
            isHandled: false,
          });
          console.log(`📋 创建休假中提醒: ${leave.personName} (休假第${daysSinceStart + 1}天)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ 处理休假提醒失败:', error);
    throw error;
  }
}

/**
 * 处理基于阈值的联系提醒
 */
async function processContactReminders(currentDate) {
  let reminderCount = 0;

  try {
    // 获取所有非休假期间的人员及其配置
    const personsWithSettings = await db
      .select({
        id: persons.id,
        name: persons.name,
        lastContactDate: persons.lastContactDate,
        createdBy: persons.createdBy,
        urgentThreshold: reminderSettings.urgentThreshold,
        suggestThreshold: reminderSettings.suggestThreshold,
      })
      .from(persons)
      .leftJoin(reminderSettings, eq(persons.createdBy, reminderSettings.userId))
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${leaves} l 
          WHERE l.person_id = ${persons.id} 
          AND l.status = 'active' 
          AND ${currentDate} BETWEEN l.start_date AND l.end_date
        )`
      );

    for (const person of personsWithSettings) {
      // 计算距离上次联系的天数
      let daysSinceContact = 999;
      if (person.lastContactDate) {
        const lastContact = new Date(person.lastContactDate);
        const current = new Date(currentDate);
        daysSinceContact = Math.floor((current.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
      }

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
        console.log(`🚨 创建紧急联系提醒: ${person.name} (已${daysSinceContact}天未联系)`);
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
        console.log(`💡 创建建议联系提醒: ${person.name} (已${daysSinceContact}天未联系)`);
        reminderCount++;
      }
    }

    return reminderCount;
  } catch (error) {
    console.error('❌ 处理联系提醒失败:', error);
    throw error;
  }
}

/**
 * 主执行函数
 */
async function main() {
  // 获取进程锁
  if (!acquireLock()) {
    process.exit(1);
  }

  const currentDate = new Date().toISOString().split('T')[0];
  const startTime = new Date();

  console.log(`🔔 开始执行提醒更新任务 - ${startTime.toISOString()}`);
  console.log(`📅 当前日期: ${currentDate}`);

  try {
    // 1. 清理今日已存在的提醒记录（避免重复）
    const deleteResult = await db
      .delete(reminders)
      .where(eq(reminders.reminderDate, currentDate));
    
    console.log(`🧹 清理今日已存在的提醒记录: ${deleteResult.rowCount || 0} 条`);

    // 2. 更新休假状态
    await updateLeaveStatus();

    // 3. 处理休假相关提醒
    await processLeaveReminders(currentDate);

    // 4. 处理基于阈值的联系提醒
    const reminderCount = await processContactReminders(currentDate);

    // 5. 清理过期的提醒记录（保留最近30天的数据用于统计分析）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const cleanupResult = await db
      .delete(reminders)
      .where(
        sql`${reminders.reminderDate} < ${thirtyDaysAgoStr}`
      );

    console.log(`🧹 清理30天前的过期提醒记录: ${cleanupResult.rowCount || 0} 条`);

    // 6. 记录执行日志
    await db.insert(reminders).values({
      personId: null,
      leaveId: null,
      reminderType: 'system',
      reminderDate: currentDate,
      priority: 'low',
      isHandled: true,
    });

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log(`✅ 提醒更新任务完成`);
    console.log(`📊 共创建 ${reminderCount} 条新提醒记录`);
    console.log(`⏱️  执行耗时: ${duration}ms`);
    console.log(`🕐 完成时间: ${endTime.toISOString()}`);

  } catch (error) {
    console.error('❌ 提醒更新任务执行失败:', error);
    process.exit(1);
  } finally {
    // 释放进程锁
    releaseLock();
    // 关闭数据库连接
    await client.end();
  }
}

// 执行主函数
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
