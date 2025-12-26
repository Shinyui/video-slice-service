const Minio = require("minio");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "videos";

const setCors = async () => {
  try {
    console.log(
      `Setting CORS for bucket: ${BUCKET_NAME} on ${process.env.MINIO_ENDPOINT}...`
    );

    // MinIO (S3) CORS Configuration
    // Allowing all origins for development convenience
    const corsConfig = {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["ETag"],
        },
      ],
    };

    // There isn't a direct setBucketCors method in the minio-js library public API easily accessible for all versions,
    // but setBucketPolicy is for access control.
    // For CORS, we often need to use the AWS SDK or MinIO mc command line tool.
    // However, minio-js DOES NOT strictly support `putBucketCors` in all versions directly as a high level method.
    // BUT, we can assume standard S3 compatibility or just set the policy to public (which we did).

    // WAIT: Browser playback fails mostly due to CORS headers not being sent by MinIO.
    // MinIO defaults to allowing CORS if you configure it via mc or if using command line flags.
    // But let's try to set a Read-Only policy again which often helps,
    // AND importantly, advise the user to use 'mc' tool if this script is limited.

    // Let's try to set a more permissive policy that explicitly allows public read.
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        },
      ],
    };

    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    console.log("✅ Bucket policy set to Public Read.");
    console.log(
      "NOTE: If you still have CORS errors, you MUST configure CORS on your MinIO server."
    );
    console.log("You can use the MinIO Client (mc) tool:");
    console.log(
      `  mc alias set myminio https://${process.env.MINIO_ENDPOINT} ${process.env.MINIO_ACCESS_KEY} ${process.env.MINIO_SECRET_KEY}`
    );
    console.log(`  mc anonymous set public myminio/${BUCKET_NAME}`);
  } catch (err) {
    console.error("❌ Error setting policy:", err);
  }
};

setCors();
