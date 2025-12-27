const MemoryQueue = require('../../infrastructure/queue/memory-queue');
const logger = require('./logger.service');

class QueueService {
  constructor() {
    this.queue = new MemoryQueue();

    // 監聽隊列事件
    this.queue.on('job:added', (job) => {
      logger.debug(`Queue event: job added ${job.id}`);
    });

    this.queue.on('job:completed', (job) => {
      logger.info(`Queue event: job completed ${job.id}`);
    });

    this.queue.on('job:failed', (job, error) => {
      logger.error(`Queue event: job failed ${job.id}`, { error: error.message });
    });
  }

  async addJob(queueName, data, options = {}) {
    return this.queue.add(queueName, data, options);
  }

  async process(queueName, handler) {
    return this.queue.process(queueName, handler);
  }

  async getJob(jobId) {
    return this.queue.getJob(jobId);
  }

  async removeJob(jobId) {
    return this.queue.remove(jobId);
  }

  getQueueMetrics(queueName) {
    return this.queue.getMetrics(queueName);
  }
}

module.exports = new QueueService();
