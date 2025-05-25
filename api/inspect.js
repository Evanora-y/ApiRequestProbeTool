// api/inspect.js - 使用Supabase存储
import { createClient } from '@supabase/supabase-js'

// Supabase配置 - 需要在环境变量中设置
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // 处理请求体
  let rawBody = '';
  let parsedBody = null;
  let bodyType = 'empty';

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

  // 构建请求信息
  const requestInfo = {
    method: req.method,
    url: req.url,
    full_url: `https://${req.headers.host}${req.url}`,
    ip: req.headers['x-forwarded-for'] || 
        req.headers['x-real-ip'] || 
        'unknown',
    user_agent: req.headers['user-agent'],
    headers: JSON.stringify(req.headers),
    query_params: JSON.stringify(req.query || {}),
    body_content: parsedBody ? JSON.stringify(parsedBody) : null,
    raw_body: rawBody,
    body_type: bodyType,
    content_type: req.headers['content-type'],
    content_length: req.headers['content-length'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    created_at: new Date().toISOString()
  };

  try {
    // 存储到Supabase
    const { data, error } = await supabase
      .from('api_requests')
      .insert([requestInfo])
      .select();

    if (error) {
      console.error('Supabase插入错误:', error);
    }

    console.log(`📥 [${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.url} from ${requestInfo.ip}`);
  } catch (error) {
    console.error('存储请求信息失败:', error);
  }

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true, message: 'CORS预检请求处理成功' });
  }

  // 返回给第三方程序的响应
  res.status(200).json({
    success: true,
    message: '请求已接收并记录',
    timestamp: new Date().toISOString(),
    requestId: Date.now().toString()
  });
}