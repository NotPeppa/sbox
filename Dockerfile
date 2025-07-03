FROM node:18 AS builder

WORKDIR /build

# 安装构建依赖
COPY package*.json ./
# 安装编译工具和依赖
RUN apt-get update && \
    apt-get install -y build-essential python3 && \
    npm install --production

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
COPY bin/data-collector /app/bin/data-collector
RUN chmod +x /app/bin/data-collector

# 设置权限
RUN chmod +x /app/entrypoint.sh

# 暴露端口
EXPOSE 8080

# 启动命令
ENTRYPOINT ["/app/entrypoint.sh"] 