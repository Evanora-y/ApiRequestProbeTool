// api/inspect.js - 调试版本
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true, message: 'CORS OK' });
  }

  try {
    // 检查环境变量
    console.log('🔧 环境变量检查:');
    console.log('SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置');
    console.log('SUPABASE_ANON_KEY:', supabaseKey ? '已设置' : '未设置');

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase环境变量未设置');
      return res.status(200).json({
        success: true,
        message: '请求已接收（无数据库连接）',
        timestamp: new Date().toISOString(),
        debug: 'Supabase环境变量未设置'
      });
    }

    // 初始化Supabase客户端
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase客户端已初始化');

    // 处理请求数据
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                    req.headers['x-real-ip'] || 
                    'unknown';

    // 构建简单的请求信息
    const requestInfo = {
      method: req.method,
      url: req.url,
      full_url: `https://${req.headers.host}${req.url}`,
      ip: clientIP,
      user_agent: req.headers['user-agent'] || null,
      browser: 'Unknown',
      os: 'Unknown',
      is_bot: false,
      country: req.headers['cf-ipcountry'] || null,
      city: req.headers['cf-ipcity'] || null,
      headers: JSON.stringify(req.headers),
      content_type: req.headers['content-type'] || null,
      accept: req.headers['accept'] || null,
      origin: req.headers['origin'] || null,
      referer: req.headers['referer'] || null,
      query_params: JSON.stringify(req.query || {}),
      query_count: Object.keys(req.query || {}).length,
      body_content: req.body ? JSON.stringify(req.body) : null,
      raw_body: typeof req.body === 'string' ? req.body : null,
      body_type: req.body ? (typeof req.body === 'object' ? 'json' : 'text') : 'empty',
      body_size: req.body ? JSON.stringify(req.body).length : 0,
      special_params: null,
      processing_time: Date.now() - startTime,
      response_status: 200,
      response_message: '调试测试',
      created_at: new Date().toISOString()
    };

    console.log('📋 请求信息:', {
      method: requestInfo.method,
      url: requestInfo.url,
      ip: requestInfo.ip,
      timestamp: requestInfo.created_at
    });

    // 测试数据库连接
    console.log('🔍 测试数据库连接...');
    
    // 先测试简单查询
    const { data: testData, error: testError } = await supabase
      .from('api_requests')
      .select('count(*)')
      .limit(1);
    
    if (testError) {
      console.error('❌ 数据库查询测试失败:', testError);
      return res.status(200).json({
        success: true,
        message: '请求已接收（数据库查询失败）',
        timestamp: new Date().toISOString(),
        debug: `数据库错误: ${testError.message}`
      });
    }

    console.log('✅ 数据库连接正常');

    // 尝试插入数据
    console.log('💾 尝试插入数据...');
    const { data: insertData, error: insertError } = await supabase
      .from('api_requests')
      .insert([requestInfo])
      .select();

    if (insertError) {
      console.error('❌ 数据插入失败:', insertError);
      console.error('插入的数据:', JSON.stringify(requestInfo, null, 2));
      
      return res.status(200).json({
        success: true,
        message: '请求已接收（数据保存失败）',
        timestamp: new Date().toISOString(),
        debug: `插入错误: ${insertError.message}`,
        errorDetails: insertError
      });
    }

    console.log('✅ 数据插入成功:', insertData);

    return res.status(200).json({
      success: true,
      message: '请求已接收并成功保存到数据库',
      timestamp: new Date().toISOString(),
      requestId: insertData?.[0]?.id || 'unknown',
      debug: '调试模式 - 数据已保存'
    });

  } catch (error) {
    console.error('💥 API处理异常:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}