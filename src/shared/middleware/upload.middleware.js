const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config');
const fileUtil = require('../utils/file.util');
const { AppError } = require('./error.middleware');

// 確保上傳目錄存在
fs.ensureDirSync(config.upload.directory);

// Multer 存儲配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.directory);
  },
  filename: (req, file, cb) => {
    const safeName = fileUtil.generateSafeFilename(file);
    cb(null, safeName);
  },
});

// 文件過濾器
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    ...config.upload.allowedVideoTypes,
    ...config.upload.allowedImageTypes,
  ];

  if (!allowedMimes.includes(file.mimetype)) {
    return cb(
      new AppError(
        400,
        'INVALID_FILE_TYPE',
        `File type ${file.mimetype} not allowed`,
        { allowedTypes: allowedMimes }
      ),
      false
    );
  }

  cb(null, true);
};

// Multer 實例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
  },
});

/**
 * 單文件上傳中間件
 */
const uploadSingle = upload.single('file');

/**
 * 多文件上傳中間件
 */
const uploadMultiple = upload.array('files', 10);

/**
 * 上傳錯誤處理包裝器
 */
function handleUploadError(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              `File size exceeds limit of ${fileUtil.formatFileSize(config.upload.maxFileSize)}`,
              {
                maxSize: config.upload.maxFileSize,
                maxSizeFormatted: fileUtil.formatFileSize(config.upload.maxFileSize),
              }
            )
          );
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new AppError(
              400,
              'INVALID_FIELD_NAME',
              'Unexpected field name. Please use "file" for single upload or "files" for multiple uploads.'
            )
          );
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(
            new AppError(400, 'TOO_MANY_FILES', 'Too many files uploaded')
          );
        }

        return next(new AppError(400, 'UPLOAD_ERROR', err.message));
      }

      if (err) {
        return next(err);
      }

      next();
    });
  };
}

module.exports = {
  uploadSingle: handleUploadError(uploadSingle),
  uploadMultiple: handleUploadError(uploadMultiple),
};
