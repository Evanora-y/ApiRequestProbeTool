// api/inspect.js - 增强版探测API，支持自定义响应
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// 默认响应配置
const DEFAULT_RESPONSE = {
  status: 200,
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    success: true,
    message: '请求已接收并记录',
    timestamp: '{{timestamp}}',
    requestId: '{{requestId}}'
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // 处理请求体
  let rawBody = '';
  let parsedBody = null;
  let bodyType = 'empty';
  let bodySize = 0;

  if (req.body) {
    try {
      if (typeof req.body === 'string') {
        rawBody = req.body;
        bodySize = Buffer.byteLength(rawBody, 'utf8');
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
        bodySize = Buffer.byteLength(rawBody, 'utf8');
      } else {
        parsedBody = req.body;
        rawBody = String(req.body);
        bodySize = Buffer.byteLength(rawBody, 'utf8');
        bodyType = 'other';
      }
    } catch (error) {
      parsedBody = `[解析错误: ${error.message}]`;
      bodyType = 'error';
    }
  }

  // 解析查询参数中的特殊指令
  const specialParams = {};
  if (req.query._status) specialParams.status = parseInt(req.query._status);
  if (req.query._delay) specialParams.delay = parseInt(req.query._delay);
  if (req.query._message) specialParams.message = req.query._message;
  if (req.query._error) specialParams.error = req.query._error;

  // 获取客户端真实IP
  const clientIP = req.headers['cf-connecting-ip'] || 
                  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                  req.headers['x-real-ip'] || 
                  req.connection?.remoteAddress || 
                  'unknown';

  // 解析User-Agent
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /bot|crawler|spider|scraper/i.test(userAgent);
  
  // 提取浏览器和操作系统信息
  let browser = 'Unknown';
  let os = 'Unknown';
  if (userAgent) {
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';
  }

  // 构建详细的请求信息
  const requestInfo = {
    // 基本信息
    method: req.method,
    url: req.url,
    full_url: `https://${req.headers.host}${req.url}`,
    protocol: req.headers['x-forwarded-proto'] || 'https',
    
    // 客户端信息
    ip: clientIP,
    user_agent: userAgent,
    browser: browser,
    os: os,
    is_bot: isBot,
    
    // 地理位置信息（如果Cloudflare提供）
    country: req.headers['cf-ipcountry'] || null,
    city: req.headers['cf-ipcity'] || null,
    
    // 请求头（完整）
    headers: JSON.stringify(req.headers),
    
    // 重要请求头（单独存储）
    content_type: req.headers['content-type'] || null,
    content_length: req.headers['content-length'] || bodySize.toString(),
    accept: req.headers['accept'] || null,
    accept_language: req.headers['accept-language'] || null,
    accept_encoding: req.headers['accept-encoding'] || null,
    origin: req.headers['origin'] || null,
    referer: req.headers['referer'] || null,
    authorization: req.headers['authorization'] ? '[已隐藏]' : null,
    cookie: req.headers['cookie'] ? `[${(req.headers['cookie'].match(/;/g) || []).length + 1}个Cookie]` : null,
    
    // URL参数
    query_params: JSON.stringify(req.query || {}),
    query_count: Object.keys(req.query || {}).length,
    
    // 请求体信息
    body_content: parsedBody ? JSON.stringify(parsedBody) : null,
    raw_body: rawBody || null,
    body_type: bodyType,
    body_size: bodySize,
    
    // 特殊参数
    special_params: Object.keys(specialParams).length > 0 ? JSON.stringify(specialParams) : null,
    
    // 时间信息
    created_at: new Date().toISOString(),
    processing_time: null, // 稍后填充
    
    // 响应信息（稍后填充）
    response_status: null,
    response_message: null
  };

  // 异步保存日志（不阻塞响应）
  const saveLog = async (responseStatus, responseMessage) => {
    try {
      requestInfo.processing_time = Date.now() - startTime;
      requestInfo.response_status = responseStatus;
      requestInfo.response_message = responseMessage;
      
      const { error } = await supabase
        .from('api_requests')
        .insert([requestInfo]);

      if (error) {
        console.error('保存日志失败:', error);
      }
    } catch (error) {
      console.error('保存日志异常:', error);
    }
  };

  // 获取自定义响应配置
  let responseConfig = DEFAULT_RESPONSE;
  try {
    const { data } = await supabase
      .from('api_config')
      .select('value')
      .eq('key', 'inspect_response')
      .single();
    
    if (data && data.value) {
      responseConfig = data.value;
    }
  } catch (error) {
    // 使用默认配置
  }

  // 应用特殊参数覆盖
  if (specialParams.status) {
    responseConfig.response.status = specialParams.status;
  }
  if (specialParams.message) {
    responseConfig.response.body.message = specialParams.message;
  }
  if (specialParams.error) {
    responseConfig.response.body.error = specialParams.error;
    responseConfig.response.body.success = false;
  }

  // 设置基础CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    await saveLog(200, 'CORS预检请求');
    return res.status(200).json({
      success: true,
      message: 'CORS预检请求处理成功',
      timestamp: new Date().toISOString()
    });
  }

  // 应用延时
  if (responseConfig.delay && responseConfig.delay > 0) {
    await new Promise(resolve => setTimeout(resolve, Math.min(responseConfig.delay, 10000))); // 最大10秒
  }

  // 设置自定义响应头
  if (responseConfig.response.headers) {
    Object.entries(responseConfig.response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // 准备响应体
  let responseBody = responseConfig.response.body;
  
  // 替换模板变量
  const templateVars = {
    '{{timestamp}}': new Date().toISOString(),
    '{{requestId}}': Date.now().toString() + Math.random().toString(36).substr(2, 5),
    '{{method}}': req.method,
    '{{url}}': req.url,
    '{{ip}}': clientIP,
    '{{userAgent}}': userAgent,
    '{{processingTime}}': (Date.now() - startTime).toString()
  };

  const responseBodyStr = JSON.stringify(responseBody);
  let finalResponseBody = responseBodyStr;
  
  Object.entries(templateVars).forEach(([template, value]) => {
    finalResponseBody = finalResponseBody.replace(new RegExp(template, 'g'), value);
  });

  try {
    responseBody = JSON.parse(finalResponseBody);
  } catch {
    // 如果解析失败，使用原始响应体
  }

  const finalStatus = responseConfig.response.status || 200;
  const finalMessage = responseBody.message || '请求已处理';

  // 保存日志
  await saveLog(finalStatus, finalMessage);

  // 控制台输出
  console.log(`📥 [${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.url} from ${clientIP} -> ${finalStatus}`);

  // 返回响应
  res.status(finalStatus).json(responseBody);
}