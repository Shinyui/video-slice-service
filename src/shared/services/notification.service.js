const config = require('../../config');
const logger = require('./logger.service');

class NotificationService {
  constructor() {
    this.backendUrl = config.backend.url;
    this.timeout = config.backend.notifyTimeout;
  }

  /**
   * 通知 Backend 任務狀態更新
   */
  async notifyBackend(fileId, status, url = null, metadata = {}) {
    try {
      const payload = {
        status,
        url,
        ...metadata,
        updatedAt: new Date().toISOString(),
      };

      logger.info(`Notifying backend for ${fileId}`, { status, url });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(
        `${this.backendUrl}/api/files/${fileId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
      }

      logger.info(`Successfully notified backend for ${fileId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to notify backend for ${fileId}`, {
        error: error.message,
        status,
        url,
      });

      // 不拋出錯誤，允許處理繼續
      return false;
    }
  }

  /**
   * 批量通知（未來擴展）
   */
  async notifyBatch(notifications) {
    const results = await Promise.allSettled(
      notifications.map(({ fileId, status, url, metadata }) =>
        this.notifyBackend(fileId, status, url, metadata)
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - successful;

    logger.info(`Batch notification completed`, {
      total: results.length,
      successful,
      failed,
    });

    return { successful, failed, results };
  }
}

module.exports = new NotificationService();
