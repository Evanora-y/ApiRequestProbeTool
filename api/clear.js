// api/clear.js - 生产版清空日志API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

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
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Database configuration error'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取清空前的记录数
    const { count: beforeCount } = await supabase
      .from('api_requests')
      .select('*', { count: 'exact', head: true });

    // 删除所有记录
    const { error } = await supabase
      .from('api_requests')
      .delete()
      .neq('id', 0); // 删除所有记录的技巧

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      message: `成功清空 ${beforeCount || 0} 条日志记录`,
      deletedCount: beforeCount || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('清空日志失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}