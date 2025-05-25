// api/clear.js - 清空日志API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      error: '只支持DELETE方法'
    });
  }

  try {
    // 删除所有记录
    const { error } = await supabase
      .from('api_requests')
      .delete()
      .neq('id', 0); // 删除所有记录的技巧

    if (error) {
      throw error;
    }

    console.log('🗑️ 所有API请求日志已清空');

    res.status(200).json({
      success: true,
      message: '所有日志已成功清空',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('清空日志失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}