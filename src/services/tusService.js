const { Server, EVENTS } = require("@tus/server");
const { FileStore } = require("@tus/file-store");
const path = require("path");
const fs = require("fs-extra");
const videoService = require("../services/videoService");
const imageService = require("../services/imageService");

const uploadDir = path.join(__dirname, "../../uploads");
fs.ensureDirSync(uploadDir);

const tusServer = new Server({
  path: "/api/tus",
  datastore: new FileStore({
    directory: uploadDir,
  }),
  relativeLocation: true,
});

/**
 * Event Listener for upload completion
 */
const handleUploadComplete = (req, res, upload) => {
  // Only process if the upload is actually complete
  if (upload.offset !== upload.size) {
    return;
  }

  const fileId = upload.id;
  const filePath = path.join(uploadDir, fileId);

  console.log(`[Tus] Upload finished: ${fileId}`);

  const metadata = upload.metadata || {};
  console.log(`[Tus] Metadata:`, metadata);

  const processId = metadata.dbId || fileId;
  const mimeType = metadata.filetype || metadata.type || "";

  if (mimeType.startsWith("image/")) {
    console.log(`[Tus] Delegating to ImageService: ${processId}`);
    imageService.processImage(processId, filePath, metadata);
  } else {
    console.log(`[Tus] Delegating to VideoService: ${processId}`);
    videoService.processVideo(processId, filePath);
  }
};

tusServer.on(EVENTS.POST_FINISH, handleUploadComplete);
tusServer.on(EVENTS.PATCH_FINISH, handleUploadComplete);

module.exports = tusServer;
