const videoService = require("../services/videoService");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

class UploadController {
  /**
   * Handle video upload
   */
  async uploadVideo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }

      const fileId = uuidv4();
      const filePath = req.file.path;

      // Validate mimetype
      const allowedMimeTypes = ["video/mp4", "video/quicktime"];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        // Clean up if invalid
        require("fs-extra").remove(filePath);
        return res.status(400).json({
          error: "Invalid file format. Only MP4 and MOV files are allowed.",
          receivedType: req.file.mimetype,
        });
      }

      // Start processing (Async)
      videoService.processVideo(fileId, filePath);

      // Respond immediately
      return res.status(202).json({
        message: "Video accepted for processing",
        fileId: fileId,
        statusUrl: `/api/status/${fileId}`,
      });
    } catch (error) {
      console.error("Upload controller error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  /**
   * Check processing status
   */
  async getStatus(req, res) {
    const { fileId } = req.params;
    const status = videoService.getStatus(fileId);

    if (!status) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({
      fileId,
      ...status,
    });
  }
}

module.exports = new UploadController();
