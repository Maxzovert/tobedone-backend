import { v2 as cloudinary } from "cloudinary";
import { config } from "../config";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export function isCloudinaryConfigured(): boolean {
  return !!(
    config.cloudinary.cloudName &&
    config.cloudinary.apiKey &&
    config.cloudinary.apiSecret
  );
}

/** e.g. TOBEDONE/avatars */
export function resolveFolder(subfolder?: string): string {
  const base = config.cloudinary.folder;
  if (!subfolder) return base;
  const safe = subfolder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return safe ? `${base}/${safe}` : base;
}

export async function uploadImageBuffer(
  buffer: Buffer,
  options: { subfolder?: string; mimetype?: string }
): Promise<{ url: string; publicId: string }> {
  const folder = resolveFolder(options.subfolder);
  const isAvatar = options.subfolder === "avatars";

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        ...(isAvatar
          ? {
              transformation: [
                { width: 512, height: 512, crop: "fill", gravity: "face" },
                { quality: "auto", fetch_format: "auto" },
              ],
            }
          : { quality: "auto", fetch_format: "auto" }),
      },
      (err, result) => {
        if (err || !result?.secure_url) {
          reject(err ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    upload.end(buffer);
  });
}

export function publicIdFromUrl(url: string): string | null {
  if (!url.includes("res.cloudinary.com")) return null;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;

  let path = url.slice(idx + marker.length);
  path = path.replace(/^v\d+\//, "");

  const segments = path.split("/");
  const kept: string[] = [];
  for (const seg of segments) {
    if (
      seg.includes(",") ||
      /^[a-z]{1,3}_/.test(seg) ||
      /^w_\d+/.test(seg) ||
      /^h_\d+/.test(seg) ||
      /^c_/.test(seg)
    ) {
      continue;
    }
    kept.push(seg);
  }

  const joined = kept.join("/").replace(/\.[^/.]+$/, "");
  return joined || null;
}

export async function deleteByUrl(url: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  const publicId = publicIdFromUrl(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("Cloudinary delete failed:", publicId, err);
  }
}
