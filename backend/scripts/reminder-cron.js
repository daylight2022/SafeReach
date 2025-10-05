#!/usr/bin/env node

/**
 * SafeReach 提醒定时任务脚本
 * 用于在云服务器上通过 crontab 或 PM2 定时执行
 * 
 * 使用方法：
 * 开发环境: npm run cron:dev (使用 tsx)
 * 生产环境: npm run cron:prod (使用 node)
 * 手动运行: npm run cron:once
 */

import { config } from 'dotenv-flow';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, gte, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入 schema - 根据环境选择正确的路径
let persons, leaves, reminders, reminderSettings;

// 辅助函数：将路径转换为 file:// URL（兼容 Windows）
const toFileURL = (filePath) => {
  const absolutePath = path.resolve(filePath);
  return pathToFileURL(absolutePath).href;
};

try {
  // 生产环境：从 dist 目录导入
  const schemaPath = path.join(__dirname, '../dist/db/schema.js');
  const schemaURL = toFileURL(schemaPath);
  const schemaModule = await import(schemaURL);
  ({ persons, leaves, reminders, reminderSettings } = schemaModule);
  console.log('📦 已加载生产环境 schema (dist/db/schema.js)');
} catch (error) {
  try {
    // 开发环境：从 src 目录导入
    const schemaPath = path.join(__dirname, '../src/db/schema.js');
    const schemaURL = toFileURL(schemaPath);
    const schemaModule = await import(schemaURL);
    ({ persons, leaves, reminders, reminderSettings } = schemaModule);
    console.log('📦 已加载开发环境 schema (src/db/schema.js)');
  } catch (devError) {
    console.error('❌ 无法加载 schema 文件:', devError);
    console.error('提示: 请先运行 npm run build 编译项目，或使用 npm run cron:dev 在开发模式下运行');
    process.exit(1);
  }
}

// 加载环境变量
config();

// 数据库连接
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ 错误: 未找到 DATABASE_URL 环境变量');
  process.exit(1);
}

// 配置数据库连接，设置时区为东八区
// 在连接字符串中添加时区参数，确保使用东八区时间
const connectionWithTimezone = connectionString.includes('?')
  ? `${connectionString}&options=-c timezone=Asia/Shanghai`
  : `${connectionString}?options=-c timezone=Asia/Shanghai`;

const client = postgres(connectionWithTimezone);
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
 * 获取所有用户的提醒阈值设置（直接从数据库读取）
 * 返回一个 Map，key 为 userId，value 为对应的阈值设置
 */
async function getUserReminderSettings() {
  try {
    const allSettings = await db.select().from(reminderSettings);
    
    const settingsMap = new Map();
    for (const setting of allSettings) {
      settingsMap.set(setting.userId, {
        urgentThreshold: setting.urgentThreshold || 10,
        suggestThreshold: setting.suggestThreshold || 7,
      });
    }
    
    console.log(`📋 已加载 ${settingsMap.size} 个用户的提醒阈值设置`);
    return settingsMap;
  } catch (error) {
    console.error('❌ 获取提醒阈值设置失败，使用默认值:', error);
    return new Map();
  }
}

/**
 * 创建或更新提醒记录
 * 如果已存在相同 personId, leaveId 且未处理的记录，则更新；否则创建新记录
 */
async function upsertReminder(reminderData) {
  try {
    // 查找是否存在未处理的同类提醒记录
    const conditions = [
      eq(reminders.personId, reminderData.personId),
      eq(reminders.isHandled, false),
    ];
    
    // 如果有 leaveId，则同时匹配 leaveId
    if (reminderData.leaveId) {
      conditions.push(eq(reminders.leaveId, reminderData.leaveId));
    } else {
      // 如果 leaveId 为 null，则需要匹配 leaveId 也为 null 的记录
      conditions.push(sql`${reminders.leaveId} IS NULL`);
    }
    
    const existingReminders = await db
      .select()
      .from(reminders)
      .where(and(...conditions))
      .limit(1);
    
    if (existingReminders.length > 0) {
      // 更新现有记录
      const [updatedReminder] = await db
        .update(reminders)
        .set({
          reminderType: reminderData.reminderType,
          reminderDate: reminderData.reminderDate,
          priority: reminderData.priority,
        })
        .where(eq(reminders.id, existingReminders[0].id))
        .returning();
      
      return { action: 'updated', reminder: updatedReminder };
    } else {
      // 创建新记录
      const [newReminder] = await db
        .insert(reminders)
        .values(reminderData)
        .returning();
      
      return { action: 'created', reminder: newReminder };
    }
  } catch (error) {
    console.error('❌ 创建或更新提醒记录失败:', error);
    throw error;
  }
}

/**
 * 获取当前日期（考虑服务器时区）
 * 根据服务器时区返回正确的日期字符串 YYYY-MM-DD
 */
function getCurrentDate() {
  // 使用服务器本地时区
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取昨天的日期（考虑服务器时区）
 */
function getYesterdayDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 删除昨天休假已结束的人员及其相关记录
 */
async function deleteCompletedPersons() {
  const yesterdayDate = getYesterdayDate();
  
  try {
    // 查找昨天结束休假的人员
    const completedPersons = await db
      .select({
        personId: leaves.personId,
        personName: persons.name,
      })
      .from(leaves)
      .leftJoin(persons, eq(leaves.personId, persons.id))
      .where(
        and(
          eq(leaves.status, 'active'),
          eq(leaves.endDate, yesterdayDate)
        )
      );

    if (completedPersons.length === 0) {
      console.log('📋 昨天没有人员休假结束，无需删除');
      return { deletedCount: 0 };
    }

    const personIds = completedPersons.map(p => p.personId).filter(id => id !== null);
    const personNames = completedPersons.map(p => p.personName).filter(name => name !== null);

    console.log(`🗑️  准备删除 ${personIds.length} 位昨天休假结束的人员: ${personNames.join(', ')}`);

    // 删除人员记录（由于设置了级联删除，会自动删除关联的 leaves, contacts, reminders）
    for (const personId of personIds) {
      await db.delete(persons).where(eq(persons.id, personId));
    }

    console.log(`✅ 已删除 ${personIds.length} 位人员及其相关记录 (leaves, contacts, reminders)`);
    return { deletedCount: personIds.length, deletedNames: personNames };
  } catch (error) {
    console.error('❌ 删除休假结束人员失败:', error);
    throw error;
  }
}

/**
 * 更新休假状态（将已结束的休假标记为completed）
 * 注意：此函数现在主要用于标记其他日期结束的休假（非昨天）
 */
async function updateLeaveStatus() {
  const currentDate = getCurrentDate();
  const yesterdayDate = getYesterdayDate();
  
  try {
    // 只更新昨天之前结束的休假（昨天结束的会被删除）
    const result = await db
      .update(leaves)
      .set({ status: 'completed' })
      .where(
        and(
          eq(leaves.status, 'active'),
          sql`${leaves.endDate} < ${yesterdayDate}`
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
async function processLeaveReminders() {
  const currentDate = getCurrentDate();
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
        const result = await upsertReminder({
          personId: leave.personId,
          leaveId: leave.id,
          reminderType: 'before',
          reminderDate: currentDate,
          priority: 'medium',
          isHandled: false,
        });
        console.log(`📋 ${result.action === 'created' ? '创建' : '更新'}休假前提醒: ${leave.personName} (明日开始休假)`);
      }

      // 休假结束前提醒（休假结束前1天）
      const endingDate = new Date(endDate);
      endingDate.setDate(endingDate.getDate() - 1);
      if (endingDate.toISOString().split('T')[0] === currentDate) {
        const result = await upsertReminder({
          personId: leave.personId,
          leaveId: leave.id,
          reminderType: 'ending',
          reminderDate: currentDate,
          priority: 'medium',
          isHandled: false,
        });
        console.log(`📋 ${result.action === 'created' ? '创建' : '更新'}休假结束前提醒: ${leave.personName} (明日结束休假)`);
      }

      // 休假中提醒（休假期间每3天提醒一次）
      // if (current >= startDate && current <= endDate) {
      //   const daysSinceStart = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      //   if (daysSinceStart > 0 && daysSinceStart % 3 === 0) {
      //     await db.insert(reminders).values({
      //       personId: leave.personId,
      //       leaveId: leave.id,
      //       reminderType: 'during',
      //       reminderDate: currentDate,
      //       priority: 'medium',
      //       isHandled: false,
      //     });
      //     console.log(`📋 创建休假中提醒: ${leave.personName} (休假第${daysSinceStart + 1}天)`);
      //   }
      // }
    }
  } catch (error) {
    console.error('❌ 处理休假提醒失败:', error);
    throw error;
  }
}

/**
 * 处理基于阈值的联系提醒
 */
async function processContactReminders(userSettingsMap) {
  const currentDate = getCurrentDate();
  let createdCount = 0;
  let updatedCount = 0;

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

      // 优先使用用户的配置，其次使用数据库 JOIN 的配置，最后使用默认值
      let urgentThreshold = 10;
      let suggestThreshold = 7;
      
      if (person.createdBy && userSettingsMap.has(person.createdBy)) {
        const userSettings = userSettingsMap.get(person.createdBy);
        urgentThreshold = userSettings.urgentThreshold;
        suggestThreshold = userSettings.suggestThreshold;
      } else if (person.urgentThreshold && person.suggestThreshold) {
        urgentThreshold = person.urgentThreshold;
        suggestThreshold = person.suggestThreshold;
      }

      if (daysSinceContact >= urgentThreshold) {
        // 紧急提醒
        const result = await upsertReminder({
          personId: person.id,
          leaveId: null,
          reminderType: 'overdue',
          reminderDate: currentDate,
          priority: 'high',
          isHandled: false,
        });
        
        if (result.action === 'created') {
          console.log(`🚨 创建紧急联系提醒: ${person.name} (已${daysSinceContact}天未联系)`);
          createdCount++;
        } else {
          console.log(`🚨 更新紧急联系提醒: ${person.name} (已${daysSinceContact}天未联系)`);
          updatedCount++;
        }
      } else if (daysSinceContact >= suggestThreshold) {
        // 建议提醒
        const result = await upsertReminder({
          personId: person.id,
          leaveId: null,
          reminderType: 'overdue',
          reminderDate: currentDate,
          priority: 'medium',
          isHandled: false,
        });
        
        if (result.action === 'created') {
          console.log(`💡 创建建议联系提醒: ${person.name} (已${daysSinceContact}天未联系)`);
          createdCount++;
        } else {
          console.log(`💡 更新建议联系提醒: ${person.name} (已${daysSinceContact}天未联系)`);
          updatedCount++;
        }
      }
    }

    return { createdCount, updatedCount };
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

  const startTime = new Date();
  const currentDate = getCurrentDate();
  const yesterdayDate = getYesterdayDate();

  console.log(`🔔 开始执行提醒更新任务 - ${startTime.toISOString()}`);
  console.log(`📅 当前日期: ${currentDate}`);
  console.log(`📅 昨天日期: ${yesterdayDate}`);
  console.log(`🌍 服务器时区: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  try {
    // 1. 删除昨天休假结束的人员及其相关记录
    const { deletedCount, deletedNames } = await deleteCompletedPersons();
    
    // 2. 获取所有用户的提醒阈值设置
    const userSettingsMap = await getUserReminderSettings();

    // 3. 更新休假状态（昨天之前结束的休假）
    await updateLeaveStatus();

    // 4. 处理休假相关提醒
    await processLeaveReminders();

    // 5. 处理基于阈值的联系提醒
    const { createdCount, updatedCount } = await processContactReminders(userSettingsMap);

    // 注意：提醒记录永久保留用于季度和年度统计分析，不再清理

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log(`✅ 提醒更新任务完成`);
    console.log(`📊 删除了 ${deletedCount} 位休假结束的人员${deletedNames && deletedNames.length > 0 ? ': ' + deletedNames.join(', ') : ''}`);
    console.log(`📊 创建了 ${createdCount} 条新提醒，更新了 ${updatedCount} 条提醒记录`);
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
