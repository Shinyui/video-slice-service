const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const apiRoutes = require("./routes/api");
const tusServer = require("./services/tusService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Mount Tus Server BEFORE body parsers to avoid conflicts
// Tus server handles its own stream processing
app.use("/api/tus", tusServer.handle.bind(tusServer));

// Increase body size limit for large uploads (though multer handles streams, some metadata might need space)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Routes
app.use("/api", apiRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("Video Slice Service is running");
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test upload at POST http://localhost:${PORT}/api/upload`);
  });
}

module.exports = app;
