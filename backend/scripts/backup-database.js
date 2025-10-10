#!/usr/bin/env node

/**
 * SafeReach 数据库备份脚本 (Node.js 版本 - 跨平台)
 * 在执行时区数据修正前，请先运行此脚本备份数据库
 * 
 * 使用方法：
 * node backend/scripts/backup-database.js
 * 或: npm run backup:db
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库连接信息
const DATABASE_URL = 'postgresql://safereach:SafeReach123!@1.12.60.17:5432/safereach';

// 备份配置
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('.')[0];
const BACKUP_FILE = path.join(BACKUP_DIR, `safereach_backup_${TIMESTAMP}.sql`);

// 创建数据库连接
const sql = postgres(DATABASE_URL);

/**
 * 确保备份目录存在
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * 获取所有表名
 */
async function getAllTables() {
  const tables = await sql`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  return tables.map(t => t.tablename);
}

/**
 * 导出表结构
 */
async function exportTableSchema(tableName) {
  const [tableInfo] = await sql`
    SELECT 
      'CREATE TABLE ' || quote_ident(c.relname) || ' (' ||
      string_agg(
        quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod) ||
        CASE 
          WHEN a.attnotnull THEN ' NOT NULL' 
          ELSE '' 
        END ||
        CASE 
          WHEN pg_get_expr(ad.adbin, ad.adrelid) IS NOT NULL 
          THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid)
          ELSE ''
        END,
        ', '
      ) || ');' as create_statement
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = ${tableName}
      AND n.nspname = 'public'
      AND a.attnum > 0
      AND NOT a.attisdropped
    GROUP BY c.relname, c.oid
  `;
  
  return tableInfo?.create_statement || '';
}

/**
 * 导出表数据
 */
async function exportTableData(tableName) {
  try {
    const rows = await sql`SELECT * FROM ${sql(tableName)}`;
    
    if (rows.length === 0) {
      return '';
    }

    const columns = Object.keys(rows[0]);
    const values = rows.map(row => {
      const vals = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (val instanceof Date) return `'${val.toISOString()}'`;
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      });
      return `(${vals.join(', ')})`;
    });

    const insertStatement = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n${values.join(',\n')};\n`;
    return insertStatement;
  } catch (error) {
    console.error(`⚠️  导出表 ${tableName} 的数据时出错:`, error.message);
    return '';
  }
}

/**
 * 执行备份
 */
async function performBackup() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           SafeReach 数据库备份脚本 (Node.js)            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🗄️  数据库: safereach`);
  console.log(`📁 备份目录: ${BACKUP_DIR}`);
  console.log(`📝 备份文件: ${BACKUP_FILE}`);
  console.log('');

  try {
    // 测试数据库连接
    console.log('🔌 测试数据库连接...');
    await sql`SELECT 1`;
    console.log('✅ 数据库连接成功！');
    console.log('');

    // 确保备份目录存在
    ensureBackupDir();

    // 获取所有表
    console.log('📋 获取表列表...');
    const tables = await getAllTables();
    console.log(`✅ 找到 ${tables.length} 个表: ${tables.join(', ')}`);
    console.log('');

    // 创建备份文件
    console.log('🔄 开始备份...');
    const backupStream = fs.createWriteStream(BACKUP_FILE);

    // 写入文件头
    backupStream.write(`--\n`);
    backupStream.write(`-- SafeReach Database Backup\n`);
    backupStream.write(`-- Backup Date: ${new Date().toISOString()}\n`);
    backupStream.write(`-- Database: safereach\n`);
    backupStream.write(`--\n\n`);

    // 导出每个表
    let exportedTables = 0;
    for (const tableName of tables) {
      process.stdout.write(`   📦 备份表 ${tableName}...`);

      try {
        // 导出表结构
        backupStream.write(`\n-- Table: ${tableName}\n`);
        backupStream.write(`DROP TABLE IF EXISTS ${tableName} CASCADE;\n`);
        const schema = await exportTableSchema(tableName);
        if (schema) {
          backupStream.write(schema + '\n\n');
        }

        // 导出表数据
        const data = await exportTableData(tableName);
        if (data) {
          backupStream.write(data + '\n');
        }

        exportedTables++;
        process.stdout.write(' ✅\n');
      } catch (error) {
        process.stdout.write(` ⚠️  ${error.message}\n`);
      }
    }

    backupStream.end();

    // 等待写入完成
    await new Promise((resolve) => backupStream.on('finish', resolve));

    // 获取文件大小
    const stats = fs.statSync(BACKUP_FILE);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

    console.log('');
    console.log('✅ 数据库备份完成！');
    console.log(`📦 备份文件: ${BACKUP_FILE}`);
    console.log(`📊 文件大小: ${fileSizeInMB} MB`);
    console.log(`📋 备份表数: ${exportedTables}/${tables.length}`);
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║           备份成功！可以安全执行数据修正操作            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('💡 备份文件位置：');
    console.log(`   ${BACKUP_FILE}`);
    console.log('');
    console.log('💡 如需恢复备份，请执行：');
    console.log(`   psql -h 1.12.60.17 -U safereach -d safereach < "${BACKUP_FILE}"`);
    console.log('   或使用数据库管理工具导入 SQL 文件');

    // 列出所有备份文件
    console.log('');
    console.log('📋 所有备份文件：');
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('safereach_backup_') && f.endsWith('.sql'))
      .sort()
      .reverse();
    
    backupFiles.slice(0, 10).forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const fileStats = fs.statSync(filePath);
      const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
      console.log(`   ${file} (${sizeMB} MB)`);
    });

    // 清理旧备份
    if (backupFiles.length > 10) {
      console.log('');
      console.log('🧹 清理旧备份文件（保留最近10个）...');
      const filesToDelete = backupFiles.slice(10);
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        console.log(`   🗑️  删除: ${file}`);
      }
      console.log('✅ 清理完成');
    }

  } catch (error) {
    console.error('');
    console.error('❌ 数据库备份失败！');
    console.error('错误信息:', error.message);
    console.error('');
    console.error('请检查：');
    console.error('  1. 数据库连接信息是否正确');
    console.error('  2. 网络连接是否正常');
    console.error('  3. 数据库权限是否足够');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// 执行备份
performBackup().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

