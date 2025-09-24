#!/bin/bash

# SafeReach Backend 本地打包脚本
# 用于创建适合宝塔面板上传的部署包

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量
PROJECT_NAME="safereach-backend"
BUILD_DIR="build-$(date +%Y%m%d-%H%M%S)"
PACKAGE_NAME="${PROJECT_NAME}-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "📦 开始创建 SafeReach Backend 部署包..."

# 检查环境
check_environment() {
    log_info "检查构建环境..."
    
    if [[ ! -f "package.json" ]]; then
        log_error "未找到 package.json，请在项目根目录运行此脚本"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    log_success "环境检查完成"
}

# 清理并构建项目
build_project() {
    log_info "清理并构建项目..."
    
    # 清理旧的构建文件
    npm run clean 2>/dev/null || rm -rf dist
    
    # 安装依赖
    log_info "安装依赖..."
    npm install
    
    # 构建项目
    log_info "构建项目..."
    npm run build
    
    if [[ ! -d "dist" ]]; then
        log_error "构建失败，未找到 dist 目录"
        exit 1
    fi
    
    log_success "项目构建完成"
}

# 创建部署包
create_package() {
    log_info "创建部署包..."
    
    # 创建临时构建目录
    mkdir -p "$BUILD_DIR"
    
    # 复制必要文件
    log_info "复制项目文件..."

    # 核心运行时文件
    cp -r dist "$BUILD_DIR/"
    cp -r scripts "$BUILD_DIR/"
    cp package.json "$BUILD_DIR/"
    cp package-lock.json "$BUILD_DIR/" 2>/dev/null || log_warning "package-lock.json 不存在"

    # 数据库配置和迁移文件
    cp drizzle.config.ts "$BUILD_DIR/" 2>/dev/null || log_warning "drizzle.config.ts 不存在"

    # 数据库迁移文件已包含在 dist 目录中（编译后的 JavaScript 文件）
    log_info "数据库迁移文件已包含在 dist 目录中"

    # 服务器部署配置
    cp -r server-deploy "$BUILD_DIR/"

    # 修复脚本
    cp fix-production-db.sh "$BUILD_DIR/" 2>/dev/null || log_warning "fix-production-db.sh 不存在"

    # 数据库迁移文件（drizzle 目录）
    if [[ -d "drizzle" ]]; then
        cp -r drizzle "$BUILD_DIR/"
        log_info "已包含数据库迁移文件"
    else
        log_warning "drizzle 目录不存在，请先运行 npm run db:generate"
    fi

    # 注意：不包含以下文件/目录（在服务器上不需要）
    # - src/ (源码，已编译到dist)
    # - node_modules/ (在服务器上重新安装)
    # - .git/ (版本控制)
    # - 开发配置文件 (tsconfig.json, eslint等)
    
    # 创建部署说明文件
    cat > "$BUILD_DIR/DEPLOY_INSTRUCTIONS.md" << 'EOF'
# SafeReach Backend 部署说明

## 📋 部署步骤

### 1. 上传文件
1. 将此压缩包上传到服务器
2. 解压到工作目录（如 `/home/workspace/safereach-backend`）

### 2. 启动数据库（Docker）
```bash
docker run -d --name safereach-postgres --restart unless-stopped \
  -e POSTGRES_DB=safereach \
  -e POSTGRES_USER=safereach \
  -e POSTGRES_PASSWORD=SafeReach123! \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16
```

### 3. 配置环境
1. 复制 `server-deploy/.env.production` 为 `.env`
2. 修改 `.env` 文件中的配置（数据库连接、JWT密钥等）

### 4. 初始化数据库
1. 使用 `server-deploy/init-db.sql` 初始化数据库
2. 或通过Docker执行：`docker exec -i safereach-postgres psql -U safereach -d safereach < server-deploy/init-db.sql`

### 5. 执行部署
```bash
chmod +x server-deploy/deploy-server.sh
./server-deploy/deploy-server.sh
```

### 6. 验证部署
- 检查 PM2 状态：`pm2 status`
- 查看日志：`pm2 logs safereach-backend`
- 访问 API：`http://your-server:3000`
- 检查数据库：`docker ps | grep postgres`

## 🔧 管理命令

- 重启服务：`pm2 restart safereach-backend`
- 查看日志：`pm2 logs safereach-backend`
- 停止服务：`pm2 stop safereach-backend`

## 📞 技术支持

如遇问题，请检查：
1. Node.js 版本 >= 18
2. 数据库连接配置
3. 环境变量配置
4. PM2 日志信息
EOF
    
    log_success "文件复制完成"
}

# 创建压缩包
create_archive() {
    log_info "创建压缩包..."
    
    # 创建 tar.gz 压缩包
    tar -czf "$PACKAGE_NAME" "$BUILD_DIR"
    
    # 获取文件大小
    if command -v du &> /dev/null; then
        PACKAGE_SIZE=$(du -h "$PACKAGE_NAME" | cut -f1)
    else
        PACKAGE_SIZE="未知"
    fi
    
    log_success "压缩包创建完成: $PACKAGE_NAME (大小: $PACKAGE_SIZE)"
}

# 清理临时文件
cleanup() {
    log_info "清理临时文件..."
    rm -rf "$BUILD_DIR"
    log_success "清理完成"
}

# 显示部署信息
show_package_info() {
    log_success "🎉 部署包创建完成！"
    echo
    echo "📦 包信息:"
    echo "  • 文件名: $PACKAGE_NAME"
    echo "  • 大小: $PACKAGE_SIZE"
    echo "  • 创建时间: $(date)"
    echo
    echo "📋 包含内容:"
    echo "  • dist/ - 构建后的应用文件（包含数据库迁移文件）"
    echo "  • scripts/ - 脚本文件（包含定时任务）"
    echo "  • server-deploy/ - 服务器部署配置"
    echo "  • drizzle.config.ts - 数据库配置文件"
    echo "  • fix-production-db.sh - 生产环境数据库修复脚本"
    echo "  • package.json - 项目配置"
    echo "  • DEPLOY_INSTRUCTIONS.md - 部署说明"
    echo
    echo "🚀 下一步操作:"
    echo "  1. 将 $PACKAGE_NAME 上传到服务器"
    echo "  2. 解压文件"
    echo "  3. 按照 DEPLOY_INSTRUCTIONS.md 进行部署"
    echo
    echo "💡 宝塔面板操作提示:"
    echo "  • 使用文件管理器上传压缩包"
    echo "  • 右键解压到指定目录"
    echo "  • 在终端中执行部署脚本"
    echo
}

# 主函数
main() {
    log_info "开始创建部署包..."
    
    check_environment
    build_project
    create_package
    create_archive
    cleanup
    show_package_info
    
    log_success "打包流程完成！"
}

# 执行主函数
main "$@"
