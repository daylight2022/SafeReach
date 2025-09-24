#!/bin/bash

# SafeReach Backend 部署配置文件
# 请根据实际情况修改以下配置

# 服务器连接配置
SERVER_HOST="1.12.60.17"           # 服务器IP地址
SERVER_USER="root"                 # SSH用户名
SSH_KEY_PATH="scripts/ssh_key"     # 本地SSH私钥路径，例如: "/home/user/.ssh/id_rsa"

# 服务器路径配置
REMOTE_DEPLOY_PATH="/home/workspace/safereach-backend"    # 服务器部署目录
REMOTE_BACKUP_PATH="/home/backup/safereach-backend"      # 服务器备份目录

# 部署选项
SKIP_BUILD=false                   # 是否跳过本地构建（如果已经构建过）
SKIP_TESTS=false                   # 是否跳过测试
BACKUP_ENABLED=true                # 是否启用备份

# 数据库配置（可选，用于远程数据库操作）
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="safereach"
DB_USER="safereach"
DB_PASSWORD="SafeReach123!"

# 通知配置（可选）
NOTIFY_ON_SUCCESS=false            # 部署成功时是否发送通知
NOTIFY_ON_FAILURE=true             # 部署失败时是否发送通知
WEBHOOK_URL=""                     # Webhook通知地址

# 高级配置
SSH_TIMEOUT=30                     # SSH连接超时时间（秒）
UPLOAD_TIMEOUT=300                 # 文件上传超时时间（秒）
DEPLOY_TIMEOUT=600                 # 部署超时时间（秒）

# 环境变量（将在服务器上设置）
export NODE_ENV="production"
export PORT="3000"

# 日志配置
LOG_LEVEL="info"                   # 日志级别: debug, info, warn, error
LOG_FILE="deploy.log"              # 本地日志文件

echo "✅ 部署配置已加载"
echo "   服务器: $SERVER_HOST"
echo "   用户: $SERVER_USER"
echo "   部署路径: $REMOTE_DEPLOY_PATH"
