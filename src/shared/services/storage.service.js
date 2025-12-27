const path = require('path');
const fs = require('fs-extra');
const pLimit = require('p-limit');
const { client: minioClient, ensureBucket, setBucketPolicy } = require('../../infrastructure/storage/minio.client');
const config = require('../../config');
const logger = require('./logger.service');
const fileUtil = require('../utils/file.util');

class StorageService {
  constructor() {
    this.bucket = config.storage.bucket;
    this.concurrency = config.queue.uploadConcurrency;
    this.initialized = false;
  }

  /**
   * 初始化存儲服務
   */
  async init() {
    if (this.initialized) return;

    try {
      await ensureBucket(this.bucket);

      // 設置為公開讀取（HLS 需要）
      // 生產環境建議使用簽名 URL
      await setBucketPolicy(this.bucket, true);

      this.initialized = true;
      logger.info('Storage service initialized');
    } catch (error) {
      logger.error('Storage service initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 上傳單個文件
   */
  async uploadFile(localPath, remotePath, contentType) {
    try {
      const metaData = {
        'Content-Type': contentType || fileUtil.getMimeType(localPath),
      };

      await minioClient.fPutObject(this.bucket, remotePath, localPath, metaData);
      logger.debug(`Uploaded file: ${remotePath}`);

      return remotePath;
    } catch (error) {
      logger.error(`Failed to upload file: ${remotePath}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 上傳 HLS 文件夾（帶進度回調）
   */
  async uploadHLSFiles(dirPath, remotePrefix, onProgress = null) {
    try {
      const files = await fs.readdir(dirPath);

      if (files.length === 0) {
        throw new Error('No files found in directory');
      }

      logger.info(`Starting HLS upload: ${files.length} files`);

      const limit = pLimit(this.concurrency);
      let uploaded = 0;

      const tasks = files.map((file) =>
        limit(async () => {
          const filePath = path.join(dirPath, file);
          const remotePath = path.join(remotePrefix, file).replace(/\\/g, '/'); // 確保使用 Unix 路徑

          const contentType = fileUtil.getMimeType(file);
          await this.uploadFile(filePath, remotePath, contentType);

          uploaded++;
          const progress = Math.round((uploaded / files.length) * 100);

          if (onProgress) {
            await onProgress(progress);
          }

          logger.debug(`Upload progress: ${uploaded}/${files.length} (${progress}%)`);
        })
      );

      await Promise.all(tasks);

      logger.info(`All files uploaded to ${remotePrefix}`);

      // 返回 m3u8 播放列表 URL
      return this.getFileUrl(`${remotePrefix}/index.m3u8`);
    } catch (error) {
      logger.error(`HLS upload failed for ${remotePrefix}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 上傳單個圖片或視頻文件
   */
  async uploadMediaFile(localPath, remoteName, contentType) {
    try {
      await this.uploadFile(localPath, remoteName, contentType);
      const url = this.getFileUrl(remoteName);

      logger.info(`Media file uploaded: ${remoteName}`);
      return url;
    } catch (error) {
      logger.error(`Media upload failed: ${remoteName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 獲取文件公開 URL
   */
  getFileUrl(remotePath) {
    const protocol = config.storage.useSSL ? 'https' : 'http';
    const host = config.storage.endpoint;
    const port = config.storage.port && config.storage.port !== 443 && config.storage.port !== 80
      ? `:${config.storage.port}`
      : '';

    return `${protocol}://${host}${port}/${this.bucket}/${remotePath}`;
  }

  /**
   * 獲取簽名 URL（有過期時間）
   */
  async getSignedUrl(remotePath, expirySeconds = 3600) {
    try {
      const url = await minioClient.presignedGetObject(
        this.bucket,
        remotePath,
        expirySeconds
      );

      logger.debug(`Generated signed URL for ${remotePath}`, { expirySeconds });
      return url;
    } catch (error) {
      logger.error(`Failed to generate signed URL for ${remotePath}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 刪除文件
   */
  async deleteFile(remotePath) {
    try {
      await minioClient.removeObject(this.bucket, remotePath);
      logger.info(`Deleted file: ${remotePath}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${remotePath}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 刪除整個文件夾（HLS 文件）
   */
  async deleteFolder(remotePrefix) {
    try {
      const objectsList = [];
      const stream = minioClient.listObjects(this.bucket, remotePrefix, true);

      // 收集所有對象
      await new Promise((resolve, reject) => {
        stream.on('data', (obj) => objectsList.push(obj.name));
        stream.on('error', reject);
        stream.on('end', resolve);
      });

      if (objectsList.length === 0) {
        logger.warn(`No files found to delete in ${remotePrefix}`);
        return;
      }

      // 批量刪除
      await minioClient.removeObjects(this.bucket, objectsList);
      logger.info(`Deleted folder: ${remotePrefix} (${objectsList.length} files)`);
    } catch (error) {
      logger.error(`Failed to delete folder: ${remotePrefix}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 檢查文件是否存在
   */
  async fileExists(remotePath) {
    try {
      await minioClient.statObject(this.bucket, remotePath);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

// 創建實例並初始化
const storageService = new StorageService();
storageService.init().catch((err) => {
  logger.error('Failed to initialize storage service', { error: err.message });
});

module.exports = storageService;
