// api/inspect.js - 修复版探测API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

let supabase = null;

// 安全地初始化Supabase客户端
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey)
  }
} catch (error) {
  console.error('Supabase初始化失败:', error);
}

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
  
  try {
    // 设置基础CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // 处理CORS预检请求
    if (req.method === 'OPTIONS') {
      return res.status(200).json({
        success: true,
        message: 'CORS预检请求处理成功',
        timestamp: new Date().toISOString()
      });
    }

    // 处理请求体（简化版，避免复杂解析导致错误）
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
        }
      } catch (error) {
        console.error('请求体解析错误:', error);
        parsedBody = '[解析错误]';
        bodyType = 'error';
      }
    }

    // 解析查询参数中的特殊指令
    const specialParams = {};
    if (req.query._status) {
      const status = parseInt(req.query._status);
      if (!isNaN(status) && status >= 100 && status < 600) {
        specialParams.status = status;
      }
    }
    if (req.query._delay) {
      const delay = parseInt(req.query._delay);
      if (!isNaN(delay) && delay >= 0 && delay <= 10000) {
        specialParams.delay = delay;
      }
    }
    if (req.query._message) specialParams.message = req.query._message;
    if (req.query._error) specialParams.error = req.query._error;

    // 获取客户端真实IP
    const clientIP = req.headers['cf-connecting-ip'] || 
                    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                    req.headers['x-real-ip'] || 
                    req.connection?.remoteAddress || 
                    req.socket?.remoteAddress ||
                    'unknown';

    // 解析User-Agent
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|crawler|spider|scraper/i.test(userAgent);
    
    // 提取浏览器和操作系统信息
    let browser = 'Unknown';
    let os = 'Unknown';
    if (userAgent) {
      // 浏览器检测
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
      else if (userAgent.includes('Edg')) browser = 'Edge';
      else if (userAgent.includes('Opera')) browser = 'Opera';
      
      // 操作系统检测
      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac OS X') || userAgent.includes('macOS')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS')) os = 'iOS';
    }

    // 构建基础请求信息
    const requestInfo = {
      // 基本信息
      method: req.method,
      url: req.url,
      full_url: `https://${req.headers.host || 'unknown'}${req.url}`,
      protocol: req.headers['x-forwarded-proto'] || 'https',
      
      // 客户端信息
      ip: clientIP,
      user_agent: userAgent,
      browser: browser,
      os: os,
      is_bot: isBot,
      
      // 地理位置信息（如果有）
      country: req.headers['cf-ipcountry'] || null,
      city: req.headers['cf-ipcity'] || null,
      
      // 请求头（转换为JSON字符串）
      headers: JSON.stringify(req.headers),
      
      // 重要请求头（单独存储）
      content_type: req.headers['content-type'] || null,
      content_length: req.headers['content-length'] || (bodySize > 0 ? bodySize.toString() : null),
      accept: req.headers['accept'] || null,
      accept_language: req.headers['accept-language'] || null,
      accept_encoding: req.headers['accept-encoding'] || null,
      origin: req.headers['origin'] || null,
      referer: req.headers['referer'] || null,
      authorization: req.headers['authorization'] ? '[已隐藏]' : null,
      cookie: req.headers['cookie'] ? `[${(req.headers['cookie'].match(/=/g) || []).length}个Cookie]` : null,
      
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

    // 获取自定义响应配置
    let responseConfig = { ...DEFAULT_RESPONSE };
    
    if (supabase) {
      try {
        const { data } = await supabase
          .from('api_config')
          .select('value')
          .eq('key', 'inspect_response')
          .single();
        
        if (data && data.value && data.value.response) {
          responseConfig = data.value;
        }
      } catch (error) {
        console.log('获取配置失败，使用默认配置:', error.message);
      }
    }

    // 应用特殊参数覆盖
    if (specialParams.status) {
      responseConfig.response = responseConfig.response || {};
      responseConfig.response.status = specialParams.status;
    }
    if (specialParams.message) {
      responseConfig.response = responseConfig.response || {};
      responseConfig.response.body = responseConfig.response.body || {};
      responseConfig.response.body.message = specialParams.message;
    }
    if (specialParams.error) {
      responseConfig.response = responseConfig.response || {};
      responseConfig.response.body = responseConfig.response.body || {};
      responseConfig.response.body.error = specialParams.error;
      responseConfig.response.body.success = false;
    }

    // 应用延时
    if (specialParams.delay || (responseConfig.delay && responseConfig.delay > 0)) {
      const delay = specialParams.delay || responseConfig.delay;
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000)));
    }

    // 设置自定义响应头
    if (responseConfig.response && responseConfig.response.headers) {
      Object.entries(responseConfig.response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // 准备响应体
    let responseBody = responseConfig.response ? responseConfig.response.body : DEFAULT_RESPONSE.body;
    
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

    let responseBodyStr = JSON.stringify(responseBody);
    Object.entries(templateVars).forEach(([template, value]) => {
      responseBodyStr = responseBodyStr.replace(new RegExp(template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    try {
      responseBody = JSON.parse(responseBodyStr);
    } catch (error) {
      console.error('模板变量替换失败:', error);
      // 使用原始响应体
    }

    const finalStatus = (responseConfig.response && responseConfig.response.status) || 200;
    const finalMessage = (responseBody && responseBody.message) || '请求已处理';

    // 异步保存日志（不阻塞响应）
    if (supabase) {
      setImmediate(async () => {
        try {
          requestInfo.processing_time = Date.now() - startTime;
          requestInfo.response_status = finalStatus;
          requestInfo.response_message = finalMessage;
          
          await supabase
            .from('api_requests')
            .insert([requestInfo]);
        } catch (error) {
          console.error('保存日志失败:', error);
        }
      });
    }

    // 控制台输出
    console.log(`📥 [${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.url} from ${clientIP} -> ${finalStatus}`);

    // 返回响应
    return res.status(finalStatus).json(responseBody);

  } catch (error) {
    console.error('API处理错误:', error);
    
    // 返回错误响应
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '服务器内部错误',
      timestamp: new Date().toISOString(),
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}