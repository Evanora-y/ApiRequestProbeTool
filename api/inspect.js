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
        // 尝试解析为JSON
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
    // 基本请求信息
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    
    // 客户端信息
    ip: req.headers['x-forwarded-for'] || 
        req.headers['x-real-ip'] || 
        req.connection?.remoteAddress || 
        'unknown',
    userAgent: req.headers['user-agent'],
    
    // 请求头（排除敏感信息）
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([key]) => 
        !['cookie', 'authorization'].includes(key.toLowerCase())
      )
    ),
    
    // 敏感头信息（单独处理）
    sensitiveHeaders: {
      cookie: req.headers.cookie ? '[已隐藏]' : undefined,
      authorization: req.headers.authorization ? '[已隐藏]' : undefined,
    },
    
    // URL查询参数
    query: req.query || {},
    
    // 请求体信息
    body: parsedBody,
    rawBody: rawBody,
    bodyType: bodyType,
    
    // 其他有用信息
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    
    // Vercel特定信息
    vercelRegion: req.headers['x-vercel-deployment-url'],
    vercelId: req.headers['x-vercel-id'],
  };

  // 在Vercel的日志中打印信息
  console.log('\n' + '='.repeat(60));
  console.log(`📥 [${requestInfo.timestamp}] ${req.method} ${req.url}`);
  console.log(`🌐 IP: ${requestInfo.ip}`);
  console.log(`🔧 User-Agent: ${requestInfo.userAgent}`);
  
  if (Object.keys(requestInfo.query).length > 0) {
    console.log('🔍 查询参数:', JSON.stringify(requestInfo.query, null, 2));
  }
  
  if (parsedBody && bodyType !== 'empty') {
    console.log(`📦 请求体 (${bodyType}):`);
    console.log(typeof parsedBody === 'object' ? 
      JSON.stringify(parsedBody, null, 2) : parsedBody);
  }
  
  console.log('='.repeat(60));

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).json({
      message: 'CORS预检请求处理成功',
      timestamp: requestInfo.timestamp
    });
  }

  // 返回探测结果
  res.status(200).json({
    message: '✅ 请求信息探测成功',
    success: true,
    platform: 'Vercel Serverless',
    ...requestInfo
  });
}