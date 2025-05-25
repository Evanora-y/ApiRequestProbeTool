// api/inspect.js - 主要的探测API
let requestLogs = []; // 内存存储（简单方案）
const MAX_LOGS = 100; // 最多保存100条记录

export default async function handler(req, res) {
  // 获取原始请求体
  let rawBody = '';
  let parsedBody = null;
  let bodyType = 'empty';

  // 处理请求体
  if (req.body) {
    try {
      if (typeof req.body === 'string') {
        rawBody = req.body;
        bodyType = 'text';
        try {
          parsedBody = JSON.parse(req.body);
          bodyType = 'json';
        } catch {
          parsedBody = req.body;
        }
      } else if (typeof req.body === 'object') {
        parsedBody = req.body;
        bodyType = 'json';
        rawBody = JSON.stringify(req.body);
      } else {
        parsedBody = req.body;
        rawBody = String(req.body);
        bodyType = 'other';
      }
    } catch (error) {
      parsedBody = `[解析错误: ${error.message}]`;
      bodyType = 'error';
    }
  }

  // 构建请求信息对象
  const requestInfo = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    localTime: new Date().toLocaleString('zh-CN'),
    method: req.method,
    url: req.url,
    fullUrl: `https://${req.headers.host}${req.url}`,
    
    // 客户端信息
    ip: req.headers['x-forwarded-for'] || 
        req.headers['x-real-ip'] || 
        req.connection?.remoteAddress || 
        'unknown',
    userAgent: req.headers['user-agent'],
    
    // 请求头
    headers: req.headers,
    
    // URL查询参数
    query: req.query || {},
    
    // 请求体信息
    body: parsedBody,
    rawBody: rawBody,
    bodyType: bodyType,
    
    // 其他信息
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    
    // 处理时间
    processedAt: Date.now()
  };

  // 存储到内存中（保持最新的100条记录）
  requestLogs.unshift(requestInfo);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs = requestLogs.slice(0, MAX_LOGS);
  }

  console.log(`📥 [${requestInfo.localTime}] ${req.method} ${req.url} from ${requestInfo.ip}`);

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      message: 'CORS预检请求处理成功',
      timestamp: requestInfo.timestamp,
      success: true
    });
  }

  // 返回给第三方程序的简单响应
  res.status(200).json({
    success: true,
    message: '请求已接收',
    timestamp: requestInfo.timestamp,
    requestId: requestInfo.id
  });
}

// 导出requestLogs供其他API使用
export { requestLogs };