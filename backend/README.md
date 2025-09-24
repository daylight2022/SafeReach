# SafeReach Backend API

基于 Hono 的现代化后端 API 服务，用于替代 Supabase 提供更好的国内访问体验。

## 🚀 技术栈

- **框架**: [Hono](https://hono.dev/) - 现代化的 Web 框架
- **数据库**: PostgreSQL - 关系型数据库
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - 类型安全的 TypeScript ORM
- **认证**: JWT (JSON Web Tokens)
- **验证**: [Zod](https://zod.dev/) - TypeScript 优先的数据验证
- **密码加密**: MD5 (统一加密方式)
- **运行时**: Node.js 18+

## 📁 项目结构

```
backend/
├── src/
│   ├── db/                    # 数据库相关
│   │   ├── schema.ts          # 数据库模式定义
│   │   ├── connection.ts      # 数据库连接配置
│   │   ├── migrate.ts         # 数据库迁移脚本
│   │   ├── seed.ts            # 种子数据脚本
│   │   └── migrations/        # 迁移文件目录
│   ├── routes/                # API 路由
│   │   ├── auth.ts           # 认证相关路由
│   │   ├── users.ts          # 用户管理路由
│   │   ├── persons.ts        # 人员管理路由
│   │   ├── leaves.ts         # 休假记录路由
│   │   ├── contacts.ts       # 联系记录路由
│   │   ├── reminders.ts      # 提醒记录路由
│   │   └── statistics.ts     # 统计数据路由
│   ├── middleware/            # 中间件
│   │   ├── auth.ts           # 认证中间件
│   │   └── validation.ts     # 数据验证中间件
│   ├── utils/                 # 工具函数
│   │   ├── jwt.ts            # JWT 工具
│   │   ├── password.ts       # 密码处理工具
│   │   └── response.ts       # 响应格式化工具
│   ├── types/                 # 类型定义
│   │   └── index.ts          # 通用类型定义
│   └── index.ts              # 应用入口文件
├── package.json              # 项目依赖配置
├── tsconfig.json             # TypeScript 配置
├── drizzle.config.ts         # Drizzle ORM 配置
├── .env.example              # 环境变量示例
└── README.md                 # 项目说明文档
```

## 🛠️ 开发思路

### 1. 架构设计

- **分层架构**: 路由层 → 中间件层 → 业务逻辑层 → 数据访问层
- **模块化设计**: 每个功能模块独立，便于维护和扩展
- **类型安全**: 全程 TypeScript，编译时类型检查
- **统一响应格式**: 标准化的 API 响应结构

### 2. 数据库设计

- **关系型设计**: 使用 PostgreSQL 的关系特性
- **外键约束**: 保证数据完整性
- **索引优化**: 针对查询频繁的字段建立索引
- **软删除**: 重要数据支持软删除机制

### 3. 认证授权

- **JWT 认证**: 无状态的 Token 认证机制
- **角色权限**: 基于角色的访问控制 (RBAC)
- **部门隔离**: 非管理员只能访问本部门数据
- **Token 刷新**: 支持 Token 自动刷新机制

### 4. 数据验证

- **输入验证**: 使用 Zod 进行严格的数据验证
- **类型推导**: 从验证模式自动推导 TypeScript 类型
- **错误处理**: 统一的验证错误响应格式

### 5. 错误处理

- **全局错误处理**: 统一的错误处理机制
- **错误分类**: 区分业务错误和系统错误
- **日志记录**: 详细的错误日志记录
- **用户友好**: 返回用户友好的错误信息

## 🚀 快速开始

### 1. 环境准备

确保已安装以下软件：

- Node.js 18+
- PostgreSQL 12+
- npm 或 yarn

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 环境配置

本项目使用 `dotenv-flow` 进行环境管理，支持多环境配置文件：

#### 环境文件优先级（从高到低）：

1. `.env.{environment}.local` - 本地环境覆盖（不应提交到版本控制）
2. `.env.{environment}` - 环境特定配置（如 `.env.development`, `.env.production`）
3. `.env.local` - 本地通用配置（不应提交到版本控制）
4. `.env` - 基础配置（所有环境共享的默认值）

#### 快速开始：

复制基础配置文件：

```bash
cp .env.example .env
```

根据需要编辑 `.env` 文件，配置数据库连接和其他参数。

#### 环境配置说明：

- **开发环境**：自动加载 `.env.development`，NODE_ENV=development
- **生产环境**：自动加载 `.env.production`，NODE_ENV=production
- **本地覆盖**：创建 `.env.local` 或 `.env.development.local` 进行本地配置覆盖

#### 配置示例：

基础配置（`.env`）：

```env
DATABASE_URL=postgresql://username:password@localhost:5432/safereach
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
PORT=3000
CORS_ORIGIN=http://localhost:3000,http://localhost:8081
BCRYPT_ROUNDS=12
LOG_LEVEL=info
```

### 4. 数据库设置

生成数据库迁移文件：

```bash
npm run db:generate
```

运行数据库迁移：

```bash
npm run db:migrate
```

插入种子数据：

```bash
npm run db:seed
```

### 5. 启动服务

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

服务启动后，访问 http://localhost:3000 查看 API 信息。

## 📚 API 文档

### 认证接口

#### 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

#### 验证 Token

```http
POST /api/auth/verify
Authorization: Bearer <token>
```

#### 刷新 Token

```http
POST /api/auth/refresh
Authorization: Bearer <token>
```

### 用户管理

#### 获取用户列表（管理员）

```http
GET /api/users?page=1&limit=10&search=张三
Authorization: Bearer <token>
```

#### 获取当前用户信息

```http
GET /api/users/me
Authorization: Bearer <token>
```

#### 创建用户（管理员）

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "realName": "新用户",
  "role": "liaison",
  "department": "技术部",
  "phone": "13800138000"
}
```

### 人员管理

#### 获取人员列表

```http
GET /api/persons?page=1&limit=10&search=张三&department=技术部
Authorization: Bearer <token>
```

#### 创建人员

```http
POST /api/persons
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "张三",
  "phone": "13900139001",
  "emergencyContact": "张三妻子",
  "emergencyPhone": "13900139002",
  "department": "技术部",
  "personType": "employee"
}
```

### 统计数据

#### 获取仪表板统计

```http
GET /api/statistics/dashboard
Authorization: Bearer <token>
```

#### 获取个人统计

```http
GET /api/statistics/personal
Authorization: Bearer <token>
```

完整的 API 文档可访问：http://localhost:3000/api/docs

## 🔧 开发工具

### 数据库管理

查看数据库结构：

```bash
npm run db:studio
```

生成新的迁移：

```bash
npm run db:generate
```

### 代码质量

类型检查：

```bash
npm run type-check
```

代码检查：

```bash
npm run lint
```

自动修复：

```bash
npm run lint:fix
```

## 🚀 部署指南

### 部署方式选择

本项目提供两种部署方式：

1. **宝塔面板部署**（推荐）- 适用于无法 SSH 连接的服务器
2. **SSH 自动部署** - 适用于可以 SSH 连接的服务器

### 宝塔面板部署（推荐）

**步骤 1: 本地打包**

```bash
# 给脚本执行权限
chmod +x scripts/build-package.sh

# 执行打包
./scripts/build-package.sh
```

**步骤 2: 服务器部署**

详细步骤请参考：`server-deploy/README.md`

### SSH 自动部署

**步骤 1: 配置环境**

```bash
# 复制配置模板
cp server-deploy/.env.production .env.production.local
# 编辑配置文件，修改数据库连接等信息
```

**步骤 2: 执行部署**

```bash
# 给脚本执行权限
chmod +x deploy-ssh.sh

# 执行自动部署
./deploy-ssh.sh
```

### 手动部署

如果需要手动部署：

**1. 构建应用**

```bash
npm run build
```

**2. 使用 PM2 管理进程**

```bash
# 安装 PM2
npm install -g pm2

# 使用配置文件启动
pm2 start server-deploy/ecosystem.config.js --env production
```

### 5. 反向代理配置

使用 Nginx 配置反向代理：

```nginx
server {
    listen 80;
    server_name your-api-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔐 安全考虑

1. **密码安全**: 使用 MD5 加密密码（统一加密方式）
2. **JWT 安全**: 使用强密钥，设置合理的过期时间
3. **输入验证**: 严格验证所有输入数据
4. **SQL 注入防护**: 使用 ORM 参数化查询
5. **CORS 配置**: 限制跨域访问来源
6. **错误信息**: 避免泄露敏感信息

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如有问题或建议，请提交 Issue 或联系开发团队。
