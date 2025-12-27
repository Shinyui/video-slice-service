const express = require('express');
const router = express.Router();

// 導入模塊路由
const uploadRoutes = require('../../modules/upload/upload.routes');

// 掛載路由
router.use('/uploads', uploadRoutes);

// Health check for v1 API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    version: 'v1',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
