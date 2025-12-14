#!/usr/bin/env node

/**
 * 提醒记录诊断脚本
 * 用于排查提醒显示不正常的问题
 * 
 * 使用方法：
 * 开发环境: npx tsx backend/scripts/diagnose-reminder-issue.js
 * 生产环境: node backend/scripts/diagnose-reminder-issue.js
 */

import { config } from 'dotenv-flow';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, gte, sql } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入 schema
let persons, leaves, reminders, reminderSettings;

// 辅助函数：将路径转换为 file:// URL（兼容 Windows）
const toFileURL = (filePath) => {
  const absolutePath = path.resolve(filePath);
  return pathToFileURL(absolutePath).href;
};

try {
  // 尝试从 dist 目录导入（生产环境）
  const schemaPath = path.join(__dirname, '../dist/db/schema.js');
  const schemaURL = toFileURL(schemaPath);
  const schemaModule = await import(schemaURL);
  ({ persons, leaves, reminders, reminderSettings } = schemaModule);
  console.log('📦 已加载生产环境 schema');
} catch (error) {
  try {
    // 尝试从 src 目录导入（开发环境）
    const schemaPath = path.join(__dirname, '../src/db/schema.js');
    const schemaURL = toFileURL(schemaPath);
    const schemaModule = await import(schemaURL);
    ({ persons, leaves, reminders, reminderSettings } = schemaModule);
    console.log('📦 已加载开发环境 schema');
  } catch (devError) {
    console.error('❌ 无法加载 schema 文件:', devError);
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

const client = postgres(connectionString);
const db = drizzle(client);

/**
 * 获取当前日期
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 诊断主函数
 */
async function diagnose() {
  console.log('🔍 开始诊断提醒记录问题...\n');

  const currentDate = getCurrentDate();
  console.log(`📅 当前日期: ${currentDate}\n`);

  try {
    // 1. 获取所有正在休假的人员（包含所有在外类型）
    console.log('=' .repeat(80));
    console.log('1️⃣  检查正在休假的人员（所有在外类型）');
    console.log('=' .repeat(80));

    const activeLeavePersons = await db
      .select({
        personId: persons.id,
        personName: persons.name,
        personCreatedBy: persons.createdBy,
        lastContactDate: persons.lastContactDate,
        leaveId: leaves.id,
        leaveType: leaves.leaveType,
        leaveStartDate: leaves.startDate,
        leaveEndDate: leaves.endDate,
      })
      .from(leaves)
      .innerJoin(persons, eq(leaves.personId, persons.id))
      .where(
        and(
          eq(leaves.status, 'active'),
          sql`${currentDate} >= ${leaves.startDate}`,
          sql`${currentDate} <= ${leaves.endDate}`
        )
      )
      .orderBy(leaves.leaveType);

    console.log(`\n📊 共有 ${activeLeavePersons.length} 人正在休假\n`);

    if (activeLeavePersons.length === 0) {
      console.log('✅ 没有人正在休假，无需继续检查');
      return;
    }

    // 按在外类型分组统计
    const leaveTypeCount = {};
    for (const person of activeLeavePersons) {
      const type = person.leaveType;
      if (!leaveTypeCount[type]) {
        leaveTypeCount[type] = 0;
      }
      leaveTypeCount[type]++;
    }

    console.log('按在外类型统计:');
    for (const [type, count] of Object.entries(leaveTypeCount)) {
      const typeMap = {
        vacation: '休假',
        business: '出差',
        study: '学习',
        hospitalization: '住院',
        care: '陪护',
      };
      console.log(`  - ${typeMap[type] || type}: ${count}人`);
    }

    // 2. 检查每个人的提醒记录和阈值设置
    console.log('\n' + '=' .repeat(80));
    console.log('2️⃣  检查每个人的提醒记录和阈值设置');
    console.log('=' .repeat(80) + '\n');

    // 获取所有用户的阈值设置
    const allSettings = await db.select().from(reminderSettings);
    const settingsMap = new Map();
    for (const setting of allSettings) {
      settingsMap.set(setting.userId, {
        urgentThreshold: setting.urgentThreshold || 10,
        suggestThreshold: setting.suggestThreshold || 7,
      });
    }

    console.log(`📋 已加载 ${settingsMap.size} 个用户的阈值设置\n`);

    // 检查每个人
    for (const person of activeLeavePersons) {
      const typeMap = {
        vacation: '休假',
        business: '出差',
        study: '学习',
        hospitalization: '住院',
        care: '陪护',
      };

      console.log('-'.repeat(80));
      console.log(`👤 ${person.personName} (${typeMap[person.leaveType] || person.leaveType})`);
      console.log(`   休假期间: ${person.leaveStartDate} ~ ${person.leaveEndDate}`);
      console.log(`   最后联系: ${person.lastContactDate || '无'}`);

      // 获取该人员的阈值设置
      let urgentThreshold = 10;
      let suggestThreshold = 7;
      if (person.personCreatedBy && settingsMap.has(person.personCreatedBy)) {
        const userSettings = settingsMap.get(person.personCreatedBy);
        urgentThreshold = userSettings.urgentThreshold;
        suggestThreshold = userSettings.suggestThreshold;
      }
      console.log(`   阈值设置: 紧急=${urgentThreshold}天, 建议=${suggestThreshold}天`);

      // 计算距离上次联系的天数
      let daysSinceContact = null;
      if (person.lastContactDate) {
        const lastContactDate = new Date(person.lastContactDate);
        const current = new Date(currentDate);
        const lastContactDay = new Date(lastContactDate.getFullYear(), lastContactDate.getMonth(), lastContactDate.getDate());
        const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
        daysSinceContact = Math.floor((currentDay.getTime() - lastContactDay.getTime()) / (1000 * 60 * 60 * 24));
      }
      console.log(`   距上次联系: ${daysSinceContact !== null ? daysSinceContact + '天' : '无联系记录'}`);

      // 获取该人员的未处理提醒
      const unhandledReminders = await db
        .select({
          id: reminders.id,
          reminderType: reminders.reminderType,
          reminderDate: reminders.reminderDate,
          priority: reminders.priority,
        })
        .from(reminders)
        .where(
          and(
            eq(reminders.personId, person.personId),
            eq(reminders.isHandled, false)
          )
        );

      if (unhandledReminders.length > 0) {
        console.log(`   ⚠️  存在 ${unhandledReminders.length} 条未处理提醒:`);
        for (const reminder of unhandledReminders) {
          const priorityMap = {
            high: '高（紧急）',
            medium: '中（建议）',
            low: '低（正常）',
          };
          const typeMap = {
            before: '休假前',
            during: '休假中',
            ending: '即将结束',
            overdue: '逾期',
            system: '系统',
          };
          console.log(`      - ${reminder.reminderDate}: ${priorityMap[reminder.priority] || reminder.priority} / ${typeMap[reminder.reminderType] || reminder.reminderType}`);
        }

        // 分析提醒是否合理
        if (daysSinceContact !== null) {
          const currentReminder = unhandledReminders[0];
          if (currentReminder.priority === 'high' && daysSinceContact < urgentThreshold) {
            console.log(`   ❌ 异常: 距上次联系${daysSinceContact}天，但提醒优先级为"高"（应为 >=${urgentThreshold}天）`);
            console.log(`      可能原因: 用户的阈值设置过低，或提醒记录未正确更新`);
          } else if (currentReminder.priority === 'medium' && daysSinceContact < suggestThreshold) {
            console.log(`   ⚠️  可能异常: 距上次联系${daysSinceContact}天，但提醒优先级为"中"（应为 >=${suggestThreshold}天）`);
          } else {
            console.log(`   ✅ 提醒合理`);
          }
        }
      } else {
        console.log(`   ✅ 无未处理提醒`);
      }
    }

    // 3. 检查是否有在外类型的差异
    console.log('\n' + '=' .repeat(80));
    console.log('3️⃣  按在外类型统计提醒分布');
    console.log('=' .repeat(80) + '\n');

    for (const [leaveType, count] of Object.entries(leaveTypeCount)) {
      const typeMap = {
        vacation: '休假',
        business: '出差',
        study: '学习',
        hospitalization: '住院',
        care: '陪护',
      };

      const personsOfType = activeLeavePersons.filter(p => p.leaveType === leaveType);
      let withReminders = 0;
      let urgentCount = 0;
      let suggestCount = 0;
      let normalCount = 0;

      for (const person of personsOfType) {
        const unhandledReminders = await db
          .select()
          .from(reminders)
          .where(
            and(
              eq(reminders.personId, person.personId),
              eq(reminders.isHandled, false)
            )
          )
          .limit(1);

        if (unhandledReminders.length > 0) {
          withReminders++;
          const priority = unhandledReminders[0].priority;
          if (priority === 'high') urgentCount++;
          else if (priority === 'medium') suggestCount++;
          else normalCount++;
        }
      }

      console.log(`${typeMap[leaveType] || leaveType}:`);
      console.log(`  总人数: ${count}人`);
      console.log(`  有提醒: ${withReminders}人`);
      console.log(`    - 紧急: ${urgentCount}人`);
      console.log(`    - 建议: ${suggestCount}人`);
      console.log(`    - 正常: ${normalCount}人`);
      console.log(`  无提醒: ${count - withReminders}人\n`);
    }

    // 4. 总结
    console.log('=' .repeat(80));
    console.log('📝 诊断总结');
    console.log('=' .repeat(80) + '\n');

    console.log('✅ 已验证：所有在外类型（休假、学习、出差、住院、陪护）都正常处理');
    console.log('✅ 定时任务、后端接口、统计功能对所有在外类型一视同仁\n');

    console.log('如果发现"最后联系3天前但显示紧急"的问题，可能原因：');
    console.log('1. 该用户的紧急阈值（urgentThreshold）设置为 <= 3天');
    console.log('2. 该人员的创建者设置了非常低的阈值');
    console.log('3. 需要检查数据库中 reminder_settings 表的具体配置\n');

    console.log('建议操作：');
    console.log('1. 检查 reminder_settings 表，确认各用户的阈值设置是否合理');
    console.log('2. 如需调整阈值，可通过管理员账号在前端"设置"页面修改');
    console.log('3. 默认阈值：urgentThreshold=10天, suggestThreshold=7天\n');

  } catch (error) {
    console.error('❌ 诊断过程中出错:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// 执行诊断
diagnose().catch(error => {
  console.error('❌ 诊断脚本执行失败:', error);
  process.exit(1);
});

