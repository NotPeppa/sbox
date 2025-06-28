#!/bin/sh
set -e

# 创建临时配置文件，实际替换将由Node.js程序完成
cp /app/config/system-helper.conf /app/config/system-helper.conf.final

# 启动 Node.js 服务
exec node server.js 