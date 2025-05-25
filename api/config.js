// api/config.js - 配置管理API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// 默认配置
const DEFAULT_CONFIG = {
  response: {
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
  },
  delay: 0, // 响应延时（毫秒）
  enableLogging: true
};

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // 获取当前配置
      const { data, error } = await supabase
        .from('api_config')
        .select('*')
        .eq('key', 'inspect_response')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      const config = data ? data.value : DEFAULT_CONFIG;

      res.status(200).json({
        success: true,
        config: config,
        isDefault: !data
      });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      // 保存配置
      const newConfig = req.body;

      // 验证配置格式
      if (!newConfig.response || typeof newConfig.response.status !== 'number') {
        return res.status(400).json({
          success: false,
          error: '配置格式错误：需要包含response.status'
        });
      }

      // 保存到数据库
      const { error } = await supabase
        .from('api_config')
        .upsert({
          key: 'inspect_response',
          value: newConfig,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      res.status(200).json({
        success: true,
        message: '配置已保存',
        config: newConfig
      });

    } else {
      res.status(405).json({
        success: false,
        error: '不支持的请求方法'
      });
    }

  } catch (error) {
    console.error('配置操作失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}