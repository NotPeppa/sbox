#!/bin/bash

# 设置工作目录
cd /app || exit 1

# 设置默认环境变量
export PORT=${PORT:-8080}
export ADMIN_TOKEN=${ADMIN_TOKEN:-"admin_token_$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')"}
export SESSION_SECRET=${SESSION_SECRET:-"$(head -c 32 /dev/urandom | base64 | tr -d '\n')"}

# 哪吒监控配置
export DATA_REPORT_HOST=${DATA_REPORT_HOST:-""}
export DATA_REPORT_PORT=${DATA_REPORT_PORT:-"5555"}
export DATA_REPORT_KEY=${DATA_REPORT_KEY:-""}

# Cloudflare 隧道配置
export NETWORK_ACCESS_TOKEN=${NETWORK_ACCESS_TOKEN:-""}
export SERVER_NAME=${SERVER_NAME:-""}

# 创建必要的目录
mkdir -p storage/files
mkdir -p db

# 输出配置信息
echo "=== 系统配置信息 ==="
echo "端口: $PORT"
echo "管理令牌: $ADMIN_TOKEN"
echo "哪吒监控服务器: $DATA_REPORT_HOST"
echo "哪吒监控端口: $DATA_REPORT_PORT"
echo "服务器名称: ${SERVER_NAME:-"自动获取"}"
echo "===================="

# 启动应用
exec node server.js 