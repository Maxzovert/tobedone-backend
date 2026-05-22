import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  uploadDir: "uploads",
  jwtExpiresIn: "7d" as const,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    /** Root folder in your Cloudinary media library */
    folder: process.env.CLOUDINARY_FOLDER || "TOBEDONE",
  },
};

if (!config.databaseUrl) {
  console.warn("WARNING: DATABASE_URL is not set");
}
