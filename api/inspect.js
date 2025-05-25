// api/inspect/[...path].js - 支持多页面监控的动态路由API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.error('❌ Supabase客户端初始化失败:', error);
  }
}

// 页面配置映射
const PAGE_CONFIGS = {
  'page1': {
    name: '首页',
    category: 'main',
    description: '网站首页监控'
  },
  'page2': {
    name: '产品页',
    category: 'product',
    description: '产品展示页面监控'
  },
  'checkout': {
    name: '结算页',
    category: 'conversion',
    description: '用户结算流程监控'
  },
  'user-profile': {
    name: '用户中心',
    category: 'user',
    description: '用户个人中心监控'
  },
  'api-webhook': {
    name: 'API回调',
    category: 'api',
    description: 'Webhook回调监控'
  }
};

const DEFAULT_RESPONSE = {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: {
    success: true,
    message: '请求已接收并记录',
    timestamp: '{{timestamp}}',
    requestId: '{{requestId}}',
    page: '{{page}}'
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // 解析页面路径
    const pathSegments = req.query.path || [];
    const pagePath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    const pageKey = pathSegments[0] || 'default';
    
    console.log(`📥 [${new Date().toLocaleString('zh-CN')}] 页面请求: ${pageKey} (${req.method} ${req.url})`);
    
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      return res.status(200).json({
        success: true,
        message: 'CORS预检请求处理成功',
        page: pageKey
      });
    }

    // 获取页面配置
    const pageConfig = PAGE_CONFIGS[pageKey] || {
      name: pageKey || '未知页面',
      category: 'unknown',
      description: `动态页面监控: ${pageKey}`
    };

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

    // 解析特殊参数
    const specialParams = {};
    if (req.query._status) specialParams.status = parseInt(req.query._status);
    if (req.query._delay) specialParams.delay = parseInt(req.query._delay);
    if (req.query._message) specialParams.message = req.query._message;
    if (req.query._error) specialParams.error = req.query._error;

    // 获取客户端信息
    const clientIP = req.headers['cf-connecting-ip'] || 
                    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                    req.headers['x-real-ip'] || 
                    'unknown';

    const userAgent = req.headers['user-agent'] || '';
    const isBot = /bot|crawler|spider|scraper|wget|curl/i.test(userAgent);
    
    // 解析浏览器和操作系统
    let browser = 'Unknown';
    let os = 'Unknown';
    
    if (userAgent) {
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
      else if (userAgent.includes('Edg')) browser = 'Edge';
      else if (userAgent.includes('Opera')) browser = 'Opera';
      else if (userAgent.includes('curl')) browser = 'cURL';
      else if (userAgent.includes('Postman')) browser = 'Postman';
      
      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac OS X') || userAgent.includes('macOS')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iOS')) os = 'iOS';
    }

    // 构建请求信息（包含页面信息）
    const requestInfo = {
      method: req.method,
      url: req.url,
      full_url: `https://${req.headers.host || 'unknown'}${req.url}`,
      
      // 页面相关信息
      page_key: pageKey,
      page_name: pageConfig.name,
      page_category: pageConfig.category,
      page_path: pagePath,
      
      // 客户端信息
      ip: clientIP,
      user_agent: userAgent,
      browser: browser,
      os: os,
      is_bot: isBot,
      country: req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || null,
      city: req.headers['cf-ipcity'] || req.headers['x-vercel-ip-city'] || null,
      
      // 请求详情
      headers: JSON.stringify(req.headers),
      content_type: req.headers['content-type'] || null,
      accept: req.headers['accept'] || null,
      accept_language: req.headers['accept-language'] || null,
      accept_encoding: req.headers['accept-encoding'] || null,
      origin: req.headers['origin'] || null,
      referer: req.headers['referer'] || null,
      auth_header: req.headers['authorization'] ? '[已隐藏]' : null,
      cookie_info: req.headers['cookie'] ? `[${(req.headers['cookie'].match(/=/g) || []).length}个Cookie]` : null,
      
      // 参数和请求体
      query_params: JSON.stringify(req.query || {}),
      query_count: Object.keys(req.query || {}).length,
      body_content: parsedBody ? JSON.stringify(parsedBody) : null,
      raw_body: rawBody || null,
      body_type: bodyType,
      body_size: bodySize,
      special_params: Object.keys(specialParams).length > 0 ? JSON.stringify(specialParams) : null,
      
      created_at: new Date().toISOString()
    };

    // 获取响应配置（可以根据页面定制不同配置）
    let responseConfig = { ...DEFAULT_RESPONSE };
    
    if (supabase) {
      try {
        // 尝试获取页面特定配置
        const { data: pageSpecificConfig } = await supabase
          .from('api_config')
          .select('value')
          .eq('key', `inspect_response_${pageKey}`)
          .single();
        
        if (pageSpecificConfig?.value) {
          responseConfig = pageSpecificConfig.value;
        } else {
          // 获取默认配置
          const { data: defaultConfig } = await supabase
            .from('api_config')
            .select('value')
            .eq('key', 'inspect_response')
            .single();
          
          if (defaultConfig?.value) {
            responseConfig = defaultConfig.value;
          }
        }
      } catch (error) {
        console.log('⚠️ 获取配置失败，使用默认配置');
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

    // 应用延时
    const delay = specialParams.delay || responseConfig.delay;
    if (delay && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000)));
    }

    // 处理响应体模板变量
    let responseBody = responseConfig.response?.body || DEFAULT_RESPONSE.body;
    
    const templateVars = {
      '{{timestamp}}': new Date().toISOString(),
      '{{requestId}}': Date.now().toString() + Math.random().toString(36).substr(2, 5),
      '{{method}}': req.method,
      '{{url}}': req.url,
      '{{ip}}': clientIP,
      '{{userAgent}}': userAgent,
      '{{processingTime}}': (Date.now() - startTime).toString(),
      '{{page}}': pageConfig.name,
      '{{pageKey}}': pageKey,
      '{{pageCategory}}': pageConfig.category
    };

    let responseBodyStr = JSON.stringify(responseBody);
    Object.entries(templateVars).forEach(([template, value]) => {
      responseBodyStr = responseBodyStr.replace(new RegExp(template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    try {
      responseBody = JSON.parse(responseBodyStr);
    } catch {
      console.log('⚠️ 模板变量替换失败');
    }

    const finalStatus = responseConfig.response?.status || 200;
    const finalMessage = responseBody?.message || '请求已处理';

    // 保存日志
    if (supabase) {
      try {
        const finalRequestInfo = {
          ...requestInfo,
          processing_time: Date.now() - startTime,
          response_status: finalStatus,
          response_message: finalMessage
        };

        const { data, error } = await supabase
          .from('api_requests')
          .insert([finalRequestInfo])
          .select();

        if (error) {
          console.error('❌ 数据库插入失败:', error);
        } else {
          console.log(`✅ 页面 ${pageConfig.name} 请求日志保存成功, ID: ${data?.[0]?.id}`);
        }
      } catch (saveError) {
        console.error('💥 保存日志异常:', saveError);
      }
    }

    // 设置响应头
    if (responseConfig.response?.headers) {
      Object.entries(responseConfig.response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    console.log(`📤 页面 ${pageConfig.name} 返回响应: ${finalStatus}`);

    return res.status(finalStatus).json(responseBody);

  } catch (error) {
    console.error('💥 API处理错误:', error);
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
}