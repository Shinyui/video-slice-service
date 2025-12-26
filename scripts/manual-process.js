const videoService = require("../src/services/videoService");
const path = require("path");

const fileId = "290fec2770bafac1ab3df341b081d723";
const dbId = "bec6f629-1b46-4e1f-88a8-41181ef7f80d";
const uploadDir = path.join(__dirname, "../uploads");
const filePath = path.join(uploadDir, fileId);

console.log(`Manually processing file: ${fileId}`);
console.log(`DB ID: ${dbId}`);
console.log(`File Path: ${filePath}`);

videoService.processVideo(dbId, filePath);
