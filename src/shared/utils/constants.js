/**
 * 應用常量定義
 */

// 任務狀態
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// 處理步驟
const PROCESSING_STEP = {
  VALIDATING: 'validating',
  TRANSCODING: 'transcoding',
  UPLOADING: 'uploading',
  NOTIFYING: 'notifying',
  CLEANUP: 'cleanup',
};

// 文件類型
const FILE_TYPE = {
  VIDEO: 'video',
  IMAGE: 'image',
};

// 錯誤碼
const ERROR_CODE = {
  // 客戶端錯誤 (4xx)
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  MISSING_FILE: 'MISSING_FILE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  JOB_ALREADY_COMPLETED: 'JOB_ALREADY_COMPLETED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // 服務器錯誤 (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  FFMPEG_ERROR: 'FFMPEG_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

// MIME 類型映射
const MIME_TYPES = {
  VIDEO: {
    MP4: 'video/mp4',
    QUICKTIME: 'video/quicktime',
    WEBM: 'video/webm',
  },
  IMAGE: {
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    WEBP: 'image/webp',
  },
  HLS: {
    PLAYLIST: 'application/x-mpegURL',
    SEGMENT: 'video/MP2T',
  },
};

// 隊列名稱
const QUEUE_NAME = {
  VIDEO_TRANSCODE: 'video-transcode',
  IMAGE_PROCESS: 'image-process',
  NOTIFICATION: 'notification',
  CLEANUP: 'cleanup',
};

// 事件名稱
const EVENT_NAME = {
  JOB_CREATED: 'job:created',
  JOB_STARTED: 'job:started',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  JOB_CANCELLED: 'job:cancelled',
};

module.exports = {
  JOB_STATUS,
  PROCESSING_STEP,
  FILE_TYPE,
  ERROR_CODE,
  MIME_TYPES,
  QUEUE_NAME,
  EVENT_NAME,
};
