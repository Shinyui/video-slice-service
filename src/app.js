const express = require('express');
const path = require('path');

// ===== 新基礎設施 =====
const config = require('./config');
const logger = require('./shared/services/logger.service');
const corsMiddleware = require('./shared/middleware/cors.middleware');
const {
  errorHandler,
  notFoundHandler,
  unhandledRejectionHandler,
  uncaughtExceptionHandler,
} = require('./shared/middleware/error.middleware');

// ===== 舊服務（保留向後兼容）=====
const apiRoutesLegacy = require('./routes/api');
const tusServer = require('./services/tusService');
const recoveryService = require('./services/recoveryService');

// ===== 新路由 =====
const apiV1 = require('./routes/v1');
const healthRoutes = require('./routes/health');

// ===== 初始化 Express =====
const app = express();

// ===== 進程級錯誤處理 =====
process.on('unhandledRejection', unhandledRejectionHandler);
process.on('uncaughtException', uncaughtExceptionHandler);

// ===== 啟動服務 =====
recoveryService.start();
logger.info('Recovery service started');

// ===== Trust Proxy =====
app.set('trust proxy', config.app.trustProxy);

// ===== 全局中間件 =====

// CORS（使用新的嚴格配置）
app.use(corsMiddleware);

// Tus Server（必須在 body parser 之前）
app.use('/api/tus', tusServer.handle.bind(tusServer));

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 請求日誌（僅開發環境）
if (config.app.isDevelopment) {
  app.use((req, res, next) => {
    logger.logRequest(req);
    next();
  });
}

// ===== 路由 =====

// 健康檢查（無版本前綴）
app.use('/', healthRoutes);

// 舊 API 路由（保持向後兼容）
app.use('/api', apiRoutesLegacy);

// 新 API v1 路由
app.use('/api/v1', apiV1);

// 根路徑
app.get('/', (req, res) => {
  res.json({
    service: 'Video Slice Service',
    status: 'running',
    version: require('../package.json').version,
    environment: config.app.env,
    apiVersions: {
      legacy: '/api',
      v1: '/api/v1',
    },
    documentation: {
      health: '/health',
      upload: 'POST /api/v1/uploads',
      jobs: 'GET /api/v1/uploads/jobs',
      status: 'GET /api/v1/uploads/jobs/:jobId',
    },
  });
});

// ===== 錯誤處理 =====

// 404 處理
app.use(notFoundHandler);

// 全局錯誤處理
app.use(errorHandler);

// ===== 啟動服務器 =====
if (require.main === module) {
  const PORT = config.app.port;

  app.listen(PORT, () => {
    logger.info(`🚀 Video Slice Service started`);
    logger.info(`📦 Environment: ${config.app.env}`);
    logger.info(`🌐 Server running on port ${PORT}`);
    logger.info(`📍 API Endpoints:`);
    logger.info(`   - Health Check: http://localhost:${PORT}/health`);
    logger.info(`   - Legacy API: http://localhost:${PORT}/api/upload`);
    logger.info(`   - API v1: http://localhost:${PORT}/api/v1/uploads`);
    logger.info(`   - Tus Upload: http://localhost:${PORT}/api/tus`);
    const redis = require('./infrastructure/database/redis.client');
    logger.info(`📊 Queue: ${redis.isAvailable() ? 'Redis' : 'Memory (In-Memory fallback)'}`);
    logger.info(`✅ Ready to accept requests`);
  });
}

module.exports = app;
