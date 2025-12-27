const { EventEmitter } = require('events');
const pLimit = require('p-limit');
const logger = require('../../shared/services/logger.service');
const config = require('../../config');

class MemoryQueue extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map();
    this.processors = new Map();
  }

  /**
   * 添加任務到隊列
   */
  add(queueName, data, options = {}) {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, {
        jobs: [],
        active: 0,
        limit: pLimit(options.concurrency || config.queue.ffmpegConcurrency),
      });
    }

    const queue = this.queues.get(queueName);
    const jobId = `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const job = {
      id: jobId,
      data,
      options,
      status: 'pending',
      attempts: 0,
      maxAttempts: options.attempts || 1,
      createdAt: new Date(),
    };

    queue.jobs.push(job);
    this.emit('job:added', job);

    logger.debug(`Job added to queue ${queueName}`, { jobId });

    // 自動觸發處理
    setImmediate(() => this._processQueue(queueName));

    return job;
  }

  /**
   * 註冊隊列處理器
   */
  process(queueName, handler) {
    this.processors.set(queueName, handler);
    logger.info(`Processor registered for queue: ${queueName}`);

    // 開始處理現有任務
    this._processQueue(queueName);
  }

  /**
   * 處理隊列
   */
  async _processQueue(queueName) {
    const queue = this.queues.get(queueName);
    const processor = this.processors.get(queueName);

    if (!queue || !processor) return;

    // 查找待處理任務
    const job = queue.jobs.find((j) => j.status === 'pending');
    if (!job) return;

    // 檢查並發限制
    if (queue.active >= (job.options.concurrency || config.queue.ffmpegConcurrency)) {
      return;
    }

    job.status = 'processing';
    job.attempts++;
    queue.active++;

    this.emit('job:started', job);
    logger.info(`Processing job ${job.id}`);

    try {
      const result = await processor(job);

      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();

      this.emit('job:completed', job);
      logger.info(`Job completed: ${job.id}`);
    } catch (error) {
      logger.error(`Job failed: ${job.id}`, { error: error.message });

      if (job.attempts < job.maxAttempts) {
        // 重試
        job.status = 'pending';
        logger.info(`Retrying job ${job.id} (${job.attempts}/${job.maxAttempts})`);
      } else {
        // 失敗
        job.status = 'failed';
        job.error = error;
        job.failedAt = new Date();

        this.emit('job:failed', job, error);
        logger.error(`Job permanently failed: ${job.id}`);
      }
    } finally {
      queue.active--;

      // 繼續處理下一個任務
      setImmediate(() => this._processQueue(queueName));
    }
  }

  /**
   * 獲取任務
   */
  async getJob(jobId) {
    for (const queue of this.queues.values()) {
      const job = queue.jobs.find((j) => j.id === jobId);
      if (job) return job;
    }
    return null;
  }

  /**
   * 移除任務
   */
  async remove(jobId) {
    for (const queue of this.queues.values()) {
      const index = queue.jobs.findIndex((j) => j.id === jobId);
      if (index !== -1) {
        queue.jobs.splice(index, 1);
        logger.info(`Job removed: ${jobId}`);
        return true;
      }
    }
    return false;
  }

  /**
   * 獲取隊列指標
   */
  getMetrics(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    return {
      pending: queue.jobs.filter((j) => j.status === 'pending').length,
      active: queue.active,
      completed: queue.jobs.filter((j) => j.status === 'completed').length,
      failed: queue.jobs.filter((j) => j.status === 'failed').length,
      total: queue.jobs.length,
    };
  }
}

module.exports = MemoryQueue;
