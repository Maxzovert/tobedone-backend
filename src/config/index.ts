import * as dotenv from "dotenv";
import type { SignOptions } from "jsonwebtoken";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  uploadDir: "uploads",
  /** How long login lasts (e.g. 365d). User stays signed in until logout or expiry. */
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || "365d") as SignOptions["expiresIn"],
  /** Optional — Expo dashboard → Access Tokens (improves push reliability) */
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || "",
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
