const fs = require('fs-extra');
const path = require('path');
const videoService = require('./videoService');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const CHECK_INTERVAL_MS = 10 * 60 * 1000;  // 10 minutes

class RecoveryService {
  constructor() {
    this.isScanning = false;
  }

  start() {
    console.log('[RecoveryService] Starting stale upload recovery service...');
    // Run immediately on startup
    this.scanAndRecover();
    // Schedule periodic checks
    setInterval(() => this.scanAndRecover(), CHECK_INTERVAL_MS);
  }

  async scanAndRecover() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      await fs.ensureDir(UPLOAD_DIR);
      const files = await fs.readdir(UPLOAD_DIR);

      // Filter for data files (exclude .json metadata files)
      const dataFiles = files.filter(f => !f.endsWith('.json'));

      for (const filename of dataFiles) {
        await this.checkFile(filename);
      }
    } catch (error) {
      console.error('[RecoveryService] Scan failed:', error);
    } finally {
      this.isScanning = false;
    }
  }

  async checkFile(filename) {
    const filePath = path.join(UPLOAD_DIR, filename);
    const metaPath = filePath + '.json';

    try {
      const stats = await fs.stat(filePath);
      const now = Date.now();
      const timeSinceModification = now - stats.mtimeMs;

      // Only process files that haven't been touched in a while (stable)
      if (timeSinceModification > STALE_THRESHOLD_MS) {
        console.log(`[RecoveryService] Found stale file: ${filename} (Size: ${stats.size} bytes)`);

        // Attempt to read metadata
        let metadata = {};
        let dbId = null;
        
        if (await fs.pathExists(metaPath)) {
            try {
                const metaContent = await fs.readJson(metaPath);
                metadata = metaContent.metadata || {};
                dbId = metadata.dbId;
                
                // Optional: Fix offset in JSON if it's 0 but file exists (Self-healing)
                if (metaContent.offset === 0 && stats.size > 0) {
                    console.log(`[RecoveryService] Fixing corrupted offset for ${filename}`);
                    metaContent.offset = stats.size;
                    await fs.writeJson(metaPath, metaContent);
                }
            } catch (err) {
                console.warn(`[RecoveryService] Could not read metadata for ${filename}:`, err.message);
            }
        }

        const processId = dbId || filename;

        // Check if it's already being processed (in memory)
        const jobStatus = videoService.getStatus(processId);
        if (jobStatus && ['pending', 'processing', 'uploading'].includes(jobStatus.status)) {
            console.log(`[RecoveryService] File ${processId} is already in active job queue. Skipping.`);
            return;
        }

        console.log(`[RecoveryService] Triggering recovery for: ${processId}`);
        
        // Trigger processing
        // We assume that if it's still here after 15 mins, it needs processing.
        // VideoService will handle cleanup (delete file) upon success or failure.
        videoService.processVideo(processId, filePath);
      }
    } catch (error) {
      console.error(`[RecoveryService] Error checking file ${filename}:`, error);
    }
  }
}

module.exports = new RecoveryService();
