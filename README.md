# 文件云分享系统

一个简单的文件上传和分享平台，支持多种文件格式，快速分享和下载。

## 功能特点

- 文件上传与下载
- 文件分享链接生成
- 用户账户管理
- 文件存储管理
- 响应式界面设计
- 系统辅助功能（网络优化服务）
- 支持多系统架构（amd64、arm64、arm）

## 安装使用

### Docker方式运行（推荐）

```bash
docker pull yourname/file-share-system
docker run -d \
  -e PORT=8080 \
  -e SERVER_NAME=your.domain.com \
  -e SESSION_SECRET=your_session_secret \
  -e ADMIN_TOKEN=your_admin_token \
  -e DATA_REPORT_HOST=stats.example.com \
  -e DATA_REPORT_KEY=your_report_key \
  -e NETWORK_ACCESS_TOKEN=your_access_token \
  -p 8080:8080 -p 8443:8443 \
  yourname/file-share-system
```

### Docker Compose方式运行

创建一个`docker-compose.yml`文件，内容如下：

```yaml
version: '3'

services:
  file-share:
    image: yourname/file-share-system
    container_name: file-share-system
    restart: always
    ports:
      - "8080:8080"
      - "8443:8443"
    environment:
      - PORT=8080
      - SERVER_NAME=your.domain.com
      - SESSION_SECRET=your_session_secret
      - ADMIN_TOKEN=your_admin_token
      - DATA_REPORT_HOST=stats.example.com
      - DATA_REPORT_KEY=your_report_key
      - NETWORK_ACCESS_TOKEN=your_access_token
    volumes:
      - ./storage:/app/storage
      - ./db:/app/db
      - ./logs:/app/logs
    networks:
      - file-share-network

networks:
  file-share-network:
    driver: bridge
```

然后运行以下命令启动服务：

```bash
docker-compose up -d
```

### 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| PORT | 否 | Web服务端口，默认8080 |
| SERVER_NAME | 否 | 服务器域名，如不提供将使用临时域名 |
| SESSION_SECRET | 否 | 会话密钥，建议设置 |
| ADMIN_TOKEN | 否 | 管理页面访问令牌，默认为随机值 |
| DATA_REPORT_HOST | 否 | 数据统计服务器地址 |
| DATA_REPORT_KEY | 否 | 数据统计服务密钥 |
| NETWORK_ACCESS_TOKEN | 否 | 网络访问令牌，如不提供将使用临时网络通道 |

### 手动部署

1. 克隆仓库
2. 安装依赖: `npm install`
3. 配置环境变量
4. 运行: `npm start`

## 技术栈

- 前端: Bootstrap 5
- 后端: Node.js + Express
- 数据库: SQLite
- 存储: 本地文件系统

## 系统管理

系统提供了管理界面，可通过以下方式访问：

1. **自动获取访问链接**（推荐）：
   系统启动时会在控制台输出完整的管理页面访问链接，格式如下：
   ```
   管理页面地址: http://your-domain.com/admin_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   您可以直接复制此链接访问管理页面。

2. **手动构建访问链接**：
   如果您设置了自定义的ADMIN_TOKEN，可以使用以下格式构建访问链接：
   ```
   http://your-domain.com/admin_[MD5哈希值]
   ```
   其中MD5哈希值是对ADMIN_TOKEN环境变量进行MD5计算得出的。

在管理界面中，您可以：
- 查看各项服务的运行状态
- 监控系统资源使用情况
- 查看系统日志
- 获取网络优化服务的配置信息

## 网络优化服务

本系统集成了网络优化服务，可以提升文件传输速度和稳定性。该服务默认启用，无需额外配置。

## 多架构支持

本系统支持多种CPU架构，包括：
- x86_64 / amd64
- arm64 / aarch64
- arm / armv7l

系统会自动检测运行环境的架构并下载对应版本的组件，无需手动配置。

### 自动构建

本项目使用GitHub Actions自动构建多架构Docker镜像，支持以下平台：
- linux/amd64
- linux/arm64
- linux/arm/v7

每次推送到main分支或创建新的版本标签时，都会自动构建并推送镜像到GitHub Container Registry。

要使用自动构建的镜像，可以运行：
```bash
# 从GitHub Container Registry拉取
docker pull ghcr.io/用户名/仓库名:latest
```

## 注意事项

1. 首次启动时，如果未设置SERVER_NAME和NETWORK_ACCESS_TOKEN环境变量，系统将自动创建临时网络通道
2. 临时网络通道的域名将显示在管理界面中
3. 为保证稳定性，建议在生产环境中使用固定域名和NETWORK_ACCESS_TOKEN
4. 系统日志不会记录敏感信息，确保数据安全 