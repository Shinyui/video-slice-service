const { minioClient, ensureBucket } = require("../config/minio");
const fs = require("fs-extra");
const path = require("path");
require("dotenv").config();

const BUCKET_NAME = process.env.MINIO_BUCKET || "videos";

class StorageService {
  constructor() {
    this.init();
  }

  async init() {
    await ensureBucket(BUCKET_NAME);

    // Set bucket policy to public read (optional, depends on security requirements)
    // For HLS, usually we want public read or signed URLs.
    // For simplicity in this demo, we assume the bucket needs to be readable.
    try {
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log("Bucket policy set to public read");
    } catch (err) {
      // Policy might already exist or permission denied, log warning but continue
      console.warn(
        "Warning: Could not set bucket policy, make sure it is accessible:",
        err.message
      );
    }
  }

  /**
   * Upload a single file
   */
  async uploadFile(localPath, remoteName, contentType) {
    const metaData = {
      "Content-Type": contentType,
    };
    await minioClient.fPutObject(BUCKET_NAME, remoteName, localPath, metaData);
  }

  /**
   * Upload a directory of HLS files (m3u8 and ts)
   * @param {string} dirPath - Local directory path containing segments
   * @param {string} remotePrefix - Remote folder prefix (e.g., 'videos/file-id/')
   */
  async uploadHLSFiles(dirPath, remotePrefix) {
    const files = await fs.readdir(dirPath);

    // Simple concurrency limit (e.g., 5 parallel uploads)
    // because Promise.all with hundreds of files can cause socket timeout or EMFILE errors
    const CONCURRENCY = process.env.UPLOAD_CONCURRENCY_LIMIT || 5;

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (file) => {
          const filePath = path.join(dirPath, file);
          const remotePath = path.join(remotePrefix, file);

          let contentType = "application/octet-stream";
          if (file.endsWith(".m3u8")) contentType = "application/x-mpegURL";
          if (file.endsWith(".ts")) contentType = "video/MP2T";

          console.log(`Uploading ${file} to ${remotePath}...`);
          await this.uploadFile(filePath, remotePath, contentType);
        })
      );

      // Log batch progress
      const uploadedCount = Math.min(i + CONCURRENCY, files.length);
      const progress = Math.round((uploadedCount / files.length) * 100);
      console.log(
        `[Upload] Progress: ${uploadedCount}/${files.length} files (${progress}%)`
      );
    }

    console.log(`All files from ${dirPath} uploaded to ${remotePrefix}`);
  }

  /**
   * Generate a public URL for the m3u8 file
   */
  getFileUrl(remotePath) {
    const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
    const host = process.env.MINIO_ENDPOINT;
    const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : "";
    return `${protocol}://${host}${port}/${BUCKET_NAME}/${remotePath}`;
  }
}

module.exports = new StorageService();
