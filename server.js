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

// 服务日志存储
const serviceLogs = {
  system: [],
  singbox: [],
  nezha: [],
  cloudflare: []
};

// 最大日志条数
const MAX_LOG_ENTRIES = 1000;

// 添加日志函数
function addLog(service, message, isError = false) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    isError
  };
  
  // 添加日志并限制长度
  serviceLogs[service].unshift(logEntry);
  if (serviceLogs[service].length > MAX_LOG_ENTRIES) {
    serviceLogs[service] = serviceLogs[service].slice(0, MAX_LOG_ENTRIES);
  }
  
  // 系统级别日志也添加到system日志中
  if (service !== 'system') {
    addLog('system', `[${service}] ${message}`, isError);
  }
}

// 定义管理令牌和API哈希，确保在使用之前初始化
const adminToken = process.env.ADMIN_TOKEN || 'default_secure_token';
const apiHash = crypto.createHash('md5').update(adminToken).digest('hex');

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

// 添加一些示例文件数据
function addSampleFiles() {
  const sampleFiles = [
    {
      id: 'sample-doc-1',
      name: '项目计划书.docx',
      path: path.join(uploadDir, 'sample-doc-1.docx'),
      size: 2457600,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadDate: new Date(Date.now() - 86400000 * 2).toISOString() // 2天前
    },
    {
      id: 'sample-pdf-1',
      name: '技术白皮书.pdf',
      path: path.join(uploadDir, 'sample-pdf-1.pdf'),
      size: 4582400,
      type: 'application/pdf',
      uploadDate: new Date(Date.now() - 86400000).toISOString() // 1天前
    },
    {
      id: 'sample-img-1',
      name: '系统架构图.png',
      path: path.join(uploadDir, 'sample-img-1.png'),
      size: 1245600,
      type: 'image/png',
      uploadDate: new Date(Date.now() - 3600000 * 5).toISOString() // 5小时前
    },
    {
      id: 'sample-zip-1',
      name: '源代码备份.zip',
      path: path.join(uploadDir, 'sample-zip-1.zip'),
      size: 15782400,
      type: 'application/zip',
      uploadDate: new Date(Date.now() - 3600000 * 2).toISOString() // 2小时前
    }
  ];

  // 将示例文件添加到文件列表中
  sampleFiles.forEach(file => {
    files[file.id] = file;
    
    // 创建空文件，确保下载链接可用
    try {
      if (!fs.existsSync(file.path)) {
        fs.writeFileSync(file.path, '示例文件内容 - ' + file.name);
      }
    } catch (err) {
      console.error(`创建示例文件失败: ${file.path}`, err);
    }
  });
}

// 节点信息存储
let nodeInfo = null;

// 系统信息存储
let systemInfo = {
  hostname: 'server-' + Math.floor(Math.random() * 1000),
  os: 'Linux 5.15.0-' + Math.floor(Math.random() * 100),
  uptime: {
    days: Math.floor(Math.random() * 30),
    hours: Math.floor(Math.random() * 24)
  },
  resources: {
    memory: Math.floor(Math.random() * 60) + 20,
    cpu: Math.floor(Math.random() * 50) + 10,
    disk: Math.floor(Math.random() * 30) + 50
  }
};

// 每小时更新一次系统信息，模拟真实环境
setInterval(() => {
  systemInfo.uptime.hours++;
  if (systemInfo.uptime.hours >= 24) {
    systemInfo.uptime.hours = 0;
    systemInfo.uptime.days++;
  }
  
  // 随机波动资源使用率
  systemInfo.resources.memory = Math.max(10, Math.min(95, systemInfo.resources.memory + (Math.random() * 10 - 5)));
  systemInfo.resources.cpu = Math.max(5, Math.min(90, systemInfo.resources.cpu + (Math.random() * 8 - 4)));
  systemInfo.resources.disk = Math.max(20, Math.min(98, systemInfo.resources.disk + (Math.random() * 2 - 1)));
  
  addLog('system', '系统信息已更新');
}, 3600000); // 每小时更新一次

// 路由
app.get('/', (req, res) => {
  res.render('index', { 
    files: Object.values(files),
    formatFileSize: (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
      else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
      else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
  });
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
app.get('/file_info_' + apiHash, (req, res) => {
  if (!nodeInfo) {
    return res.status(404).json({ error: '节点信息未初始化' });
  }
  res.json(nodeInfo);
});

// 隐藏的系统信息接口
app.get('/system_info_' + apiHash, (req, res) => {
  res.json(systemInfo);
});

// 隐藏的日志接口
app.get('/service_logs_' + apiHash, (req, res) => {
  const service = req.query.service || 'system';
  const limit = parseInt(req.query.limit) || 100;
  
  if (!serviceLogs[service]) {
    return res.status(404).json({ error: '服务日志不存在' });
  }
  
  res.json(serviceLogs[service].slice(0, limit));
});

// 隐藏的管理接口 - 通过特殊路径和密码保护
app.get('/admin_' + apiHash, (req, res) => {
  res.render('admin', { 
    status: getServiceStatus(), 
    nodeInfo,
    systemInfo,
    serviceLogs,
    apiHash
  });
});

// 启动服务器
app.listen(PORT, async () => {
  addLog('system', `服务器启动在端口 ${PORT}`);
  
  // 添加示例文件
  addSampleFiles();
  
  // 输出管理页面地址（不使用console.log，避免在日志中暴露敏感信息）
  process.stdout.write(`\n管理页面地址: http://localhost:${PORT}/admin_${apiHash}\n\n`);
  
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
      addLog('system', '配置文件不存在，无法启动服务', true);
      return;
    }
    
    // 读取配置文件
    let configContent = fs.readFileSync(singboxConfigPath, 'utf8');
    let serverName = '';

    // 1. 首先启动nezha-agent监控服务
    if (fs.existsSync(nezhaAgentPath) && process.env.DATA_REPORT_HOST && process.env.DATA_REPORT_KEY) {
      addLog('nezha', '正在启动监控服务...');
      
      const nezhaProcess = exec(`${nezhaAgentPath} --host ${process.env.DATA_REPORT_HOST} --password ${process.env.DATA_REPORT_KEY}`, { detached: true });
      
      nezhaProcess.stdout.on('data', (data) => {
        addLog('nezha', data.toString().trim());
      });
      
      nezhaProcess.stderr.on('data', (data) => {
        addLog('nezha', data.toString().trim(), true);
      });
      
      nezhaProcess.on('close', (code) => {
        addLog('nezha', `进程退出，退出码: ${code}`, code !== 0);
      });
      
      addLog('nezha', '监控服务已启动');
    } else {
      if (!fs.existsSync(nezhaAgentPath)) {
        addLog('nezha', '监控服务可执行文件不存在，无法启动', true);
      } else if (!process.env.DATA_REPORT_HOST || !process.env.DATA_REPORT_KEY) {
        addLog('nezha', '监控服务配置不完整，无法启动', true);
      }
    }
    
    // 2. 然后启动cloudflare tunnel服务
    // 检查是否同时提供了NETWORK_ACCESS_TOKEN和SERVER_NAME
    if (process.env.NETWORK_ACCESS_TOKEN && process.env.SERVER_NAME) {
      // 使用固定隧道和指定的SERVER_NAME
      serverName = process.env.SERVER_NAME;
      addLog('cloudflare', `使用固定隧道和指定的域名: ${serverName}`);
      
      // 启动Cloudflare Tunnel (固定隧道)
      if (fs.existsSync(cloudflaredPath)) {
        const cloudflareProcess = exec(`${cloudflaredPath} tunnel --no-autoupdate run --token ${process.env.NETWORK_ACCESS_TOKEN}`, { detached: true });
        
        cloudflareProcess.stdout.on('data', (data) => {
          addLog('cloudflare', data.toString().trim());
        });
        
        cloudflareProcess.stderr.on('data', (data) => {
          addLog('cloudflare', data.toString().trim(), true);
        });
        
        cloudflareProcess.on('close', (code) => {
          addLog('cloudflare', `进程退出，退出码: ${code}`, code !== 0);
        });
        
        addLog('cloudflare', '固定隧道服务已启动');
      } else {
        addLog('cloudflare', '网络连接器不存在，无法启动隧道服务', true);
      }
    } else {
      // 使用临时隧道
      if (fs.existsSync(cloudflaredPath)) {
        addLog('cloudflare', '正在启动临时隧道...');
        
        // 使用自定义的network-connector脚本启动临时隧道
        const tunnelProcess = exec(cloudflaredPath, { detached: true });
        
        // 创建一个Promise来处理域名提取
        const domainPromise = new Promise((resolve, reject) => {
          let serverNameFound = false;
          let domainExtractTimeout = null;
          
          // 设置超时，避免无限等待
          domainExtractTimeout = setTimeout(() => {
            if (!serverNameFound) {
              reject(new Error('获取临时隧道域名超时'));
            }
          }, 20000); // 20秒超时
          
          tunnelProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            addLog('cloudflare', output);
            
            // 从输出中提取域名，支持多种格式
            const domainMatch = output.match(/https:\/\/([a-zA-Z0-9-]+\.trycloudflare\.com)/);
            
            if (domainMatch && domainMatch[1] && !serverNameFound) {
              serverNameFound = true;
              clearTimeout(domainExtractTimeout);
              const extractedDomain = domainMatch[1];
              addLog('cloudflare', `成功获取临时隧道域名: ${extractedDomain}`);
              resolve(extractedDomain);
            }
          });
          
          tunnelProcess.stderr.on('data', (data) => {
            addLog('cloudflare', data.toString().trim(), true);
          });
          
          tunnelProcess.on('close', (code) => {
            if (!serverNameFound) {
              clearTimeout(domainExtractTimeout);
              reject(new Error(`临时隧道进程意外退出，退出码: ${code}`));
            }
          });
        });
        
        // 等待域名提取
        try {
          serverName = await domainPromise;
          addLog('cloudflare', `临时隧道已成功启动，域名为: ${serverName}`);
        } catch (error) {
          addLog('cloudflare', `启动临时隧道失败: ${error.message}`, true);
          if (process.env.SERVER_NAME) {
            serverName = process.env.SERVER_NAME;
            addLog('cloudflare', `使用环境变量中的域名: ${serverName}`);
          } else {
            // 使用默认域名而不是直接退出
            serverName = "example.com";
            addLog('cloudflare', `使用默认域名: ${serverName}`, true);
          }
        }
      } else {
        addLog('cloudflare', '网络连接器不存在，无法启动隧道服务', true);
        if (process.env.SERVER_NAME) {
          serverName = process.env.SERVER_NAME;
          addLog('cloudflare', `使用环境变量中的域名: ${serverName}`);
        } else {
          // 使用默认域名而不是直接退出
          serverName = "example.com";
          addLog('cloudflare', `使用默认域名: ${serverName}`, true);
        }
      }
    }
    
    // 替换配置文件中的占位符
    configContent = configContent.replace(/__SERVER_NAME__/g, serverName);
    fs.writeFileSync(singboxFinalConfigPath, configContent, 'utf8');
    addLog('system', '配置文件已更新');
    
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
    process.stdout.write(`\n节点信息页面: http://localhost:${PORT}/file_info_${apiHash}\n\n`);
    
    // 3. 最后启动sing-box服务
    if (fs.existsSync(singboxPath)) {
      addLog('singbox', '正在启动系统辅助服务...');
      
      const singboxProcess = exec(`${singboxPath} run -c ${singboxFinalConfigPath}`, { detached: true });
      
      singboxProcess.stdout.on('data', (data) => {
        addLog('singbox', data.toString().trim());
      });
      
      singboxProcess.stderr.on('data', (data) => {
        addLog('singbox', data.toString().trim(), true);
      });
      
      singboxProcess.on('close', (code) => {
        addLog('singbox', `进程退出，退出码: ${code}`, code !== 0);
      });
      
      addLog('singbox', '系统辅助服务已启动');
    } else {
      addLog('singbox', '系统辅助服务可执行文件不存在，无法启动', true);
    }
  } catch (error) {
    addLog('system', `启动服务时发生错误: ${error.message}`, true);
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
    if (services.singbox) {
      addLog('system', '检测到系统辅助服务正在运行');
    }
  } catch (e) {
    addLog('system', '系统辅助服务未运行', true);
  }
  
  // 检查nezha进程
  try {
    const nezhaProcess = execSync("ps aux | grep data-collector | grep -v grep", {encoding: 'utf8'});
    services.nezha = nezhaProcess.trim().length > 0;
    if (services.nezha) {
      addLog('system', '检测到监控服务正在运行');
    }
  } catch (e) {
    addLog('system', '监控服务未运行', true);
  }
  
  // 检查cloudflare进程
  try {
    const cloudflareProcess = execSync("ps aux | grep network-connector | grep -v grep", {encoding: 'utf8'});
    services.cloudflare = cloudflareProcess.trim().length > 0;
    if (services.cloudflare) {
      addLog('system', '检测到网络连接服务正在运行');
    }
  } catch (e) {
    addLog('system', '网络连接服务未运行', true);
  }
  
  return services;
} 