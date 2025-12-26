const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs-extra");
const path = require("path");
const storageService = require("./storageService");

// Mock Database to store job status
// In a real app, use Redis or a proper DB
const jobStatus = {};

class VideoService {
  constructor() {
    this.outputBase = path.join(__dirname, "../../output");
    fs.ensureDirSync(this.outputBase);

    // Simple in-memory queue concurrency limit
    // We use dynamic import for p-limit because it's an ESM module in newer versions,
    // but since we are in CommonJS, we might need a workaround or just implement a simple queue.
    // For simplicity in this CJS project, let's implement a simple array-based queue.
    this.queue = [];
    this.activeJobs = 0;
    this.concurrencyLimit = process.env.FFMPEG_CONCURRENCY_LIMIT || 2; // Max 2 FFmpeg processes at once
  }

  /**
   * Start the slicing job asynchronously
   * @param {string} fileId - Unique ID for the file
   * @param {string} filePath - Path to the uploaded raw mp4
   */
  processVideo(fileId, filePath) {
    // Initialize status
    jobStatus[fileId] = {
      status: "pending",
      progress: 0,
      error: null,
      resultUrl: null,
    };

    // Push to queue
    this.queue.push({ fileId, filePath });
    this._processQueue();
  }

  async _processQueue() {
    if (this.activeJobs >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    this.activeJobs++;
    const { fileId, filePath } = this.queue.shift();

    try {
      await this._runFfmpeg(fileId, filePath);
    } catch (err) {
      console.error(`Job ${fileId} failed:`, err);
      jobStatus[fileId].status = "failed";
      jobStatus[fileId].error = err.message;
    } finally {
      this.activeJobs--;
      this._processQueue(); // Trigger next job
    }
  }

  async _runFfmpeg(fileId, filePath) {
    const outputDir = path.join(this.outputBase, fileId);
    await fs.ensureDir(outputDir);

    const outputPlaylist = path.join(outputDir, "index.m3u8");

    jobStatus[fileId].status = "processing";
    console.log(`[${fileId}] Starting FFmpeg processing...`);

    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        // Video settings: H.264, High Quality, Force Keyframes
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-crf 23", // Constant Rate Factor (18-28 is good range, lower is better)
          "-preset fast", // Balance between speed and compression
          "-g 48", // Force keyframe every 48 frames (approx 2s at 24fps) for better seeking
          "-sc_threshold 0", // Disable scene change detection for consistent segments
          "-hls_time 10", // 10 second segments
          "-hls_list_size 0", // Include all segments in playlist
          "-f hls", // HLS format
        ])
        .output(outputPlaylist)
        .on("start", (commandLine) => {
          console.log(
            `[${fileId}] Spawned Ffmpeg with command: ` + commandLine
          );
        })
        .on("progress", (progress) => {
          // progress.percent can be unstable for HLS, but we try
          if (progress.percent) {
            const percent = Math.round(progress.percent);
            jobStatus[fileId].progress = percent;
            console.log(`[${fileId}] FFmpeg Progress: ${percent}%`);
          }
        })
        .on("error", (err) => {
          console.error(`[${fileId}] Error:`, err.message);
          jobStatus[fileId].status = "failed";
          jobStatus[fileId].error = err.message;
          // Cleanup
          fs.remove(filePath).catch(() => {});
          fs.remove(outputDir).catch(() => {});
          reject(err);
        })
        .on("end", async () => {
          console.log(`[${fileId}] Transcoding finished!`);

          try {
            // Upload to MinIO
            jobStatus[fileId].status = "uploading";
            await storageService.uploadHLSFiles(outputDir, fileId);

            // Cleanup local files
            await fs.remove(filePath); // remove original upload
            await fs.remove(outputDir); // remove segments

            // Update status
            const remoteUrl = storageService.getFileUrl(`${fileId}/index.m3u8`);
            jobStatus[fileId].status = "completed";
            jobStatus[fileId].progress = 100;
            jobStatus[fileId].resultUrl = remoteUrl;

            console.log(
              `[${fileId}] Job completed successfully. URL: ${remoteUrl}`
            );
            resolve(remoteUrl);
          } catch (uploadErr) {
            console.error(`[${fileId}] Upload error:`, uploadErr);
            jobStatus[fileId].status = "failed";
            jobStatus[fileId].error = "Upload failed: " + uploadErr.message;
            reject(uploadErr);
          }
        })
        .run();
    });
  }

  /**
   * Get job status
   */
  getStatus(fileId) {
    return jobStatus[fileId] || null;
  }
}

module.exports = new VideoService();
