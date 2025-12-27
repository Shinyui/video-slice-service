const Minio = require('minio');
const config = require('../../config');
const logger = require('../../shared/services/logger.service');

// 創建 MinIO 客戶端
const minioClient = new Minio.Client({
  endPoint: config.storage.endpoint,
  port: config.storage.port,
  useSSL: config.storage.useSSL,
  accessKey: config.storage.accessKey,
  secretKey: config.storage.secretKey,
});

/**
 * 確保 Bucket 存在
 */
async function ensureBucket(bucketName) {
  try {
    logger.info(`Checking MinIO connection: ${config.storage.endpoint}:${config.storage.port}`);

    const exists = await minioClient.bucketExists(bucketName);

    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      logger.info(`Bucket '${bucketName}' created successfully`);
    } else {
      logger.info(`Bucket '${bucketName}' exists and connection is healthy`);
    }

    return true;
  } catch (err) {
    logger.error('MinIO connection error', {
      endpoint: config.storage.endpoint,
      port: config.storage.port,
      error: err.message,
    });

    logger.warn('Hint: Make sure MinIO is running and credentials are correct');
    logger.warn('For local development, run: docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"');

    throw err;
  }
}

/**
 * 設置 Bucket 策略（公開或私有）
 */
async function setBucketPolicy(bucketName, isPublic = false) {
  try {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: isPublic ? 'Allow' : 'Deny',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    logger.info(`Bucket policy set to ${isPublic ? 'public' : 'private'} read`);
  } catch (err) {
    logger.warn('Could not set bucket policy', { error: err.message });
    // 不拋出錯誤，繼續運行
  }
}

module.exports = {
  client: minioClient,
  ensureBucket,
  setBucketPolicy,
};
