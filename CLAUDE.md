# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

SafeReach (安心通) 是一个基于 React Native 开发的在外人员管理系统，包含前端移动应用和基于 Hono 的后端 API 服务。项目集成了完整的版本管理和自动更新功能。

## 开发环境要求

- **Node.js**: >= 20 (前端), >= 18 (后端)
- **React Native**: 0.81.3
- **平台**: Android/iOS

## 常用开发命令

### 前端 (React Native)

```bash
# 启动 Metro 开发服务器
npm start

# 运行 Android 应用
npm run android

# 运行 iOS 应用 (需要先安装 CocoaPods 依赖)
npm run ios

# iOS 依赖安装 (首次克隆或更新原生依赖后)
bundle install
bundle exec pod install

# 代码检查
npm run lint

# 运行测试
npm run test

# 清理 Android 构建
npm run clean

# 生成代码
npm run codegen

# 构建 Android Release 版本
npm run build
```

### 版本管理

```bash
# 主版本更新 (重大变更)
npm run version:major

# 次版本更新 (新功能)
npm run version:minor

# 补丁更新 (Bug修复)
npm run version:patch
```

### 后端 (Hono API)

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建应用
npm run build

# 生产模式启动
npm start

# 数据库操作
npm run db:generate     # 生成迁移文件
npm run db:migrate      # 运行迁移
npm run db:seed         # 插入种子数据

# 代码检查
npm run lint
npm run lint:fix

# 定时任务
npm run cron:dev        # 开发环境定时任务
npm run cron:prod       # 生产环境定时任务
```

## 项目架构

### 前端架构

```
src/
├── components/         # 可复用组件
├── screens/           # 页面组件
│   ├── DashboardScreen.tsx      # 仪表板
│   ├── PersonListScreen.tsx     # 人员列表
│   ├── PersonDetailScreen.tsx   # 人员详情
│   ├── AddPersonScreen.tsx      # 添加人员
│   ├── StatisticsScreen.tsx     # 统计页面
│   └── LoginScreen.tsx          # 登录页面
├── navigation/        # 导航配置
│   └── AppNavigator.tsx         # 主导航器
├── services/          # API 服务层
│   ├── api.ts                 # API 基础配置
│   ├── apiServices.ts         # 具体服务调用
│   └── versionService.ts      # 版本管理服务
├── contexts/          # React Context
│   └── AuthContext.tsx        # 认证上下文
├── hooks/             # 自定义 Hooks
├── utils/             # 工具函数
├── types/             # TypeScript 类型定义
└── assets/            # 静态资源
```

**关键特性:**
- **导航**: 使用 React Navigation，包含底部标签导航和堆栈导航
- **认证**: 基于 JWT 的认证系统，支持自动登录状态检查
- **状态管理**: 使用 React Context 进行全局状态管理
- **路径别名**: 配置了 `@/` 指向 `src/` 目录

### 后端架构

```
backend/
├── src/
│   ├── routes/        # API 路由层
│   │   ├── auth.ts           # 认证接口
│   │   ├── users.ts          # 用户管理
│   │   ├── persons.ts        # 人员管理
│   │   ├── leaves.ts         # 休假记录
│   │   ├── contacts.ts       # 联系记录
│   │   ├── reminders.ts      # 提醒记录
│   │   └── statistics.ts     # 统计数据
│   ├── middleware/     # 中间件
│   │   ├── auth.ts           # 认证中间件
│   │   └── validation.ts     # 数据验证
│   ├── db/            # 数据库层
│   │   ├── schema.ts          # 数据库模式
│   │   ├── connection.ts      # 数据库连接
│   │   ├── migrate.ts         # 迁移脚本
│   │   └── seed.ts            # 种子数据
│   ├── utils/         # 工具函数
│   └── types/         # 类型定义
├── drizzle.config.ts  # Drizzle ORM 配置
└── scripts/           # 部署脚本
```

**技术栈:**
- **框架**: Hono (现代化 Web 框架)
- **数据库**: PostgreSQL + Drizzle ORM
- **认证**: JWT
- **验证**: Zod
- **环境管理**: dotenv-flow (支持多环境配置)

## 核心功能模块

### 1. 认证系统
- JWT Token 认证
- 自动登录状态检查
- Token 刷新机制
- 角色权限控制

### 2. 人员管理
- 人员信息 CRUD
- 部门管理
- 联系记录
- 休假记录

### 3. 统计分析
- 仪表板统计
- 个人统计
- 部门统计
- 联系频次分析

### 4. 版本管理
- 自动版本检测
- 更新提醒弹框
- 版本历史记录
- GitHub Actions 自动发布

## 数据库设计要点

- 使用 PostgreSQL 关系型数据库
- 外键约束保证数据完整性
- 支持软删除机制
- 部门数据隔离 (非管理员只能访问本部门数据)

## 环境配置

### 前端环境变量
无需特殊配置，主要使用 API 服务地址。

### 后端环境变量
支持多环境配置 (dotenv-flow):

```bash
# 基础配置文件优先级 (从高到低)
.env.{environment}.local    # 本地环境覆盖
.env.{environment}          # 环境特定配置
.env.local                  # 本地通用配置
.env                        # 基础配置
```

**必要配置项:**
- `DATABASE_URL`: PostgreSQL 连接字符串
- `JWT_SECRET`: JWT 密钥
- `JWT_EXPIRES_IN`: Token 过期时间
- `CORS_ORIGIN`: 允许的跨域来源

## 部署说明

### 前端部署
通过 GitHub Actions 自动化构建和发布 Android APK。

### 后端部署
支持两种部署方式:
1. **宝塔面板部署** (推荐) - 适用于无法 SSH 连接的服务器
2. **SSH 自动部署** - 适用于可以 SSH 连接的服务器

详细部署步骤参考 `backend/README.md` 和 `server-deploy/README.md`。

## 开发注意事项

1. **路径别名**: 前端使用 `@/` 别名导入 `src/` 目录下的文件
2. **类型安全**: 全程使用 TypeScript，后端使用 Zod 进行运行时验证
3. **错误处理**: 统一的错误处理机制和响应格式
4. **代码风格**: 遵循 ESLint 配置 (@react-native)
5. **版本管理**: 使用专门的版本管理脚本，避免直接修改版本号

## 测试

- **前端**: 使用 Jest 进行单元测试
- **后端**: 目前暂无自动化测试，建议使用 Postman 等工具手动测试 API

## 常见问题

### iOS 开发
- 确保安装了 Xcode 和 CocoaPods
- 运行前执行 `bundle exec pod install`

### Android 开发
- 确保安装了 Android Studio 和 Android SDK
- 可能需要配置 ANDROID_HOME 环境变量

### 后端开发
- 确保 PostgreSQL 服务正在运行
- 首次运行需要执行数据库迁移和种子数据插入