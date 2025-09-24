#!/bin/bash

# SafeReach Backend 数据库设置脚本
# 用于在服务器上快速设置PostgreSQL数据库

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# 数据库配置
CONTAINER_NAME="safereach-postgres"
DB_NAME="safereach"
DB_USER="safereach"
DB_PASSWORD="SafeReach123!"
DB_PORT="5432"
POSTGRES_VERSION="16"

echo "🐳 设置 SafeReach PostgreSQL 数据库..."

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查容器是否已存在并运行
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "数据库容器已在运行"
    exit 0
fi

# 检查容器是否存在但未运行
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    log_info "启动现有数据库容器..."
    docker start "$CONTAINER_NAME"
else
    log_info "创建新的数据库容器..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -e POSTGRES_DB="$DB_NAME" \
        -e POSTGRES_USER="$DB_USER" \
        -e POSTGRES_PASSWORD="$DB_PASSWORD" \
        -p "$DB_PORT:5432" \
        -v postgres_data:/var/lib/postgresql/data \
        postgres:$POSTGRES_VERSION
fi

# 等待数据库启动
log_info "等待数据库启动..."
sleep 10

# 验证连接
if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    log_success "数据库设置完成"
    echo
    echo "📋 数据库信息:"
    echo "  • 容器名: $CONTAINER_NAME"
    echo "  • 数据库: $DB_NAME"
    echo "  • 用户: $DB_USER"
    echo "  • 端口: $DB_PORT"
    echo "  • 连接字符串: postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
else
    log_warning "数据库可能还在启动中"
fi
