const { Server, EVENTS } = require("@tus/server");
const { FileStore } = require("@tus/file-store");
const path = require("path");
const fs = require("fs-extra");
const videoService = require("../services/videoService");

const uploadDir = path.join(__dirname, "../../uploads");
fs.ensureDirSync(uploadDir);

const tusServer = new Server({
  path: "/api/tus",
  datastore: new FileStore({
    directory: uploadDir,
  }),
  // Force relative location headers to avoid protocol mismatch behind proxies (http vs https)
  relativeLocation: true,
});

/**
 * Event Listener for upload completion
 */
tusServer.on(EVENTS.POST_FINISH, (req, res, upload) => {
  const fileId = upload.id;
  // The file path in FileStore is usually directory + id
  // However, @tus/file-store might append extension or metadata.
  // By default, FileStore saves the file content in `directory/id` (no extension usually, or just binary)
  // and metadata in `directory/id.json` or similar.

  // We need to verify the exact path.
  // In @tus/file-store, the file is stored exactly at `path.join(directory, fileId)`
  const filePath = path.join(uploadDir, fileId);

  console.log(`[Tus] Upload finished: ${fileId}`);

  // Check metadata to ensure it's a video (if client sent metadata)
  const metadata = upload.metadata || {};
  // Note: metadata values from tus client are strings.

  console.log(`[Tus] Metadata:`, metadata);

  // Trigger video processing
  // Note: VideoService expects a file path.
  // Since tus files might not have extensions, we might want to rename it or just pass it.
  // FFmpeg usually detects format by content, so extension is not strictly necessary but helpful.

  // Let's pass it to videoService
  videoService.processVideo(fileId, filePath);
});

module.exports = tusServer;
