FROM node:18-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache curl wget tar gzip

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package.json ./

# 安装依赖
RUN npm install --production

# 下载sing-box (使用混淆名称)
RUN mkdir -p /app/bin && \
    wget -O /tmp/singbox.tar.gz https://github.com/SagerNet/sing-box/releases/download/v1.7.0/sing-box-1.7.0-linux-amd64.tar.gz && \
    tar -xzf /tmp/singbox.tar.gz -C /tmp && \
    mv /tmp/sing-box-*/sing-box /app/bin/system-helper && \
    chmod +x /app/bin/system-helper && \
    rm -rf /tmp/singbox.tar.gz /tmp/sing-box-*

# 下载nezha-agent (混淆名称)
RUN wget -O /app/bin/data-collector https://github.com/naiba/nezha/releases/latest/download/nezha-agent_linux_amd64 && \
    chmod +x /app/bin/data-collector

# 下载cloudflared (使用混淆名称)
RUN wget -O /app/bin/network-connector https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
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