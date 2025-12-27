const rateLimit = require('express-rate-limit');
const config = require('../../config');

/**
 * 上傳限流（嚴格）
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: config.app.isDevelopment ? 100 : 10, // 開發環境寬鬆
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many upload requests. Please try again later.',
      details: {
        retryAfter: '1 hour',
      },
    },
  },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false,
  // 使用默認的 key 生成器（自動處理 IPv4 和 IPv6）
});

/**
 * 查詢限流（寬鬆）
 */
const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分鐘
  max: config.app.isDevelopment ? 1000 : 100, // 開發環境寬鬆
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * API 通用限流
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: config.app.isDevelopment ? 1000 : 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  uploadLimiter,
  queryLimiter,
  apiLimiter,
};
