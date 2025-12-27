const Redis = require('ioredis');
const config = require('../../config');
const logger = require('../../shared/services/logger.service');

let redisClient = null;
let isRedisAvailable = false;

/**
 * 初始化 Redis 客戶端（可選，降級到內存）
 */
function initRedis() {
  // 如果是測試環境或開發環境且未配置 Redis，跳過
  if (config.app.isTest || (config.app.isDevelopment && !process.env.REDIS_HOST)) {
    logger.info('Redis not configured - using in-memory storage');
    return null;
  }

  // 檢查必要的配置
  if (!config.redis.host) {
    logger.info('Redis host not configured - using in-memory storage');
    return null;
  }

  try {
    let retryCount = 0;
    const maxRetries = 3; // 最多重試3次後放棄

    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy(times) {
        retryCount = times;

        // 超過最大重試次數，停止重試
        if (times > maxRetries) {
          logger.warn(`Redis retry limit (${maxRetries}) exceeded - permanently falling back to memory storage`);
          isRedisAvailable = false;
          return null; // 返回 null 停止重試
        }

        const delay = Math.min(times * 50, 2000);
        logger.debug(`Redis retry ${times}/${maxRetries}, waiting ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true, // 延遲連接，允許我們捕獲連接錯誤
      enableOfflineQueue: false, // 離線時不要排隊命令
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      isRedisAvailable = true;
      retryCount = 0; // 重置重試計數
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      isRedisAvailable = true;
    });

    redisClient.on('error', (err) => {
      // 只在首次錯誤時記錄詳細信息，避免日誌洪水
      if (retryCount === 0 || retryCount === 1) {
        logger.warn('Redis client error - falling back to memory storage', {
          error: err.message,
        });
      }
      isRedisAvailable = false;
    });

    redisClient.on('close', () => {
      if (isRedisAvailable) { // 只有在之前連接成功時才警告
        logger.warn('Redis connection closed');
      }
      isRedisAvailable = false;
    });

    // 嘗試連接
    redisClient.connect().catch((err) => {
      logger.warn('Failed to connect to Redis - using in-memory storage', {
        error: err.message,
        host: config.redis.host,
        port: config.redis.port,
      });
      isRedisAvailable = false;

      // 斷開連接，避免繼續重試
      if (redisClient) {
        redisClient.disconnect();
      }
    });

    return redisClient;
  } catch (error) {
    logger.warn('Redis initialization failed - using in-memory storage', {
      error: error.message,
    });
    return null;
  }
}

/**
 * 檢查 Redis 是否可用
 */
function isAvailable() {
  return isRedisAvailable && redisClient && redisClient.status === 'ready';
}

/**
 * 安全地執行 Redis 命令（帶降級）
 */
async function safeExecute(command, fallback) {
  if (!isAvailable()) {
    return fallback();
  }

  try {
    return await command();
  } catch (error) {
    logger.warn('Redis command failed, using fallback', { error: error.message });
    return fallback();
  }
}

// 初始化
initRedis();

module.exports = {
  client: redisClient,
  isAvailable,
  safeExecute,
};
