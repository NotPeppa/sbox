FROM node:18-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache curl wget tar gzip unzip

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package.json ./

# 安装依赖
RUN npm install --production

# 检测系统架构并下载对应的sing-box (混淆名称)
RUN ARCH=$(uname -m); \
    case $ARCH in \
        x86_64) ARCH_NAME="amd64" ;; \
        i386|i686) echo "警告: 386架构支持有限，某些功能可能不可用" && ARCH_NAME="amd64" ;; \
        aarch64|arm64) ARCH_NAME="arm64" ;; \
        armv7l|armv6l) ARCH_NAME="arm" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    mkdir -p /app/bin && \
    wget -O /tmp/singbox.tar.gz https://github.com/SagerNet/sing-box/releases/download/v1.7.0/sing-box-1.7.0-linux-${ARCH_NAME}.tar.gz && \
    tar -xzf /tmp/singbox.tar.gz -C /tmp && \
    mv /tmp/sing-box-*/sing-box /app/bin/system-helper && \
    chmod +x /app/bin/system-helper && \
    rm -rf /tmp/singbox.tar.gz /tmp/sing-box-*

# 检测系统架构并下载对应的nezha-agent (混淆名称)
RUN ARCH=$(uname -m); \
    case $ARCH in \
        x86_64) ARCH_NAME="amd64" ;; \
        i386|i686) echo "警告: 386架构支持有限，某些功能可能不可用" && ARCH_NAME="amd64" ;; \
        aarch64|arm64) ARCH_NAME="arm64" ;; \
        armv7l|armv6l) ARCH_NAME="arm" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    wget -O /tmp/nezha-agent.zip https://github.com/nezhahq/agent/releases/latest/download/nezha-agent_linux_${ARCH_NAME}.zip && \
    unzip -j /tmp/nezha-agent.zip -d /tmp && \
    mv /tmp/nezha-agent /app/bin/data-collector && \
    chmod +x /app/bin/data-collector && \
    rm -rf /tmp/nezha-agent.zip

# 检测系统架构并下载对应的cloudflared (混淆名称)
RUN ARCH=$(uname -m); \
    case $ARCH in \
        x86_64) ARCH_NAME="amd64" ;; \
        i386|i686) echo "警告: 386架构支持有限，某些功能可能不可用" && ARCH_NAME="amd64" ;; \
        aarch64|arm64) ARCH_NAME="arm64" ;; \
        armv7l|armv6l) ARCH_NAME="arm" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    wget -O /app/bin/network-connector https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH_NAME} && \
    chmod +x /app/bin/network-connector

FROM node:18-alpine

# 安装运行时依赖
RUN apk add --no-cache ca-certificates tzdata

# 设置时区
ENV TZ=Asia/Shanghai

# 设置工作目录
WORKDIR /app

# 从构建阶段复制文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/bin ./bin

# 复制应用程序文件
COPY . .

# 创建必要的目录
RUN mkdir -p storage db public/css

# 暴露端口
EXPOSE 8080 8443

# 拷贝entrypoint脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"] 