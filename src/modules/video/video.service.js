const path = require('path');
const fs = require('fs-extra');
const videoTranscoder = require('./video.transcoder');
const storageService = require('../../shared/services/storage.service');
const notificationService = require('../../shared/services/notification.service');
const jobRepository = require('../../infrastructure/database/job.repository');
const queueService = require('../../shared/services/queue.service');
const fileUtil = require('../../shared/utils/file.util');
const logger = require('../../shared/services/logger.service');
const { JOB_STATUS, PROCESSING_STEP, QUEUE_NAME } = require('../../shared/utils/constants');

class VideoService {
  constructor() {
    this.outputBase = path.join(__dirname, '../../../output');
    fs.ensureDirSync(this.outputBase);

    // 註冊隊列處理器
    queueService.process(QUEUE_NAME.VIDEO_TRANSCODE, (job) => this.executeTranscode(job));
  }

  /**
   * 處理視頻（添加到隊列）
   */
  async processVideo(jobId, filePath) {
    logger.info(`Queuing video processing for ${jobId}`);

    await queueService.addJob(
      QUEUE_NAME.VIDEO_TRANSCODE,
      { jobId, filePath },
      {
        attempts: 2,
        priority: 10,
      }
    );
  }

  /**
   * 執行轉碼任務（由隊列調用）
   */
  async executeTranscode(job) {
    const { jobId, filePath } = job.data;
    const outputDir = path.join(this.outputBase, jobId);

    try {
      // 更新狀態：處理中
      await jobRepository.update(jobId, {
        status: JOB_STATUS.PROCESSING,
        currentStep: PROCESSING_STEP.TRANSCODING,
      });

      // 獲取元數據
      const metadata = await videoTranscoder.getMetadata(filePath);

      // 轉碼
      await fs.ensureDir(outputDir);
      await videoTranscoder.transcode(filePath, outputDir, async (progress) => {
        await jobRepository.update(jobId, { progress });
      });

      // 上傳到 MinIO
      await jobRepository.update(jobId, {
        status: JOB_STATUS.UPLOADING,
        currentStep: PROCESSING_STEP.UPLOADING,
        progress: 0,
      });

      const remoteUrl = await storageService.uploadHLSFiles(outputDir, jobId, async (progress) => {
        await jobRepository.update(jobId, { progress });
      });

      // 清理本地文件
      await fileUtil.cleanupUpload(filePath);
      await fs.remove(outputDir);

      // 更新狀態：完成
      await jobRepository.update(jobId, {
        status: JOB_STATUS.COMPLETED,
        progress: 100,
        result: {
          url: remoteUrl,
          duration: metadata.duration,
          resolution: metadata.video ? `${metadata.video.width}x${metadata.video.height}` : null,
          format: 'hls',
        },
        completedAt: new Date().toISOString(),
      });

      // 通知 Backend
      await notificationService.notifyBackend(jobId, 'COMPLETED', remoteUrl, { metadata });

      logger.info(`Video processing completed for ${jobId}`);
      return { jobId, url: remoteUrl };
    } catch (error) {
      logger.error(`Video processing failed for ${jobId}`, { error: error.message });

      // 更新狀態：失敗
      await jobRepository.update(jobId, {
        status: JOB_STATUS.FAILED,
        error: {
          code: error.code || 'PROCESSING_ERROR',
          message: error.message,
        },
        failedAt: new Date().toISOString(),
      });

      // 清理文件
      await fileUtil.cleanupUpload(filePath).catch(() => {});
      await fs.remove(outputDir).catch(() => {});

      throw error;
    }
  }
}

module.exports = new VideoService();
