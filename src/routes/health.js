const express = require('express');
const router = express.Router();
const redis = require('../infrastructure/database/redis.client');
const queueService = require('../shared/services/queue.service');
const config = require('../config');
const { QUEUE_NAME } = require('../shared/utils/constants');

/**
 * 健康檢查端點
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: require('../../package.json').version,
    environment: config.app.env,
    services: {},
    queue: {},
  };

  try {
    // 檢查 MinIO (通過 storage service)
    const storageService = require('../shared/services/storage.service');
    if (storageService.initialized) {
      health.services.minio = { status: 'connected' };
    } else {
      health.status = 'degraded';
      health.services.minio = { status: 'not_initialized' };
    }
  } catch (err) {
    health.status = 'unhealthy';
    health.services.minio = { status: 'error', message: err.message };
  }

  try {
    // 檢查 Redis
    if (redis.isAvailable()) {
      health.services.redis = { status: 'connected' };
    } else {
      health.services.redis = { status: 'using_memory_fallback' };
    }
  } catch (err) {
    health.services.redis = { status: 'error', message: err.message };
  }

  try {
    // 檢查 FFmpeg
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.getAvailableFormats((err) => {
      if (!err) {
        health.services.ffmpeg = { status: 'available' };
      } else {
        health.status = 'degraded';
        health.services.ffmpeg = { status: 'unavailable' };
      }
    });
  } catch (err) {
    health.status = 'degraded';
    health.services.ffmpeg = { status: 'error' };
  }

  // 隊列指標
  try {
    health.queue.videoTranscode = queueService.getQueueMetrics(QUEUE_NAME.VIDEO_TRANSCODE) || { pending: 0, active: 0 };
  } catch (err) {
    health.queue.error = err.message;
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * 就緒檢查（K8s readiness probe）
 */
router.get('/health/ready', (req, res) => {
  // 簡單檢查：服務是否能接受請求
  res.status(200).json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * 存活檢查（K8s liveness probe）
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
