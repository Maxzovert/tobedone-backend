import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "../config";
import { createId } from "./id";
import { isCloudinaryConfigured } from "../services/cloudinary.service";

const uploadPath = path.join(process.cwd(), config.uploadDir);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${createId()}${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed"));
  }
};

/** Images go to Cloudinary when configured; otherwise saved under /uploads. */
export const upload = multer({
  storage: isCloudinaryConfigured() ? multer.memoryStorage() : diskStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
