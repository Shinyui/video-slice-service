const Minio = require("minio");
require("dotenv").config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

// Check if bucket exists, if not create it
const ensureBucket = async (bucketName) => {
  try {
    console.log(
      `Checking connection to MinIO at ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}...`
    );
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, "us-east-1");
      console.log(`Bucket ${bucketName} created successfully`);
    } else {
      console.log(`Bucket ${bucketName} exists and connection is healthy.`);
    }
  } catch (err) {
    console.error("---------------------------------------------------");
    console.error("❌ Error connecting to MinIO or ensuring bucket:");
    console.error(`   Message: ${err.message}`);
    console.error(`   Endpoint: ${process.env.MINIO_ENDPOINT}`);
    console.error(
      "   Hint: Check your .env file. If using play.min.io, it might be slow or down."
    );
    console.error("   Hint: Consider running MinIO locally using Docker:");
    console.error(
      '         docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"'
    );
    console.error("---------------------------------------------------");
  }
};

module.exports = { minioClient, ensureBucket };
