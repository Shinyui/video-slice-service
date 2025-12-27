const winston = require('winston');
const path = require('path');
const config = require('../../config');

// 敏感字段列表 - 自動脫敏
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'secretkey',
  'secret_key',
  'accesskey',
  'access_key',
  'authorization',
  'cookie',
  'session',
];

/**
 * 脫敏函數 - 遞歸處理對象
 */
function sanitize(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field));

    if (isSensitive) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// 日誌格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.printf(({ level, message, timestamp, metadata }) => {
    const sanitizedMeta = sanitize(metadata);
    const metaStr = Object.keys(sanitizedMeta).length > 0
      ? `\n${JSON.stringify(sanitizedMeta, null, 2)}`
      : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

// JSON 格式（生產環境）
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 選擇格式
const selectedFormat = config.logger.format === 'json' ? jsonFormat : logFormat;

// 日誌傳輸配置
const transports = [];

// 文件傳輸（生產環境）
if (config.app.isProduction || config.app.env === 'development') {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  );
}

// 控制台傳輸（開發環境）
if (config.app.isDevelopment || config.app.isTest) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    })
  );
}

// 創建 logger 實例
const logger = winston.createLogger({
  level: config.logger.level,
  format: selectedFormat,
  transports,
  // 捕獲未處理的異常和拒絕
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../../logs/rejections.log'),
    }),
  ],
});

// 擴展 logger - 添加便捷方法
logger.logRequest = (req, message = 'Incoming request') => {
  logger.info(message, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
};

logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    ...context,
  });
};

logger.logJobProgress = (jobId, progress, step) => {
  logger.debug('Job progress', {
    jobId,
    progress,
    step,
  });
};

module.exports = logger;
