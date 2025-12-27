const cors = require('cors');
const config = require('../../config');
const logger = require('../services/logger.service');

/**
 * CORS 中間件配置
 */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = config.cors.origins;

    // 允許沒有 origin 的請求（例如同源請求、Postman）
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', { origin });
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },

  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    // Tus 相關
    'Tus-Resumable',
    'Upload-Length',
    'Upload-Metadata',
    'Upload-Offset',
    'Upload-Concat',
  ],

  exposedHeaders: [
    // Tus 相關
    'Tus-Resumable',
    'Tus-Version',
    'Tus-Extension',
    'Upload-Length',
    'Upload-Metadata',
    'Upload-Offset',
    'Location',
  ],

  credentials: config.cors.credentials || false,
  maxAge: 86400, // 預檢請求緩存 24 小時
};

module.exports = cors(corsOptions);
