import fs from "fs";
import path from "path";
import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { config } from "../config";
import { createId } from "../utils/id";
import { sendError, sendSuccess } from "../utils/response";
import {
  isCloudinaryConfigured,
  uploadImageBuffer,
} from "../services/cloudinary.service";

const SAFE_SUBFOLDERS = new Set(["avatars", "chat", "misc"]);

function normalizeSubfolder(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "misc";
  return SAFE_SUBFOLDERS.has(value) ? value : "misc";
}

export async function uploadFile(req: AuthenticatedRequest, res: Response) {
  if (!req.file) {
    return sendError(res, "No file uploaded", 400);
  }

  const subfolder = normalizeSubfolder(req.body?.folder);
  const isImage = req.file.mimetype.startsWith("image/");

  if (isImage && isCloudinaryConfigured()) {
    const buffer = req.file.buffer;
    if (!buffer?.length) {
      return sendError(res, "Upload buffer missing", 500);
    }
    try {
      const { url, publicId } = await uploadImageBuffer(buffer, {
        subfolder,
        mimetype: req.file.mimetype,
      });
      return sendSuccess(res, {
        url,
        publicId,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        storage: "cloudinary",
      });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return sendError(res, "Image upload failed", 500);
    }
  }

  const buffer = req.file.buffer;
  if (!buffer?.length) {
    return sendError(res, "Upload failed", 500);
  }

  const uploadDir = path.join(process.cwd(), config.uploadDir);
  const ext = path.extname(req.file.originalname) || "";
  const filename = `${createId()}${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);

  const url = `/uploads/${filename}`;
  return sendSuccess(res, {
    url,
    filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
    storage: "local",
  });
}
