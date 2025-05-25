// api/logs.js - 简化测试版本
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

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({
        success: false,
        error: 'Supabase环境变量未设置',
        logs: []
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 简单查询，获取最新10条记录
    const { data: logs, error } = await supabase
      .from('api_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('查询结果:', { error, dataCount: logs ? logs.length : 0 });

    if (error) {
      console.error('❌ 查询失败:', error);
      return res.status(200).json({
        success: false,
        error: error.message,
        logs: [],
        debug: error
      });
    }

    if (!logs || logs.length === 0) {
      console.log('📭 没有数据');
      return res.status(200).json({
        success: true,
        total: 0,
        filtered: 0,
        logs: [],
        stats: {
          total: 0,
          todayCount: 0,
          uniqueIPs: 0,
          avgProcessingTime: 0,
          methods: {},
          browsers: {},
          countries: {},
          statuses: {}
        },
        lastUpdate: null,
        debug: '没有找到数据'
      });
    }

    // 简单处理数据，避免复杂的JSON解析
    const processedLogs = logs.map(log => ({
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
      country: log.country || null,
      headers: {}, // 简化，先不解析复杂JSON
      query: {}, // 简化
      body: null, // 简化
      bodyType: log.body_type || 'empty',
      contentType: log.content_type || null,
      responseStatus: log.response_status || 200,
      responseMessage: log.response_message || '',
      processingTime: log.processing_time || 0,
      processedAt: new Date(log.created_at).getTime()
    }));

    // 简单统计
    const stats = {
      total: logs.length,
      todayCount: logs.length, // 简化
      uniqueIPs: new Set(logs.map(log => log.ip)).size,
      avgProcessingTime: Math.round(
        logs.reduce((sum, log) => sum + (log.processing_time || 0), 0) / logs.length
      ) || 0,
      methods: {},
      browsers: {},
      countries: {},
      statuses: {}
    };

    // 统计方法
    logs.forEach(log => {
      const method = log.method || 'UNKNOWN';
      stats.methods[method] = (stats.methods[method] || 0) + 1;
      
      const browser = log.browser || 'Unknown';
      if (browser !== 'Unknown') {
        stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;
      }
      
      if (log.country) {
        stats.countries[log.country] = (stats.countries[log.country] || 0) + 1;
      }
      
      const status = log.response_status || 200;
      stats.statuses[status] = (stats.statuses[status] || 0) + 1;
    });

    console.log('✅ 返回数据:', processedLogs.length, '条记录');

    return res.status(200).json({
      success: true,
      total: logs.length,
      filtered: processedLogs.length,
      logs: processedLogs,
      stats: stats,
      lastUpdate: processedLogs[0]?.timestamp || null,
      debug: `成功获取 ${processedLogs.length} 条记录`
    });

  } catch (error) {
    console.error('💥 查询异常:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      logs: [],
      debug: error.stack
    });
  }
}