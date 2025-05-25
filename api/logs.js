// api/logs.js - 获取日志的API
let requestLogs = []; // 这里需要与inspect.js共享数据

export default function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 获取查询参数
  const { limit = 50, method, ip, since } = req.query;
  
  let filteredLogs = requestLogs;

  // 按方法过滤
  if (method) {
    filteredLogs = filteredLogs.filter(log => 
      log.method.toLowerCase() === method.toLowerCase()
    );
  }

  // 按IP过滤
  if (ip) {
    filteredLogs = filteredLogs.filter(log => 
      log.ip.includes(ip)
    );
  }

  // 按时间过滤
  if (since) {
    const sinceTime = new Date(since).getTime();
    filteredLogs = filteredLogs.filter(log => 
      log.processedAt > sinceTime
    );
  }

  // 限制返回数量
  const limitNum = parseInt(limit);
  if (limitNum > 0) {
    filteredLogs = filteredLogs.slice(0, limitNum);
  }

  res.status(200).json({
    success: true,
    total: requestLogs.length,
    filtered: filteredLogs.length,
    logs: filteredLogs,
    lastUpdate: requestLogs.length > 0 ? requestLogs[0].timestamp : null
  });
}