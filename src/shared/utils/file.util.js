const path = require('path');
const fs = require('fs-extra');
const fileType = require('file-type');
const sanitize = require('sanitize-filename');
const { AppError } = require('../middleware/error.middleware');
const logger = require('../services/logger.service');

class FileUtil {
  /**
   * 生成安全的文件名
   */
  generateSafeFilename(file) {
    // 清理原始文件名
    const sanitized = sanitize(file.originalname || 'upload');
    const ext = path.extname(sanitized);
    const basename = path.basename(sanitized, ext);

    // 防止路徑遍歷，只保留安全字符
    const safe = basename.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

    // 添加時間戳和隨機字符串避免衝突
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);

    return `${safe}-${timestamp}-${random}${ext}`;
  }

  /**
   * 驗證文件真實類型（防止偽造 MIME）
   */
  async validateFileType(filePath, allowedMimes) {
    try {
      const type = await fileType.fromFile(filePath);

      if (!type) {
        // 某些文件可能無法檢測，回退到擴展名檢查
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = {
          '.mp4': 'video/mp4',
          '.mov': 'video/quicktime',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
        };

        const detectedMime = mimeMap[ext];
        if (detectedMime && allowedMimes.includes(detectedMime)) {
          return { mime: detectedMime, ext };
        }

        throw new AppError(400, 'UNKNOWN_FILE_TYPE', 'Unable to determine file type');
      }

      if (!allowedMimes.includes(type.mime)) {
        throw new AppError(
          400,
          'INVALID_FILE_TYPE',
          `File type ${type.mime} is not allowed`,
          { allowedTypes: allowedMimes, receivedType: type.mime }
        );
      }

      return type;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(400, 'FILE_VALIDATION_ERROR', error.message);
    }
  }

  /**
   * 驗證路徑安全性 - 防止路徑遍歷
   */
  validatePath(filePath, baseDir) {
    const resolved = path.resolve(filePath);
    const base = path.resolve(baseDir);

    if (!resolved.startsWith(base)) {
      throw new AppError(400, 'PATH_TRAVERSAL_DETECTED', 'Invalid file path');
    }

    return resolved;
  }

  /**
   * 清理上傳文件（包括 Tus 元數據）
   */
  async cleanupUpload(filePath) {
    try {
      // 刪除主文件
      await fs.remove(filePath);

      // 刪除 Tus 元數據文件
      const metaPath = `${filePath}.json`;
      if (await fs.pathExists(metaPath)) {
        await fs.remove(metaPath);
      }

      logger.debug(`Cleaned up upload: ${filePath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup upload: ${filePath}`, { error: error.message });
    }
  }

  /**
   * 獲取文件大小（格式化）
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 檢查磁盤空間
   */
  async checkDiskSpace(directory) {
    try {
      const stats = await fs.statfs(directory);
      const available = stats.bavail * stats.bsize;
      const total = stats.blocks * stats.bsize;
      const used = total - available;
      const percentUsed = (used / total) * 100;

      return {
        available,
        total,
        used,
        percentUsed: Math.round(percentUsed * 100) / 100,
      };
    } catch (error) {
      logger.warn('Failed to check disk space', { error: error.message });
      return null;
    }
  }

  /**
   * 獲取文件 MIME 類型
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.m3u8': 'application/x-mpegURL',
      '.ts': 'video/MP2T',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = new FileUtil();
