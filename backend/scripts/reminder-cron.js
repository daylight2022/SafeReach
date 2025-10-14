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
 * 更新昨天休假已结束的记录状态为 completed
 * 同时将关联的未处理提醒标记为已处理
 */
async function updateCompletedLeaves() {
  const yesterdayDate = getYesterdayDate();
  
  try {
    // 查找昨天结束的休假记录
    const completedLeaves = await db
      .select({
        leaveId: leaves.id,
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

    if (completedLeaves.length === 0) {
      console.log('📋 昨天没有休假结束，无需更新');
      return { updatedCount: 0, handledRemindersCount: 0 };
    }

    const leaveIds = completedLeaves.map(l => l.leaveId).filter(id => id !== null);
    const personIds = completedLeaves.map(l => l.personId).filter(id => id !== null);
    const personNames = completedLeaves.map(l => l.personName).filter(name => name !== null);

    console.log(`📝 准备更新 ${leaveIds.length} 条昨天结束的休假记录状态: ${personNames.join(', ')}`);

    // 更新休假记录状态为 completed
    for (const leaveId of leaveIds) {
      await db.update(leaves).set({ status: 'completed' }).where(eq(leaves.id, leaveId));
    }

    console.log(`✅ 已更新 ${leaveIds.length} 条休假记录状态为 completed`);

    // 将这些休假关联的未处理提醒标记为已处理
    let handledRemindersCount = 0;
    if (leaveIds.length > 0) {
      for (const leaveId of leaveIds) {
        const result = await db
          .update(reminders)
          .set({
            isHandled: true,
            handledAt: new Date(),
          })
          .where(
            and(
              eq(reminders.leaveId, leaveId),
              eq(reminders.isHandled, false)
            )
          );
        
        const count = result.rowCount || 0;
        handledRemindersCount += count;
      }
      
      console.log(`✅ 已将 ${handledRemindersCount} 条关联的提醒标记为已处理`);
    }

    // 同时处理没有 leaveId 但 personId 匹配的未处理提醒
    // （针对一些历史数据或特殊情况）
    if (personIds.length > 0) {
      for (const personId of personIds) {
        const result = await db
          .update(reminders)
          .set({
            isHandled: true,
            handledAt: new Date(),
          })
          .where(
            and(
              eq(reminders.personId, personId),
              eq(reminders.isHandled, false),
              sql`${reminders.leaveId} IS NULL`
            )
          );
        
        const count = result.rowCount || 0;
        if (count > 0) {
          handledRemindersCount += count;
          console.log(`✅ 额外处理了人员 ${personId} 的 ${count} 条无 leaveId 的提醒`);
        }
      }
    }

    return { updatedCount: leaveIds.length, updatedNames: personNames, handledRemindersCount };
  } catch (error) {
    console.error('❌ 更新休假结束状态失败:', error);
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
 * 统一的提醒处理函数
 * 只处理当前正在休假中的人员（在外人员）
 */
async function processAllReminders(userSettingsMap) {
  const currentDate = getCurrentDate();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    // 只获取当前正在休假中的人员（在外人员）
    const activeLeavePersons = await db
      .select({
        personId: persons.id,
        personName: persons.name,
        lastContactDate: persons.lastContactDate,
        createdAt: persons.createdAt,
        createdBy: persons.createdBy,
        urgentThreshold: reminderSettings.urgentThreshold,
        suggestThreshold: reminderSettings.suggestThreshold,
        // 当前活跃的休假信息
        leaveId: leaves.id,
        leaveStartDate: leaves.startDate,
        leaveEndDate: leaves.endDate,
      })
      .from(leaves)
      .innerJoin(persons, eq(leaves.personId, persons.id))
      .leftJoin(reminderSettings, eq(persons.createdBy, reminderSettings.userId))
      .where(
        and(
          eq(leaves.status, 'active'),
          sql`${currentDate} >= ${leaves.startDate}`,
          sql`${currentDate} <= ${leaves.endDate}`
        )
      );

    console.log(`📋 当前正在休假的人员数量: ${activeLeavePersons.length}`);

    for (const person of activeLeavePersons) {
      // 检查是否有未处理提醒
      const existingReminders = await db
        .select()
        .from(reminders)
        .where(
          and(
            eq(reminders.personId, person.personId),
            eq(reminders.isHandled, false)
          )
        )
        .limit(1);

      // 获取用户的提醒阈值配置
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

      // 确定基准日期和计算天数（所有人都在休假中）
      let baseDate = null;
      let daysSinceBase = 0;

      if (person.lastContactDate) {
        // 情况1: 有上次联系记录，直接使用
        baseDate = new Date(person.lastContactDate);
      } else {
        // 情况2: 无联系记录
        const leaveStartDate = new Date(person.leaveStartDate);
        const personCreatedAt = new Date(person.createdAt);
        
        if (personCreatedAt < leaveStartDate) {
          // 情况2.1: 人员添加在休假开始之前，以休假开始日期为基准
          baseDate = leaveStartDate;
        } else {
          // 情况2.2: 人员在休假中添加，以添加日期为基准
          baseDate = personCreatedAt;
        }
      }

      // 计算距离基准日期的天数（使用日历日期差，不是绝对24小时）
      const current = new Date(currentDate);
      const baseDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      daysSinceBase = Math.floor((currentDay.getTime() - baseDay.getTime()) / (1000 * 60 * 60 * 24));

      // 计算休假总天数
      const startDate = new Date(person.leaveStartDate);
      const endDate = new Date(person.leaveEndDate);
      const leaveDuration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const isShortLeave = leaveDuration >= 3 && leaveDuration <= 6;
      
      // 判断是否明天结束休假
      const endingDate = new Date(endDate);
      endingDate.setDate(endingDate.getDate() - 1);
      const isEndingTomorrow = endingDate.toISOString().split('T')[0] === currentDate;

      // 判断应该设置什么提醒类型和优先级
      let shouldCreateOrUpdateReminder = false;
      let reminderType = 'overdue';
      let priority = 'medium';

      // 优先级1: 达到紧急阈值
      if (daysSinceBase >= urgentThreshold) {
        shouldCreateOrUpdateReminder = true;
        reminderType = 'overdue';
        priority = 'high';
        console.log(`🚨 处理紧急提醒: ${person.personName} (距离基准日期${daysSinceBase}天，休假${leaveDuration}天)`);
      } 
      // 优先级2: 达到建议阈值
      else if (daysSinceBase >= suggestThreshold) {
        shouldCreateOrUpdateReminder = true;
        reminderType = 'overdue';
        priority = 'medium';
        console.log(`💡 处理建议提醒: ${person.personName} (距离基准日期${daysSinceBase}天，休假${leaveDuration}天)`);
      } 
      // 优先级3: 短假特殊处理（3-6天的假期，第3天开始提醒）
      else if (isShortLeave && daysSinceBase >= 3) {
        shouldCreateOrUpdateReminder = true;
        reminderType = 'during';
        priority = 'medium';
        console.log(`🏖️ 处理短假提醒: ${person.personName} (短假${leaveDuration}天，距离基准日期${daysSinceBase}天)`);
      }
      // 优先级4: 休假结束前一天，且距离基准日期至少5天
      else if (isEndingTomorrow && daysSinceBase >= 5) {
        shouldCreateOrUpdateReminder = true;
        reminderType = 'ending';
        priority = 'medium';
        console.log(`📋 处理休假结束前提醒: ${person.personName} (明日结束休假，距离基准日期${daysSinceBase}天)`);
      } 
      else {
        console.log(`⏭️  跳过: ${person.personName} (休假${leaveDuration}天，距离基准日期${daysSinceBase}天，未达到条件)`);
      }

      // 创建或更新提醒
      if (shouldCreateOrUpdateReminder) {
        if (existingReminders.length > 0) {
          // 如果已有未处理提醒，检查是否需要更新优先级
          const existingReminder = existingReminders[0];
          
          // 如果优先级或类型发生变化，则更新
          if (existingReminder.priority !== priority || existingReminder.reminderType !== reminderType) {
            await db
              .update(reminders)
              .set({
                reminderType: reminderType,
                reminderDate: currentDate,
                priority: priority,
              })
              .where(eq(reminders.id, existingReminder.id));
            
            console.log(`🔄 更新提醒: ${person.personName} (优先级: ${existingReminder.priority} -> ${priority})`);
            updatedCount++;
          } else {
            console.log(`✓ 保持现有提醒: ${person.personName} (优先级: ${priority})`);
            skippedCount++;
          }
        } else {
          // 创建新提醒
          const result = await upsertReminder({
            personId: person.personId,
            leaveId: person.leaveId,
            reminderType: reminderType,
            reminderDate: currentDate,
            priority: priority,
            isHandled: false,
          });
          
          if (result.action === 'created') {
            createdCount++;
          } else {
            updatedCount++;
          }
        }
      } else if (existingReminders.length > 0) {
        // 未达到条件但有旧提醒，保持不变
        skippedCount++;
      }
    }

    console.log(`✅ 提醒处理完成: 创建${createdCount}条，更新${updatedCount}条，跳过${skippedCount}条`);
    return { createdCount, updatedCount, skippedCount };
  } catch (error) {
    console.error('❌ 处理提醒失败:', error);
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
    // 1. 更新昨天休假结束的记录状态为 completed
    const { updatedCount: completedLeavesCount, updatedNames, handledRemindersCount } = await updateCompletedLeaves();
    
    // 2. 获取所有用户的提醒阈值设置
    const userSettingsMap = await getUserReminderSettings();

    // 3. 更新休假状态（昨天之前结束的休假）
    await updateLeaveStatus();

    // 4. 统一处理所有提醒（休假+联系提醒）
    const { createdCount, updatedCount, skippedCount } = await processAllReminders(userSettingsMap);

    // 注意：提醒记录永久保留用于季度和年度统计分析，不再清理

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log(`✅ 提醒更新任务完成`);
    console.log(`📊 更新了 ${completedLeavesCount} 条休假记录状态为 completed${updatedNames && updatedNames.length > 0 ? ': ' + updatedNames.join(', ') : ''}`);
    console.log(`📊 自动处理了 ${handledRemindersCount} 条休假结束关联的提醒`);
    console.log(`📊 创建了 ${createdCount} 条新提醒，更新了 ${updatedCount} 条提醒，跳过了 ${skippedCount} 个已有提醒的人员`);
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
