const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const { uploadSingle } = require('../../shared/middleware/upload.middleware');
const { uploadLimiter, queryLimiter } = require('../../shared/middleware/rateLimit.middleware');

// 上傳路由（帶限流）
router.post('/', uploadLimiter, uploadSingle, uploadController.uploadFile);

// 查詢路由
router.get('/jobs', queryLimiter, uploadController.listJobs);
router.get('/jobs/:jobId', queryLimiter, uploadController.getStatus);

module.exports = router;
