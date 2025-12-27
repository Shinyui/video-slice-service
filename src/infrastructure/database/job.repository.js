const redis = require('./redis.client');
const logger = require('../../shared/services/logger.service');
const { JOB_STATUS } = require('../../shared/utils/constants');

// 內存降級存儲
const memoryStore = new Map();

class JobRepository {
  constructor() {
    this.prefix = 'job:';
    this.ttl = 7 * 24 * 60 * 60; // 7 天
  }

  /**
   * 保存任務
   */
  async save(jobId, data) {
    const key = `${this.prefix}${jobId}`;
    const value = JSON.stringify(data);

    return redis.safeExecute(
      // Redis 命令
      async () => {
        await redis.client.setex(key, this.ttl, value);
        logger.debug(`Job ${jobId} saved to Redis`);
      },
      // 降級到內存
      () => {
        memoryStore.set(key, { value, expiry: Date.now() + this.ttl * 1000 });
        logger.debug(`Job ${jobId} saved to memory`);
      }
    );
  }

  /**
   * 獲取任務
   */
  async get(jobId) {
    const key = `${this.prefix}${jobId}`;

    return redis.safeExecute(
      // Redis 命令
      async () => {
        const data = await redis.client.get(key);
        return data ? JSON.parse(data) : null;
      },
      // 降級到內存
      () => {
        const stored = memoryStore.get(key);
        if (!stored) return null;

        // 檢查過期
        if (Date.now() > stored.expiry) {
          memoryStore.delete(key);
          return null;
        }

        return JSON.parse(stored.value);
      }
    );
  }

  /**
   * 更新任務字段
   */
  async update(jobId, updates) {
    const existing = await this.get(jobId);
    if (!existing) {
      logger.warn(`Job ${jobId} not found for update`);
      return null;
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.save(jobId, updated);
    return updated;
  }

  /**
   * 刪除任務
   */
  async delete(jobId) {
    const key = `${this.prefix}${jobId}`;

    return redis.safeExecute(
      // Redis 命令
      async () => {
        await redis.client.del(key);
        logger.debug(`Job ${jobId} deleted from Redis`);
      },
      // 降級到內存
      () => {
        memoryStore.delete(key);
        logger.debug(`Job ${jobId} deleted from memory`);
      }
    );
  }

  /**
   * 獲取所有任務（分頁、過濾）
   */
  async findAll(options = {}) {
    const {
      page = 1,
      pageSize = 20,
      status = null,
      sortBy = 'createdAt',
      order = 'desc',
    } = options;

    return redis.safeExecute(
      // Redis 命令
      async () => {
        const pattern = `${this.prefix}*`;
        const keys = await redis.client.keys(pattern);

        // 批量獲取
        const jobs = await Promise.all(
          keys.map(async (key) => {
            const data = await redis.client.get(key);
            return data ? JSON.parse(data) : null;
          })
        );

        return this._processJobs(jobs, { page, pageSize, status, sortBy, order });
      },
      // 降級到內存
      () => {
        const jobs = [];
        const now = Date.now();

        for (const [key, stored] of memoryStore.entries()) {
          if (!key.startsWith(this.prefix)) continue;

          // 檢查過期
          if (now > stored.expiry) {
            memoryStore.delete(key);
            continue;
          }

          try {
            jobs.push(JSON.parse(stored.value));
          } catch (error) {
            logger.warn(`Failed to parse job from memory: ${key}`);
          }
        }

        return this._processJobs(jobs, { page, pageSize, status, sortBy, order });
      }
    );
  }

  /**
   * 處理任務列表（過濾、排序、分頁）
   */
  _processJobs(jobs, options) {
    const { page, pageSize, status, sortBy, order } = options;

    // 過濾 null 和按狀態過濾
    let filtered = jobs.filter(Boolean);
    if (status) {
      filtered = filtered.filter((job) => job.status === status);
    }

    // 排序
    filtered.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });

    // 分頁
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = filtered.slice(start, end);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      },
    };
  }

  /**
   * 獲取任務統計
   */
  async getStats() {
    return redis.safeExecute(
      // Redis 命令
      async () => {
        const pattern = `${this.prefix}*`;
        const keys = await redis.client.keys(pattern);

        const jobs = await Promise.all(
          keys.map(async (key) => {
            const data = await redis.client.get(key);
            return data ? JSON.parse(data) : null;
          })
        );

        return this._calculateStats(jobs.filter(Boolean));
      },
      // 降級到內存
      () => {
        const jobs = [];
        const now = Date.now();

        for (const [key, stored] of memoryStore.entries()) {
          if (!key.startsWith(this.prefix)) continue;
          if (now > stored.expiry) continue;

          try {
            jobs.push(JSON.parse(stored.value));
          } catch (error) {
            // 忽略解析錯誤
          }
        }

        return this._calculateStats(jobs);
      }
    );
  }

  /**
   * 計算統計數據
   */
  _calculateStats(jobs) {
    const stats = {
      total: jobs.length,
      pending: 0,
      processing: 0,
      uploading: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    jobs.forEach((job) => {
      if (stats[job.status] !== undefined) {
        stats[job.status]++;
      }
    });

    return stats;
  }

  /**
   * 清理過期任務（僅內存模式需要）
   */
  cleanupExpired() {
    if (redis.isAvailable()) return; // Redis 自動過期

    const now = Date.now();
    let cleaned = 0;

    for (const [key, stored] of memoryStore.entries()) {
      if (now > stored.expiry) {
        memoryStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired jobs from memory`);
    }
  }
}

// 定期清理過期任務（僅內存模式）
setInterval(() => {
  if (!redis.isAvailable()) {
    const repo = new JobRepository();
    repo.cleanupExpired();
  }
}, 60 * 1000); // 每分鐘

module.exports = new JobRepository();
