# SafeReach Backend 自动化部署指南

## 🎯 部署概览

本指南提供两种部署方式：**自动化部署**（推荐）和手动部署。

**自动化部署**（推荐）：

- 支持 SSH 密钥登录的服务器
- 完全自动化的构建、上传和部署流程
- 一键完成整个部署过程

**手动部署**：

- 无法 SSH 远程连接的云服务器
- 使用宝塔面板管理的服务器
- 需要手动上传文件的部署环境

## 📋 前置要求

### 服务器环境

- **操作系统**: Linux (CentOS/Ubuntu/Debian)
- **宝塔面板**: 已安装并正常运行
- **Node.js**: 18+ (可通过宝塔面板软件商店安装)
- **PostgreSQL**: 12+ (可通过宝塔面板软件商店安装)
- **PM2**: 将通过部署脚本自动安装

### 本地环境

- Node.js 18+
- 已完成项目构建和打包

## 🚀 自动化部署（推荐）

### 前置要求

- 服务器支持 SSH 密钥登录
- 本地已配置 SSH 密钥
- 服务器已安装 Docker（用于 PostgreSQL）

### 步骤 1: 配置部署参数

编辑 `scripts/deploy-config.sh` 文件：

```bash
# 服务器连接配置
SERVER_HOST="1.12.60.17"           # 你的服务器IP
SERVER_USER="root"                 # SSH用户名
SSH_KEY_PATH="/path/to/your/key"   # SSH私钥路径

# 服务器路径配置
REMOTE_DEPLOY_PATH="/home/workspace/safereach-backend"
REMOTE_BACKUP_PATH="/home/backup/safereach-backend"
```

### 步骤 2: 执行自动化部署

在本地项目根目录执行：

```bash
# 给脚本执行权限
chmod +x scripts/auto-deploy.sh

# 执行自动化部署
./scripts/auto-deploy.sh
```

脚本将自动完成：

- 本地构建和打包
- 上传到服务器
- 服务器端部署
- 启动服务

### 步骤 3: 验证部署

部署完成后，访问：`http://your-server-ip:3000`

---

## 🔧 手动部署

如果无法使用 SSH 或需要手动部署，请按以下步骤操作：

### 步骤 1: 本地打包

在本地项目根目录执行：

```bash
# 给脚本执行权限
chmod +x scripts/build-package.sh

# 执行打包
./scripts/build-package.sh
```

这将生成一个 `safereach-backend-deploy-YYYYMMDD-HHMMSS.tar.gz` 文件。

### 步骤 2: 上传到服务器

1. **登录宝塔面板**
2. **进入文件管理**
3. **创建项目目录**：
   - 建议路径：`/home/workspace/safereach-backend`
4. **上传压缩包**：
   - 将打包生成的 `.tar.gz` 文件上传到项目目录
5. **解压文件**：
   - 右键压缩包 → 解压 → 解压到当前目录

### 步骤 3: 环境配置

#### 3.1 安装 Node.js (如果未安装)

1. 进入宝塔面板 → 软件商店
2. 搜索 "Node.js"
3. 安装 Node.js 18+ 版本

#### 3.2 启动 PostgreSQL Docker 容器

**使用简化的数据库设置脚本**：

```bash
# 进入解压后的项目目录
cd /home/workspace/safereach-backend/build-XXXXXX-XXXXXX

# 执行数据库设置脚本
chmod +x server-deploy/setup-database.sh
./server-deploy/setup-database.sh
```

或者**手动启动 Docker 容器**：

```bash
docker run -d --name safereach-postgres --restart unless-stopped \
  -e POSTGRES_DB=safereach \
  -e POSTGRES_USER=safereach \
  -e POSTGRES_PASSWORD=SafeReach123! \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16
```

#### 3.3 配置数据库

**使用 Docker 容器初始化数据库**：

```bash
# 进入项目目录
cd /home/workspace/safereach-backend/build-XXXXXX-XXXXXX

# 执行数据库初始化脚本
docker exec -i safereach-postgres psql -U safereach -d safereach < server-deploy/init-db.sql

# 或者进入容器手动执行
docker exec -it safereach-postgres psql -U safereach -d safereach
```

### 步骤 4: 配置环境变量

1. **复制配置文件**：

   ```bash
   cp server-deploy/.env.production .env
   ```

2. **编辑配置文件**：

   ```bash
   # 使用宝塔面板文件管理器编辑 .env 文件
   # 或使用命令行编辑器
   nano .env
   ```

3. **重要配置项**：

   ```env
   # 数据库连接（必须修改）
   DATABASE_URL=postgresql://safereach:SafeReach123!@localhost:5432/safereach

   # JWT密钥（必须修改为强密钥）
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

   # 注意：移动APP访问后端通常不需要CORS配置
   ```

### 步骤 5: 手动执行部署

由于自动化部署脚本已整合到 `auto-deploy.sh` 中，手动部署需要执行以下步骤：

1. **进入项目目录**：

   ```bash
   cd /home/workspace/safereach-backend/build-XXXXXX-XXXXXX
   ```

2. **安装 PM2**（如果未安装）：

   ```bash
   npm install -g pm2
   ```

3. **创建部署目录并复制文件**：

   ```bash
   # 创建最终部署目录
   mkdir -p /home/workspace/safereach-backend
   mkdir -p /home/workspace/safereach-backend/logs

   # 复制文件
   cp -r dist /home/workspace/safereach-backend/
   cp -r scripts /home/workspace/safereach-backend/
   cp package.json /home/workspace/safereach-backend/
   cp package-lock.json /home/workspace/safereach-backend/ 2>/dev/null || true
   cp drizzle.config.ts /home/workspace/safereach-backend/ 2>/dev/null || true
   cp -r drizzle /home/workspace/safereach-backend/ 2>/dev/null || true
   cp server-deploy/ecosystem.config.cjs /home/workspace/safereach-backend/
   ```

4. **配置环境变量**：

   ```bash
   cp server-deploy/.env.production /home/workspace/safereach-backend/.env
   # 编辑 .env 文件，修改数据库连接等配置
   ```

5. **安装依赖并启动服务**：

   ```bash
   cd /home/workspace/safereach-backend
   npm ci --only=production
   npm run db:migrate:prod  # 执行数据库迁移
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   ```

### 步骤 6: 验证部署

1. **检查服务状态**：

   ```bash
   pm2 status
   ```

2. **查看日志**：

   ```bash
   pm2 logs safereach-backend
   ```

3. **测试 API**：
   ```bash
   curl http://localhost:3000
   ```

## 🔧 服务管理

### PM2 常用命令

```bash
# 查看所有服务状态
pm2 status

# 查看特定服务日志
pm2 logs safereach-backend
pm2 logs safereach-cron

# 重启服务
pm2 restart safereach-backend

# 停止服务
pm2 stop safereach-backend

# 删除服务
pm2 delete safereach-backend

# 重新加载配置
pm2 reload ecosystem.config.js
```

### 日志管理

日志文件位置：

- 主服务日志：`/www/wwwroot/safereach-backend/logs/combined.log`
- 定时任务日志：`/www/wwwroot/safereach-backend/logs/cron-combined.log`
- PM2 日志：`~/.pm2/logs/`

### 配置文件

重要配置文件：

- 环境配置：`.env`
- PM2 配置：`ecosystem.config.js`
- 数据库配置：在 `.env` 中的 `DATABASE_URL`

## 🔄 更新部署

### 更新流程

1. **本地打包新版本**：

   ```bash
   ./scripts/build-package.sh
   ```

2. **上传新包到服务器**

3. **备份当前版本**：

   ```bash
   cp -r /www/wwwroot/safereach-backend /www/backup/safereach-backend-$(date +%Y%m%d)
   ```

4. **解压新版本并部署**：

   ```bash
   # 解压新包
   tar -xzf safereach-backend-deploy-XXXXXX.tar.gz

   # 进入新版本目录
   cd build-XXXXXX-XXXXXX

   # 复制现有配置
   cp /www/wwwroot/safereach-backend/.env .env

   # 执行部署
   ./server-deploy/deploy-server.sh
   ```

## 🛡️ 安全配置

### 防火墙设置

在宝塔面板 → 安全 中配置：

- 开放端口：3000 (API 服务)
- 限制访问来源（可选）

### SSL 证书

如果需要 HTTPS：

1. 在宝塔面板 → 网站 中添加站点
2. 配置反向代理到 `http://127.0.0.1:3000`
3. 申请并配置 SSL 证书

### 定期备份

建议设置定期备份：

1. 数据库备份：使用宝塔面板的数据库备份功能
2. 文件备份：定期备份项目目录
3. 配置备份：备份 `.env` 等配置文件

## 🆘 故障排除

### 常见问题

1. **服务启动失败**

   ```bash
   # 查看详细错误日志
   pm2 logs safereach-backend --lines 50

   # 检查配置文件
   cat .env

   # 检查端口占用
   netstat -tlnp | grep 3000
   ```

2. **数据库连接失败**

   ```bash
   # 测试数据库连接
   psql -U safereach -d safereach -h localhost

   # 检查数据库服务状态
   systemctl status postgresql
   ```

3. **定时任务不工作**

   ```bash
   # 查看定时任务日志
   pm2 logs safereach-cron

   # 手动测试定时任务
   node scripts/reminder-cron.js
   ```

### 获取帮助

如遇到问题：

1. 查看 PM2 日志：`pm2 logs`
2. 查看系统日志：`journalctl -u pm2-root`
3. 检查宝塔面板的错误日志
4. 联系技术支持并提供详细的错误信息

## 🌐 Nginx 配置（可选）

**注意：** 对于移动 APP 访问的 API 服务，通常不需要 Nginx。APP 可以直接访问 `http://server-ip:3000`

如果需要反向代理或 HTTPS，可以配置 Nginx：

### 安装 Nginx

```bash
# 在宝塔面板软件商店安装Nginx
# 或使用命令行安装
sudo apt install nginx  # Ubuntu/Debian
sudo yum install nginx  # CentOS/RHEL
```

### 配置 Nginx

1. 复制配置文件：

   ```bash
   sudo cp server-deploy/nginx.conf /etc/nginx/sites-available/safereach
   sudo ln -s /etc/nginx/sites-available/safereach /etc/nginx/sites-enabled/
   ```

2. 修改配置文件中的域名：

   ```bash
   sudo nano /etc/nginx/sites-available/safereach
   # 修改 server_name your-domain.com; 为实际域名
   ```

3. 测试并重启 Nginx：
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 📞 技术支持

部署完成后，服务将在以下地址可用：

- **API 服务**: `http://your-server-ip:3000`
- **健康检查**: `http://your-server-ip:3000/health`

如需技术支持，请提供：

- 服务器系统信息
- 错误日志内容
- 配置文件内容（隐藏敏感信息）
- 具体的错误现象描述
