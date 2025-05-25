🔍 API请求监控系统
一个功能强大的API请求探测和监控系统，专为调试第三方应用程序与API的交互而设计。
📋 项目概述
🎯 主要功能

API请求探测: 接收并记录第三方程序发送的所有HTTP请求
实时监控面板: 可视化查看请求详情、统计分析和实时数据
智能响应配置: 自定义API返回内容、状态码和响应延时
数据持久化: 使用Supabase数据库存储所有请求记录
多维度分析: 按方法、IP、浏览器、地区等维度分析请求

🏗️ 技术架构

前端: 现代化响应式Web面板（HTML5 + CSS3 + JavaScript）
后端: Vercel无服务器函数（Node.js）
数据库: Supabase PostgreSQL
部署: Vercel平台自动部署

🚀 部署指南
1. 准备工作
创建Supabase项目

访问 supabase.com 注册账户
创建新项目，选择合适的地区（推荐新加坡）
在项目的 Settings > API 页面获取：

Project URL
anon public key



创建数据表
在Supabase的 SQL Editor 中执行以下SQL：
sql-- 创建API请求日志表
CREATE TABLE api_requests (
  id BIGSERIAL PRIMARY KEY,
  method VARCHAR(10) NOT NULL,
  url TEXT NOT NULL,
  full_url TEXT,
  protocol VARCHAR(10) DEFAULT 'https',
  ip VARCHAR(50),
  user_agent TEXT,
  browser VARCHAR(50) DEFAULT 'Unknown',
  os VARCHAR(50) DEFAULT 'Unknown',
  is_bot BOOLEAN DEFAULT FALSE,
  country VARCHAR(10),
  city VARCHAR(100),
  headers JSONB,
  content_type VARCHAR(100),
  accept VARCHAR(200),
  accept_language VARCHAR(100),
  accept_encoding VARCHAR(100),
  origin VARCHAR(200),
  referer TEXT,
  auth_header VARCHAR(20),
  cookie_info VARCHAR(50),
  query_params JSONB,
  query_count INTEGER DEFAULT 0,
  body_content JSONB,
  raw_body TEXT,
  body_type VARCHAR(20) DEFAULT 'empty',
  body_size INTEGER DEFAULT 0,
  special_params JSONB,
  processing_time INTEGER,
  response_status INTEGER DEFAULT 200,
  response_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建配置表
CREATE TABLE api_config (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_api_requests_created_at ON api_requests(created_at DESC);
CREATE INDEX idx_api_requests_method ON api_requests(method);
CREATE INDEX idx_api_requests_ip ON api_requests(ip);
CREATE INDEX idx_api_requests_response_status ON api_requests(response_status);

-- 启用行级安全并创建策略
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on api_requests" ON api_requests FOR ALL USING (true);
CREATE POLICY "Allow all operations on api_config" ON api_config FOR ALL USING (true);
2. 部署到Vercel
项目文件结构
project/
├── api/
│   ├── inspect.js      # 主要探测API
│   ├── logs.js         # 日志查询API
│   ├── config.js       # 配置管理API
│   └── clear.js        # 清空日志API
├── dashboard.html      # 管理面板
├── package.json        # 依赖配置
└── vercel.json        # Vercel配置（可选）
package.json
json{
  "name": "api-inspector",
  "version": "1.0.0",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  }
}
部署步骤

将代码推送到GitHub仓库
在 vercel.com 连接GitHub仓库
在Vercel项目设置中添加环境变量：

SUPABASE_URL: 你的Supabase项目URL
SUPABASE_ANON_KEY: 你的anon public密钥


等待自动部署完成

📖 使用方法
🔗 访问地址

API探测端点: https://你的域名.vercel.app/api/inspect
管理面板: https://你的域名.vercel.app/dashboard.html

📊 管理面板功能
1. 请求日志面板

实时监控: 自动每10秒刷新数据
多维筛选:

搜索关键词（URL、IP、User-Agent）
按请求方法筛选（GET、POST、PUT等）
按响应状态码筛选
按浏览器、IP地址筛选


详细信息: 点击任意请求展开完整详情
分页浏览: 支持大量数据的分页显示

2. 响应配置面板

状态码设置: 200、201、400、401、404、500等
响应延时: 0-10000毫秒模拟网络延迟
自定义响应体: JSON格式，支持模板变量
预设配置: 默认成功、错误响应、Webhook等预设
模板变量:

{{timestamp}} - 当前时间戳
{{requestId}} - 唯一请求ID
{{method}} - 请求方法
{{url}} - 请求URL
{{ip}} - 客户端IP
{{userAgent}} - 用户代理
{{processingTime}} - 处理时间



3. 统计分析面板

概览统计: 总请求数、今日请求、本周请求、独立访客
可视化图表:

请求方法分布
浏览器和操作系统分布
地理位置分布
响应状态码分布



🎛️ API使用方式
基础使用
第三方程序可以向探测端点发送任意HTTP请求：
bash# GET请求
curl "https://你的域名.vercel.app/api/inspect?param1=value1&param2=value2"

# POST请求
curl -X POST "https://你的域名.vercel.app/api/inspect" \
  -H "Content-Type: application/json" \
  -d '{"key": "value", "data": 123}'

# 其他方法
curl -X PUT "https://你的域名.vercel.app/api/inspect" -d "some data"
curl -X DELETE "https://你的域名.vercel.app/api/inspect"
高级控制参数
通过URL参数可以控制API行为：
bash# 返回特定状态码
curl "https://你的域名.vercel.app/api/inspect?_status=404"

# 设置响应延时（毫秒）
curl "https://你的域名.vercel.app/api/inspect?_delay=2000"

# 自定义响应消息
curl "https://你的域名.vercel.app/api/inspect?_message=自定义成功消息"

# 返回错误响应
curl "https://你的域名.vercel.app/api/inspect?_error=自定义错误信息"

# 组合使用
curl "https://你的域名.vercel.app/api/inspect?_status=201&_delay=1000&_message=创建成功"
📈 数据收集能力
🔍 收集的信息

基础请求信息: 方法、URL、协议、时间戳
客户端信息: IP地址、User-Agent、浏览器、操作系统
地理位置: 国家、城市（基于Cloudflare CDN）
请求头: 完整的HTTP头信息
请求体: JSON、表单、文本等各种格式
查询参数: URL中的所有参数
响应信息: 状态码、响应时间、处理时长
安全信息: 自动检测机器人、隐藏敏感认证信息

📊 统计分析

时间维度: 按天、周、月统计请求量
来源分析: IP地址、地理位置、访问设备分布
行为分析: 请求方法、状态码、响应时间分布
内容分析: 请求体类型、大小统计

🔧 管理功能
📋 日志管理

实时查看: 最新请求实时显示
历史记录: 所有历史请求永久保存
批量操作: 一键清空所有日志记录
数据导出: 导出JSON格式的日志数据

⚙️ 系统配置

响应定制: 完全控制API返回内容
性能调优: 设置响应延时模拟各种网络环境
安全控制: 隐藏敏感信息，防止数据泄露

🎯 应用场景
🔍 API调试

调试第三方应用的API调用行为
验证Webhook回调数据格式
测试API集成的正确性

📊 数据分析

分析用户访问模式和行为
监控API使用情况和性能
收集客户端环境信息

🧪 测试环境

模拟各种API响应场景
测试应用的错误处理能力
验证超时和重试机制

🔐 安全监控

检测异常访问行为
监控爬虫和机器人访问
分析攻击模式和来源

🚨 注意事项
🔒 隐私保护

系统自动隐藏Authorization头等敏感信息
Cookie信息仅显示数量不显示内容
建议在生产环境中定期清理日志

🌐 CORS支持

支持跨域请求，适配各种客户端环境
自动处理OPTIONS预检请求

💾 数据存储

使用Supabase免费套餐可支持每月50万次请求
数据库存储限制500MB，超出后需要升级或清理
建议定期备份重要日志数据

🔧 性能优化

异步处理日志存储，不影响API响应速度
数据库查询优化，支持大量数据的快速检索
前端分页和筛选减少数据传输量

🆘 故障排除
常见问题

面板显示离线: 检查Supabase环境变量是否正确设置
数据不显示: 确认数据库表结构是否正确创建
CORS错误: 检查API的CORS头设置
响应超时: 检查网络连接和Supabase服务状态

调试方法

查看Vercel函数日志获取详细错误信息
使用浏览器开发者工具检查网络请求
在Supabase中直接查询数据库验证数据存储

📞 技术支持
这个系统基于现代云原生架构，具有高可用性和可扩展性。如果你在使用过程中遇到问题，可以：

检查Vercel和Supabase的服务状态
查看详细的错误日志进行问题定位
根据错误信息调整配置或代码


🎉 现在你已经拥有了一个功能强大的API监控系统！
通过这个系统，你可以轻松监控和调试任何第三方应用程序的API调用行为，获得详细的请求分析数据，并根据需要自定义API响应。无论是开发调试、数据分析还是安全监控，这个系统都能为你提供强大的支持。
