require('dotenv').config();
const Joi = require('joi');

// 配置 Schema 驗證
const envSchema = Joi.object({
  // Application
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // MinIO
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_USE_SSL: Joi.string().valid('true', 'false').default('false'),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().default('videos'),

  // Processing
  FFMPEG_CONCURRENCY_LIMIT: Joi.number().default(2),
  UPLOAD_CONCURRENCY_LIMIT: Joi.number().default(5),
  IMAGE_CONCURRENCY_LIMIT: Joi.number().default(5),

  // FFmpeg
  FFMPEG_CRF: Joi.number().min(0).max(51).default(23),
  FFMPEG_PRESET: Joi.string().valid('ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow').default('fast'),
  HLS_TIME: Joi.number().default(10),

  // Backend
  BACKEND_URL: Joi.string().uri().default('http://localhost:4000'),
  BACKEND_NOTIFY_TIMEOUT: Joi.number().default(5000),

  // Upload
  MAX_FILE_SIZE: Joi.number().default(5 * 1024 * 1024 * 1024), // 5GB
  UPLOAD_DIR: Joi.string().default('./uploads'),

  // Recovery
  STALE_THRESHOLD_MS: Joi.number().default(15 * 60 * 1000),
  CHECK_INTERVAL_MS: Joi.number().default(10 * 60 * 1000),

  // Security
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  API_KEYS: Joi.string().optional(),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('json'),

  // Redis (Optional)
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
}).unknown(true);

// 驗證環境變量
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  app: {
    port: envVars.PORT,
    env: envVars.NODE_ENV,
    isDevelopment: envVars.NODE_ENV === 'development',
    isProduction: envVars.NODE_ENV === 'production',
    isTest: envVars.NODE_ENV === 'test',
    trustProxy: true,
  },

  upload: {
    directory: envVars.UPLOAD_DIR,
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedVideoTypes: ['video/mp4', 'video/quicktime'],
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  queue: {
    ffmpegConcurrency: envVars.FFMPEG_CONCURRENCY_LIMIT,
    uploadConcurrency: envVars.UPLOAD_CONCURRENCY_LIMIT,
    imageConcurrency: envVars.IMAGE_CONCURRENCY_LIMIT,
  },

  storage: {
    endpoint: envVars.MINIO_ENDPOINT,
    port: envVars.MINIO_PORT,
    useSSL: envVars.MINIO_USE_SSL === 'true',
    accessKey: envVars.MINIO_ACCESS_KEY,
    secretKey: envVars.MINIO_SECRET_KEY,
    bucket: envVars.MINIO_BUCKET,
  },

  backend: {
    url: envVars.BACKEND_URL,
    notifyTimeout: envVars.BACKEND_NOTIFY_TIMEOUT,
  },

  recovery: {
    staleThreshold: envVars.STALE_THRESHOLD_MS,
    checkInterval: envVars.CHECK_INTERVAL_MS,
  },

  ffmpeg: {
    crf: envVars.FFMPEG_CRF,
    preset: envVars.FFMPEG_PRESET,
    hlsTime: envVars.HLS_TIME,
  },

  cors: {
    origins: envVars.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    credentials: false, // 除非需要 Cookie，否則禁用
  },

  logger: {
    level: envVars.LOG_LEVEL,
    format: envVars.LOG_FORMAT,
  },

  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD || undefined,
    db: envVars.REDIS_DB,
  },

  security: {
    apiKeys: envVars.API_KEYS ? envVars.API_KEYS.split(',').map(key => key.trim()) : [],
  },
};

// 生產環境配置驗證
if (config.app.isProduction) {
  const productionChecks = [
    { key: 'MINIO_ACCESS_KEY', message: 'MinIO access key is required in production' },
    { key: 'MINIO_SECRET_KEY', message: 'MinIO secret key is required in production' },
  ];

  productionChecks.forEach(check => {
    if (!envVars[check.key] || envVars[check.key] === 'your_access_key_here' || envVars[check.key] === 'your_secret_key_here') {
      throw new Error(check.message);
    }
  });
}

module.exports = config;
