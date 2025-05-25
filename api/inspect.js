// api/inspect.js - 生产版API探测器
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

let supabase = null;

// 初始化Supabase客户端
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
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
    // 设置CORS头
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

    // 处理请求体
    let rawBody = '';
    let parsedBody = null;
    let bodyType = 'empty';
    let bodySize = 0;

    if (req.body) {
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

    // 获取客户端信息
    const clientIP = req.headers['cf-connecting-ip'] || 
                    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                    req.headers['x-real-ip'] || 
                    req.connection?.remoteAddress || 
                    req.socket?.remoteAddress ||
                    'unknown';

    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|crawler|spider|scraper|wget|curl/i.test(userAgent);
    
    // 解析浏览器和操作系统
    let browser = 'Unknown';
    let os = 'Unknown';
    
    if (userAgent) {
      // 浏览器检测
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
      else if (userAgent.includes('Edg')) browser = 'Edge';
      else if (userAgent.includes('Opera')) browser = 'Opera';
      else if (userAgent.includes('curl')) browser = 'cURL';
      else if (userAgent.includes('wget')) browser = 'Wget';
      else if (userAgent.includes('Postman')) browser = 'Postman';
      
      // 操作系统检测
      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac OS X') || userAgent.includes('macOS')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS')) os = 'iOS';
    }

    // 构建请求信息
    const requestInfo = {
      method: req.method,
      url: req.url,
      full_url: `https://${req.headers.host || 'unknown'}${req.url}`,
      protocol: req.headers['x-forwarded-proto'] || 'https',
      ip: clientIP,
      user_agent: userAgent,
      browser: browser,
      os: os,
      is_bot: isBot,
      country: req.headers['cf-ipcountry'] || null,
      city: req.headers['cf-ipcity'] || null,
      headers: JSON.stringify(req.headers),
      content_type: req.headers['content-type'] || null,
      content_length: req.headers['content-length'] || (bodySize > 0 ? bodySize.toString() : null),
      accept: req.headers['accept'] || null,
      accept_language: req.headers['accept-language'] || null,
      accept_encoding: req.headers['accept-encoding'] || null,
      origin: req.headers['origin'] || null,
      referer: req.headers['referer'] || null,
      auth_header: req.headers['authorization'] ? '[已隐藏]' : null,
      cookie_info: req.headers['cookie'] ? `[${(req.headers['cookie'].match(/=/g) || []).length}个Cookie]` : null,
      query_params: JSON.stringify(req.query || {}),
      query_count: Object.keys(req.query || {}).length,
      body_content: parsedBody ? JSON.stringify(parsedBody) : null,
      raw_body: rawBody || null,
      body_type: bodyType,
      body_size: bodySize,
      special_params: Object.keys(specialParams).length > 0 ? JSON.stringify(specialParams) : null,
      created_at: new Date().toISOString()
    };

    // 获取响应配置
    let responseConfig = { ...DEFAULT_RESPONSE };
    
    if (supabase) {
      try {
        const { data } = await supabase
          .from('api_config')
          .select('value')
          .eq('key', 'inspect_response')
          .single();
        
        if (data?.value?.response) {
          responseConfig = data.value;
        }
      } catch (error) {
        // 使用默认配置
      }
    }

    // 应用特殊参数
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
    const delay = specialParams.delay || responseConfig.delay;
    if (delay && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000)));
    }

    // 设置响应头
    if (responseConfig.response?.headers) {
      Object.entries(responseConfig.response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // 处理响应体和模板变量
    let responseBody = responseConfig.response?.body || DEFAULT_RESPONSE.body;
    
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
    } catch {
      // 使用原始响应体
    }

    const finalStatus = responseConfig.response?.status || 200;
    const finalMessage = responseBody?.message || '请求已处理';

    // 异步保存日志
    if (supabase) {
      setImmediate(async () => {
        try {
          requestInfo.processing_time = Date.now() - startTime;
          requestInfo.response_status = finalStatus;
          requestInfo.response_message = finalMessage;
          
          await supabase.from('api_requests').insert([requestInfo]);
        } catch (error) {
          console.error('日志保存失败:', error.message);
        }
      });
    }

    // 返回响应
    return res.status(finalStatus).json(responseBody);

  } catch (error) {
    console.error('API处理错误:', error.message);
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
}