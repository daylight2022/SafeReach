-- SafeReach 数据库初始化脚本
-- 创建数据库和用户

-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE safereach'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'safereach')\gexec

-- 创建用户（如果不存在）
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'safereach') THEN

      CREATE ROLE safereach LOGIN PASSWORD 'SafeReach123!';
   END IF;
END
$do$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE safereach TO safereach;

-- 连接到 safereach 数据库
\c safereach;

-- 授予 schema 权限
GRANT ALL ON SCHEMA public TO safereach;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO safereach;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO safereach;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO safereach;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO safereach;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 设置时区
SET timezone = 'Asia/Shanghai';
