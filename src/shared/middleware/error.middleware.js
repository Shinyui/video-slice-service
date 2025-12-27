const logger = require('../services/logger.service');
const config = require('../../config');

/**
 * 自定義應用錯誤類
 */
class AppError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // 區分預期錯誤和程序錯誤
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 全局錯誤處理中間件
 */
function errorHandler(err, req, res, next) {
  // 記錄錯誤
  logger.logError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // 默認錯誤響應
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details || {};

  // Multer 錯誤處理
  if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'UPLOAD_ERROR';

    if (err.code === 'LIMIT_FILE_SIZE') {
      code = 'FILE_TOO_LARGE';
      message = `File size exceeds limit of ${config.upload.maxFileSize} bytes`;
      details = { maxSize: config.upload.maxFileSize };
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      code = 'INVALID_FIELD_NAME';
      message = 'Unexpected field name. Please use "file" for your upload.';
    } else {
      message = err.message;
    }
  }

  // Joi 驗證錯誤
  if (err.name === 'ValidationError' && err.isJoi) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = {
      errors: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    };
  }

  // MongoDB/Mongoose 錯誤（如果將來使用）
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  }

  // Redis 錯誤
  if (err.name === 'ReplyError') {
    statusCode = 500;
    code = 'CACHE_ERROR';
    message = 'Cache operation failed';
  }

  // 生產環境隱藏詳細錯誤
  if (config.app.isProduction && !err.isOperational) {
    message = 'An unexpected error occurred';
    details = {};
  }

  // 構建響應
  const response = {
    success: false,
    error: {
      code,
      message,
      details,
      path: req.path,
      timestamp: new Date().toISOString(),
    },
  };

  // 開發環境附加堆棧信息
  if (config.app.isDevelopment && err.stack) {
    response.error.stack = err.stack.split('\n');
  }

  res.status(statusCode).json(response);
}

/**
 * 404 Not Found 處理
 */
function notFoundHandler(req, res, next) {
  const error = new AppError(
    404,
    'NOT_FOUND',
    `Route ${req.method} ${req.path} not found`
  );
  next(error);
}

/**
 * 未處理的 Promise 拒絕處理
 */
function unhandledRejectionHandler(reason, promise) {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise,
  });
  // 不要退出進程，記錄後繼續運行
}

/**
 * 未捕獲的異常處理
 */
function uncaughtExceptionHandler(error) {
  logger.error('Uncaught Exception - Server will shut down', {
    error: error.message,
    stack: error.stack,
  });

  // 優雅退出
  process.exit(1);
}

/**
 * 異步路由包裝器 - 自動捕獲 Promise 錯誤
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  unhandledRejectionHandler,
  uncaughtExceptionHandler,
  asyncHandler,
};
