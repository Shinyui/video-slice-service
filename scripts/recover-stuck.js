const fs = require("fs-extra");
const path = require("path");
const videoService = require("../src/services/videoService");

const FILES_TO_RECOVER = [
  {
    id: "71ae63234266beef475cccc5658ffa41",
    dbId: "c220be2d-aa6d-4f87-b876-1fcd76f9ca29",
    size: 10197265,
  },
];

const uploadDir = path.join(__dirname, "../uploads");

async function run() {
  console.log("Starting manual recovery...");

  for (const file of FILES_TO_RECOVER) {
    const filePath = path.join(uploadDir, file.id);
    const metaPath = filePath + ".json";

    console.log(`Processing ${file.id}...`);

    // 1. Fix offset in JSON
    if (await fs.pathExists(metaPath)) {
      const meta = await fs.readJson(metaPath);
      if (meta.offset !== file.size) {
        console.log(
          `Fixing offset for ${file.id}: ${meta.offset} -> ${file.size}`
        );
        meta.offset = file.size;
        await fs.writeJson(metaPath, meta);
      }
    }

    // 2. Trigger Video Service
    console.log(`Triggering Video Service for ${file.dbId}...`);
    try {
      await videoService.processVideo(file.dbId, filePath);
    } catch (error) {
      console.error(`Failed to process ${file.dbId}:`, error);
    }
  }
}

run();
