const { v4: uuidv4 } = require('uuid');
const videoService = require('../video/video.service');
const imageService = require('../../services/imageService'); // 保留舊的 imageService
const jobRepository = require('../../infrastructure/database/job.repository');
const fileUtil = require('../../shared/utils/file.util');
const logger = require('../../shared/services/logger.service');
const config = require('../../config');
const { JOB_STATUS, FILE_TYPE } = require('../../shared/utils/constants');

class UploadService {
  /**
   * 處理上傳
   */
  async handleUpload(file, metadata = {}) {
    const jobId = metadata.dbId || uuidv4();

    logger.info(`Processing upload`, { jobId, filename: file.originalname });

    // 驗證文件真實類型
    const allowedTypes = [
      ...config.upload.allowedVideoTypes,
      ...config.upload.allowedImageTypes,
    ];

    const fileType = await fileUtil.validateFileType(file.path, allowedTypes);

    // 創建任務記錄
    const job = {
      jobId,
      status: JOB_STATUS.PENDING,
      progress: 0,
      fileType: fileType.mime,
      originalName: file.originalname,
      fileSize: file.size,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await jobRepository.save(jobId, job);

    // 委派給對應的服務
    if (fileType.mime.startsWith('video/')) {
      logger.info(`Delegating to VideoService: ${jobId}`);
      await videoService.processVideo(jobId, file.path);
    } else if (fileType.mime.startsWith('image/')) {
      logger.info(`Delegating to ImageService: ${jobId}`);
      await imageService.processImage(jobId, file.path, metadata);
    }

    return {
      jobId,
      status: JOB_STATUS.PENDING,
      statusUrl: `/api/v1/jobs/${jobId}`,
      estimatedTime: fileType.mime.startsWith('video/') ? 300 : 30, // 秒
    };
  }

  /**
   * 獲取任務狀態
   */
  async getJobStatus(jobId) {
    return await jobRepository.get(jobId);
  }

  /**
   * 獲取任務列表
   */
  async listJobs(options) {
    return await jobRepository.findAll(options);
  }

  /**
   * 取消任務
   */
  async cancelJob(jobId) {
    const job = await jobRepository.get(jobId);

    if (!job) {
      return null;
    }

    if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
      throw new Error('Cannot cancel completed or failed job');
    }

    await jobRepository.update(jobId, {
      status: JOB_STATUS.CANCELLED,
      cancelledAt: new Date().toISOString(),
    });

    logger.info(`Job cancelled: ${jobId}`);
    return await jobRepository.get(jobId);
  }
}

module.exports = new UploadService();
