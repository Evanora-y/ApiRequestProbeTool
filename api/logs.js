// api/logs.js - 从Supabase查询日志
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 获取查询参数
    const { limit = 50, method, ip, since } = req.query;
    
    let query = supabase
      .from('api_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // 按方法过滤
    if (method) {
      query = query.eq('method', method.toUpperCase());
    }

    // 按IP过滤
    if (ip) {
      query = query.ilike('ip', `%${ip}%`);
    }

    // 按时间过滤
    if (since) {
      query = query.gte('created_at', since);
    }

    // 限制数量
    const limitNum = Math.min(parseInt(limit), 100); // 最大100条
    query = query.limit(limitNum);

    const { data: logs, error } = await query;

    if (error) {
      throw error;
    }

    // 处理数据格式，转换为前端需要的格式
    const processedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      localTime: new Date(log.created_at).toLocaleString('zh-CN'),
      method: log.method,
      url: log.url,
      fullUrl: log.full_url,
      ip: log.ip,
      userAgent: log.user_agent,
      headers: JSON.parse(log.headers || '{}'),
      query: JSON.parse(log.query_params || '{}'),
      body: log.body_content ? JSON.parse(log.body_content) : null,
      rawBody: log.raw_body,
      bodyType: log.body_type,
      contentType: log.content_type,
      contentLength: log.content_length,
      origin: log.origin,
      referer: log.referer,
      processedAt: new Date(log.created_at).getTime()
    }));

    res.status(200).json({
      success: true,
      total: processedLogs.length,
      filtered: processedLogs.length,
      logs: processedLogs,
      lastUpdate: processedLogs.length > 0 ? processedLogs[0].timestamp : null
    });

  } catch (error) {
    console.error('查询日志失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      logs: []
    });
  }
}