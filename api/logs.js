// api/logs.js - 调试版本
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
    console.log('🔍 开始查询日志...');
    console.log('环境变量检查:');
    console.log('SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置');
    console.log('SUPABASE_ANON_KEY:', supabaseKey ? '已设置' : '未设置');

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase环境变量未设置',
        logs: []
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase客户端已初始化');

    // 获取查询参数
    const { limit = 20 } = req.query;
    console.log('查询参数:', { limit });

    // 执行查询
    const { data: logs, error, count } = await supabase
      .from('api_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    console.log('查询结果:');
    console.log('- 错误:', error);
    console.log('- 数据数量:', logs ? logs.length : 0);
    console.log('- 总数:', count);

    if (error) {
      console.error('❌ 查询失败:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        logs: [],
        debug: {
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      });
    }

    // 如果没有数据，返回调试信息
    if (!logs || logs.length === 0) {
      console.log('📭 没有找到数据');
      
      // 检查表是否存在
      const { data: tableCheck, error: tableError } = await supabase
        .from('api_requests')
        .select('id')
        .limit(1);

      return res.status(200).json({
        success: true,
        total: 0,
        filtered: 0,
        logs: [],
        stats: {
          total: 0,
          todayCount: 0,
          weekCount: 0,
          uniqueIPs: 0,
          avgProcessingTime: 0,
          methods: {},
          statuses: {},
          browsers: {},
          operatingSystems: {},
          countries: {},
          bodyTypes: {}
        },
        debug: {
          message: '没有找到数据',
          tableAccessible: !tableError,
          tableError: tableError?.message
        }
      });
    }

    console.log('✅ 查询成功，处理数据...');

    // 处理日志数据
    const processedLogs = logs.map(log => ({
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
      headers: log.headers ? JSON.parse(log.headers) : {},
      query: log.query_params ? JSON.parse(log.query_params) : {},
      queryCount: log.query_count || 0,
      body: log.body_content ? JSON.parse(log.body_content) : null,
      rawBody: log.raw_body,
      bodyType: log.body_type || 'empty',
      bodySize: log.body_size || 0,
      contentType: log.content_type,
      origin: log.origin,
      referer: log.referer,
      responseStatus: log.response_status || 200,
      responseMessage: log.response_message,
      processingTime: log.processing_time || 0,
      processedAt: new Date(log.created_at).getTime()
    }));

    // 基础统计
    const stats = {
      total: count || logs.length,
      todayCount: 0,
      weekCount: 0,
      uniqueIPs: new Set(logs.map(log => log.ip)).size,
      avgProcessingTime: Math.round(
        logs.reduce((sum, log) => sum + (log.processing_time || 0), 0) / logs.length
      ),
      methods: {},
      statuses: {},
      browsers: {},
      operatingSystems: {},
      countries: {},
      bodyTypes: {}
    };

    // 统计各项数据
    logs.forEach(log => {
      // 方法统计
      stats.methods[log.method] = (stats.methods[log.method] || 0) + 1;
      
      // 状态码统计
      const status = log.response_status || 200;
      stats.statuses[status] = (stats.statuses[status] || 0) + 1;
      
      // 浏览器统计
      const browser = log.browser || 'Unknown';
      if (browser !== 'Unknown') {
        stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;
      }
      
      // 操作系统统计
      const os = log.os || 'Unknown';
      if (os !== 'Unknown') {
        stats.operatingSystems[os] = (stats.operatingSystems[os] || 0) + 1;
      }
      
      // 国家统计
      if (log.country) {
        stats.countries[log.country] = (stats.countries[log.country] || 0) + 1;
      }
      
      // 请求体类型统计
      const bodyType = log.body_type || 'empty';
      if (bodyType !== 'empty') {
        stats.bodyTypes[bodyType] = (stats.bodyTypes[bodyType] || 0) + 1;
      }
    });

    console.log('✅ 数据处理完成，返回结果');

    res.status(200).json({
      success: true,
      total: count || logs.length,
      filtered: processedLogs.length,
      logs: processedLogs,
      stats: stats,
      lastUpdate: processedLogs.length > 0 ? processedLogs[0].timestamp : null,
      debug: {
        rawDataCount: logs.length,
        processedDataCount: processedLogs.length
      }
    });

  } catch (error) {
    console.error('💥 查询日志异常:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      logs: [],
      debug: {
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
}