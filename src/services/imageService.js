const fs = require("fs-extra");
const path = require("path");
const storageService = require("./storageService");

class ImageService {
  constructor() {
    this.queue = [];
    this.activeJobs = 0;
    this.concurrencyLimit = 5;
  }

  processImage(fileId, filePath, metadata) {
    this.queue.push({ fileId, filePath, metadata });
    this._processQueue();
  }

  async _processQueue() {
    if (this.activeJobs >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    this.activeJobs++;
    const { fileId, filePath, metadata } = this.queue.shift();

    try {
      console.log(`[ImageService] Processing ${fileId}...`);

      // Determine file extension
      const originalName = metadata.filename || metadata.name || "image";
      const ext = path.extname(originalName) || ".jpg";
      const remoteName = `${fileId}${ext}`;
      const contentType = metadata.filetype || metadata.type || "image/jpeg";

      // Upload directly to MinIO
      await storageService.uploadFile(filePath, remoteName, contentType);

      const remoteUrl = storageService.getFileUrl(remoteName);
      console.log(`[ImageService] Uploaded ${fileId} to ${remoteUrl}`);

      // Notify Backend
      try {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
        await fetch(`${backendUrl}/api/files/${fileId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED", url: remoteUrl }),
        });
        console.log(`[ImageService] Notified backend for ${fileId}`);
      } catch (err) {
        console.error(
          `[ImageService] Failed to notify backend for ${fileId}:`,
          err
        );
      }

      // Cleanup local file and metadata
      await fs.remove(filePath);
      await fs.remove(`${filePath}.json`); // Remove tus metadata file
    } catch (err) {
      console.error(`[ImageService] Failed to process ${fileId}:`, err);
      // Notify backend of failure?
    } finally {
      this.activeJobs--;
      this._processQueue();
    }
  }
}

module.exports = new ImageService();
