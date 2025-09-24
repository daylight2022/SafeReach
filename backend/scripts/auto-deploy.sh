#!/bin/bash

# SafeReach Backend 自动化部署脚本
# 整合本地构建、上传和服务器部署的完整自动化流程

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

# 默认配置（可通过配置文件覆盖）
SERVER_HOST="1.12.60.17"
SERVER_USER="root"
SSH_KEY_PATH=""
REMOTE_DEPLOY_PATH="/home/workspace/safereach-backend"
REMOTE_BACKUP_PATH="/home/backup/safereach-backend"

echo "🚀 开始 SafeReach Backend 自动化部署..."

# 加载配置文件
load_config() {
    local config_file="scripts/deploy-config.sh"
    
    if [[ -f "$config_file" ]]; then
        log_info "加载部署配置..."
        source "$config_file"
        log_success "配置加载完成"
    else
        log_warning "未找到配置文件 $config_file，使用默认配置"
        log_info "请创建配置文件并设置以下变量："
        echo "  SERVER_HOST=\"1.12.60.17\""
        echo "  SERVER_USER=\"root\""
        echo "  SSH_KEY_PATH=\"/path/to/your/ssh/key\""
        echo "  REMOTE_DEPLOY_PATH=\"/home/workspace/safereach-backend\""
        echo "  REMOTE_BACKUP_PATH=\"/home/backup/safereach-backend\""
        
        if [[ -z "$SSH_KEY_PATH" ]]; then
            log_error "SSH密钥路径未设置，请设置 SSH_KEY_PATH 变量"
            exit 1
        fi
    fi
}

# 检查SSH连接
check_ssh_connection() {
    log_info "检查SSH连接..."
    
    local ssh_opts="-o ConnectTimeout=10 -o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY_PATH" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY_PATH"
    fi
    
    if ssh $ssh_opts "$SERVER_USER@$SERVER_HOST" "echo 'SSH连接成功'" > /dev/null 2>&1; then
        log_success "SSH连接正常"
    else
        log_error "SSH连接失败，请检查："
        echo "  • 服务器地址: $SERVER_HOST"
        echo "  • 用户名: $SERVER_USER"
        echo "  • SSH密钥: $SSH_KEY_PATH"
        exit 1
    fi
}

# 检查本地环境
check_local_environment() {
    log_info "检查本地构建环境..."
    
    if [[ ! -f "package.json" ]]; then
        log_error "未找到 package.json，请在项目根目录运行此脚本"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        log_error "ssh 未安装"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        log_error "scp 未安装"
        exit 1
    fi
    
    log_success "本地环境检查完成"
}

# 本地构建项目
build_project_locally() {
    log_info "开始本地构建..."
    
    # 清理旧的构建文件
    npm run clean 2>/dev/null || rm -rf dist
    
    # 安装依赖（包括开发依赖，用于构建）
    log_info "安装依赖..."
    npm install

    # 确保类型定义正确安装
    if [[ ! -d "node_modules/@types/jsonwebtoken" ]]; then
        log_info "安装缺失的类型定义..."
        npm install --save-dev @types/jsonwebtoken
    fi

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
create_deployment_package() {
    log_info "创建部署包..."
    
    # 创建临时构建目录
    mkdir -p "$BUILD_DIR"
    
    # 复制必要文件
    log_info "复制项目文件..."
    cp -r dist "$BUILD_DIR/"
    cp -r scripts "$BUILD_DIR/"
    cp package.json "$BUILD_DIR/"
    cp package-lock.json "$BUILD_DIR/" 2>/dev/null || log_warning "package-lock.json 不存在"
    cp drizzle.config.ts "$BUILD_DIR/" 2>/dev/null || log_warning "drizzle.config.ts 不存在"
    
    # 复制服务器部署配置
    cp -r server-deploy "$BUILD_DIR/"
    
    # 数据库迁移文件
    if [[ -d "drizzle" ]]; then
        cp -r drizzle "$BUILD_DIR/"
        log_info "已包含数据库迁移文件"
    else
        log_warning "drizzle 目录不存在，请先运行 npm run db:generate"
    fi
    
    # 创建压缩包
    tar -czf "$PACKAGE_NAME" "$BUILD_DIR"
    
    # 获取文件大小
    if command -v du &> /dev/null; then
        PACKAGE_SIZE=$(du -h "$PACKAGE_NAME" | cut -f1)
    else
        PACKAGE_SIZE="未知"
    fi
    
    log_success "部署包创建完成: $PACKAGE_NAME (大小: $PACKAGE_SIZE)"
}

# 上传到服务器
upload_to_server() {
    log_info "上传部署包到服务器..."
    
    local ssh_opts="-o ConnectTimeout=30 -o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY_PATH" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY_PATH"
    fi
    
    # 创建远程目录
    ssh $ssh_opts "$SERVER_USER@$SERVER_HOST" "mkdir -p /tmp/safereach-deploy"
    
    # 上传压缩包
    scp $ssh_opts "$PACKAGE_NAME" "$SERVER_USER@$SERVER_HOST:/tmp/safereach-deploy/"
    
    log_success "文件上传完成"
}

# 在服务器上执行部署
deploy_on_server() {
    log_info "在服务器上执行部署..."
    
    local ssh_opts="-o ConnectTimeout=30 -o StrictHostKeyChecking=no"
    if [[ -n "$SSH_KEY_PATH" ]]; then
        ssh_opts="$ssh_opts -i $SSH_KEY_PATH"
    fi
    
    # 创建远程部署脚本
    cat > /tmp/remote-deploy.sh << 'EOF'
#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PACKAGE_NAME="$1"
REMOTE_DEPLOY_PATH="$2"
REMOTE_BACKUP_PATH="$3"

log_info "开始服务器端部署..."

# 解压部署包
cd /tmp/safereach-deploy
tar -xzf "$PACKAGE_NAME"
BUILD_DIR=$(ls -d build-* | head -1)

if [[ -z "$BUILD_DIR" ]]; then
    log_error "未找到构建目录"
    exit 1
fi

cd "$BUILD_DIR"

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
fi

# 检查并安装PM2
if ! command -v pm2 &> /dev/null; then
    log_info "安装PM2..."
    npm install -g pm2
fi

# 备份现有版本
if [[ -d "$REMOTE_DEPLOY_PATH" ]]; then
    log_info "备份现有版本..."
    mkdir -p "$REMOTE_BACKUP_PATH"
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$REMOTE_DEPLOY_PATH" "$REMOTE_BACKUP_PATH/$BACKUP_NAME"
    log_success "备份完成: $REMOTE_BACKUP_PATH/$BACKUP_NAME"
fi

# 创建部署目录
mkdir -p "$REMOTE_DEPLOY_PATH"
mkdir -p "$REMOTE_DEPLOY_PATH/logs"

# 复制文件到部署目录
cp -r dist "$REMOTE_DEPLOY_PATH/"
cp -r scripts "$REMOTE_DEPLOY_PATH/"
cp package.json "$REMOTE_DEPLOY_PATH/"
cp package-lock.json "$REMOTE_DEPLOY_PATH/" 2>/dev/null || true
cp drizzle.config.ts "$REMOTE_DEPLOY_PATH/" 2>/dev/null || true
cp -r drizzle "$REMOTE_DEPLOY_PATH/" 2>/dev/null || true
cp server-deploy/ecosystem.config.cjs "$REMOTE_DEPLOY_PATH/"

# 配置环境变量
if [[ ! -f "$REMOTE_DEPLOY_PATH/.env" ]]; then
    cp server-deploy/.env.production "$REMOTE_DEPLOY_PATH/.env"
    log_info "已创建默认环境配置，请根据需要修改 $REMOTE_DEPLOY_PATH/.env"
fi

# 进入部署目录
cd "$REMOTE_DEPLOY_PATH"

# 安装依赖
log_info "安装生产依赖..."
if [[ -f "package-lock.json" ]]; then
    npm ci --only=production
else
    npm install --only=production
fi

# 数据库迁移
log_info "执行数据库迁移..."
if npm run db:migrate:prod 2>/dev/null; then
    log_success "数据库迁移完成"
else
    log_warning "数据库迁移失败，请手动执行"
fi

# 停止现有服务
pm2 stop safereach-backend 2>/dev/null || true
pm2 stop safereach-cron 2>/dev/null || true
pm2 delete safereach-backend 2>/dev/null || true
pm2 delete safereach-cron 2>/dev/null || true

# 启动服务
log_info "启动PM2服务..."
if pm2 start ecosystem.config.cjs --env production; then
    pm2 save
    pm2 startup 2>/dev/null || log_info "PM2 startup 已配置或需要手动配置"
    log_success "服务启动完成"
else
    log_error "服务启动失败"
    exit 1
fi

# 验证部署
sleep 5
if pm2 list | grep -q "safereach-backend.*online"; then
    log_success "主服务运行正常"
else
    log_error "主服务启动失败"
    pm2 logs safereach-backend --lines 20
    exit 1
fi

log_success "🎉 服务器端部署完成！"

# 清理临时文件
cd /
rm -rf /tmp/safereach-deploy

EOF
    
    # 上传并执行远程部署脚本
    scp $ssh_opts /tmp/remote-deploy.sh "$SERVER_USER@$SERVER_HOST:/tmp/"
    ssh $ssh_opts "$SERVER_USER@$SERVER_HOST" "chmod +x /tmp/remote-deploy.sh && /tmp/remote-deploy.sh '$PACKAGE_NAME' '$REMOTE_DEPLOY_PATH' '$REMOTE_BACKUP_PATH'"
    
    log_success "服务器部署完成"
}

# 清理本地临时文件
cleanup_local() {
    log_info "清理本地临时文件..."
    rm -rf "$BUILD_DIR"
    rm -f "$PACKAGE_NAME"
    rm -f /tmp/remote-deploy.sh
    log_success "清理完成"
}

# 显示部署信息
show_deployment_info() {
    log_success "🎉 自动化部署完成！"
    echo
    echo "📋 部署信息:"
    echo "  • 服务器: $SERVER_HOST"
    echo "  • 部署路径: $REMOTE_DEPLOY_PATH"
    echo "  • 服务端口: 3000"
    echo "  • API地址: http://$SERVER_HOST:3000"
    echo
    echo "🔧 远程管理命令:"
    echo "  • 查看状态: ssh $SERVER_USER@$SERVER_HOST 'pm2 status'"
    echo "  • 查看日志: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs safereach-backend'"
    echo "  • 重启服务: ssh $SERVER_USER@$SERVER_HOST 'pm2 restart safereach-backend'"
    echo
}

# 主函数
main() {
    load_config
    check_ssh_connection
    check_local_environment
    build_project_locally
    create_deployment_package
    upload_to_server
    deploy_on_server
    cleanup_local
    show_deployment_info
    
    log_success "自动化部署流程完成！"
}

# 执行主函数
main "$@"
