import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv-flow';
import * as schema from './schema.js';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// 创建 PostgreSQL 连接
const client = postgres(connectionString, {
  max: 10, // 最大连接数
  idle_timeout: 20, // 空闲超时时间（秒）
  connect_timeout: 10, // 连接超时时间（秒）
});

// 创建 Drizzle 实例
export const db = drizzle(client, { schema });

// 测试数据库连接
export async function testConnection() {
  try {
    await client`SELECT 1`;
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

// 优雅关闭数据库连接
export async function closeConnection() {
  try {
    await client.end();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接失败:', error);
  }
}
