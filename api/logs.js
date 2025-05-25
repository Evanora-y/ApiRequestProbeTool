// api/logs.js - 生产版日志查询API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Database configuration error',
        logs: []
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取查询参数
    const {
      limit = 50,
      method,
      ip,
      since,
      status,
      search,
      browser,
      os,
      country,
      hasBody,
      bodyType,
      page = 1,
      pageKey,        // 新增
      pageCategory    // 新增
    } = req.query;

    let query = supabase
      .from('api_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 应用过滤器
    if (method) query = query.eq('method', method.toUpperCase());
    if (ip) query = query.ilike('ip', `%${ip}%`);
    if (status) query = query.eq('response_status', parseInt(status));
    if (browser) query = query.eq('browser', browser);
    if (os) query = query.eq('os', os);
    if (country) query = query.eq('country', country);
    if (bodyType) query = query.eq('body_type', bodyType);
    if (hasBody === 'true') query = query.not('body_content', 'is', null);
    if (hasBody === 'false') query = query.is('body_content', null);
    if (since) query = query.gte('created_at', since);
    if (pageKey) query = query.eq('page_key', pageKey);
    if (pageCategory) query = query.eq('page_category', pageCategory);

    // 搜索功能
    if (search) {
      query = query.or(`url.ilike.%${search}%,user_agent.ilike.%${search}%,ip.ilike.%${search}%,referer.ilike.%${search}%`);
    }

    // 分页
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(parseInt(limit), 100);
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      throw error;
    }

    // 获取统计数据
    const { data: statsData } = await supabase
      .from('api_requests')
      .select('method, response_status, browser, os, country, body_type, created_at, processing_time, ip');

    // 处理日志数据
    const processedLogs = (logs || []).map(log => {
      try {
        return {
          id: log.id,
          timestamp: log.created_at,
          localTime: new Date(log.created_at).toLocaleString('zh-CN'),
          method: log.method,
          url: log.url,
          fullUrl: log.full_url,
          ip: log.ip,
          userAgent: log.user_agent,
          browser: log.browser || 'Unknown',
          os: log.os || 'Unknown',
          isBot: log.is_bot || false,
          country: log.country,
          city: log.city,
          headers: safeJsonParse(log.headers, {}),
          query: safeJsonParse(log.query_params, {}),
          queryCount: log.query_count || 0,
          body: safeJsonParse(log.body_content),
          rawBody: log.raw_body,
          bodyType: log.body_type || 'empty',
          bodySize: log.body_size || 0,
          contentType: log.content_type,
          contentLength: log.content_length,
          accept: log.accept,
          acceptLanguage: log.accept_language,
          acceptEncoding: log.accept_encoding,
          origin: log.origin,
          referer: log.referer,
          authHeader: log.auth_header,
          cookieInfo: log.cookie_info,
          specialParams: safeJsonParse(log.special_params),
          responseStatus: log.response_status || 200,
          responseMessage: log.response_message,
          processingTime: log.processing_time || 0,
          processedAt: new Date(log.created_at).getTime()
        };
      } catch (parseError) {
        console.error('日志解析错误:', parseError);
        return createFallbackLog(log);
      }
    });

    // 计算统计信息
    const stats = calculateStats(statsData || []);

    res.status(200).json({
      success: true,
      total: count || 0,
      filtered: processedLogs.length,
      page: pageNum,
      limit: limitNum,
      logs: processedLogs,
      stats: stats,
      lastUpdate: processedLogs.length > 0 ? processedLogs[0].timestamp : null
    });

  } catch (error) {
    console.error('查询日志失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      logs: [],
      stats: {}
    });
  }
}

// 安全的JSON解析函数
function safeJsonParse(jsonString, fallback = null) {
  if (!jsonString) return fallback;
  if (typeof jsonString === 'object') return jsonString;

  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

// 创建回退日志对象
function createFallbackLog(log) {
  return {
    id: log.id,
    timestamp: log.created_at,
    localTime: new Date(log.created_at).toLocaleString('zh-CN'),
    method: log.method || 'UNKNOWN',
    url: log.url || '',
    fullUrl: log.full_url || '',
    ip: log.ip || 'unknown',
    userAgent: log.user_agent || '',
    browser: log.browser || 'Unknown',
    os: log.os || 'Unknown',
    isBot: false,
    country: log.country,
    city: log.city,
    headers: {},
    query: {},
    queryCount: 0,
    body: null,
    rawBody: null,
    bodyType: 'empty',
    bodySize: 0,
    contentType: null,
    origin: null,
    referer: null,
    responseStatus: 200,
    responseMessage: 'Parse Error',
    processingTime: 0,
    processedAt: new Date(log.created_at).getTime()
  };
}

// 计算统计信息
function calculateStats(data) {
  const stats = {
    total: data.length,
    methods: {},
    statuses: {},
    browsers: {},
    operatingSystems: {},
    countries: {},
    bodyTypes: {},
    todayCount: 0,
    weekCount: 0,
    uniqueIPs: new Set(),
    avgProcessingTime: 0
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let totalProcessingTime = 0;
  let processingTimeCount = 0;

  data.forEach(item => {
    // 统计方法
    if (item.method) {
      stats.methods[item.method] = (stats.methods[item.method] || 0) + 1;
    }

    // 统计状态码
    if (item.response_status) {
      stats.statuses[item.response_status] = (stats.statuses[item.response_status] || 0) + 1;
    }

    // 统计浏览器
    if (item.browser && item.browser !== 'Unknown') {
      stats.browsers[item.browser] = (stats.browsers[item.browser] || 0) + 1;
    }

    // 统计操作系统
    if (item.os && item.os !== 'Unknown') {
      stats.operatingSystems[item.os] = (stats.operatingSystems[item.os] || 0) + 1;
    }

    // 统计国家
    if (item.country) {
      stats.countries[item.country] = (stats.countries[item.country] || 0) + 1;
    }

    // 统计请求体类型
    if (item.body_type && item.body_type !== 'empty') {
      stats.bodyTypes[item.body_type] = (stats.bodyTypes[item.body_type] || 0) + 1;
    }

    // 时间统计
    const itemDate = new Date(item.created_at);
    if (itemDate >= today) {
      stats.todayCount++;
    }
    if (itemDate >= weekAgo) {
      stats.weekCount++;
    }

    // 处理时间统计
    if (item.processing_time) {
      totalProcessingTime += item.processing_time;
      processingTimeCount++;
    }

    // 唯一IP统计
    if (item.ip && item.ip !== 'unknown') {
      stats.uniqueIPs.add(item.ip);
    }
  });

  stats.uniqueIPs = stats.uniqueIPs.size;
  stats.avgProcessingTime = processingTimeCount > 0 ? Math.round(totalProcessingTime / processingTimeCount) : 0;

  return stats;
}