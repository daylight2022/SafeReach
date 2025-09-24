import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, testConnection, closeConnection } from './connection.js';

async function runMigrations() {
  console.log('🚀 开始数据库迁移...');

  try {
    // 测试连接
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    // 运行迁移
    // 使用统一的迁移文件路径
    const migrationsFolder = './drizzle';

    await migrate(db, { migrationsFolder });
    console.log('✅ 数据库迁移完成');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// 直接执行迁移
runMigrations();
