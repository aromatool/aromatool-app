// ============================================================
// UPLOAD POZĂ pentru emailurile „trimite în grup".
//
// Bucket PUBLIC `campaign-images` (vezi migration 20260622) — poza
// trebuie să fie accesibilă fără autentificare ca să se afișeze
// inline în Gmail/Outlook prin <img src=...>.
//
// Comprimăm/redimensionăm pe client (canvas → JPEG) ca să ținem
// emailurile ușoare și să rămânem sub limita de 3 MB a bucket-ului.
// GIF-urile NU se comprimă (canvas ar pierde animația) — se urcă
// ca atare, dacă sunt sub limită.
//
// Path: {user_id}/{uuid}.{ext} — izolare per user (RLS pe folder).
// ============================================================

import { supabase } from "./supabase";

export const MAX_CAMPAIGN_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB (= limita bucket)

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read_failed"));
    fr.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode_failed"));
    img.src = src;
  });
}

// Redimensionează la maxim `maxDim` px pe latura mare și exportă JPEG.
async function compressToJpeg(
  file: File,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unsupported");
  // Fundal alb: dacă poza are transparență (PNG), JPEG-ul nu o suportă.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("compress_failed");
  return blob;
}

export type UploadImageError =
  | "not_image"
  | "too_large"
  | "compress_failed"
  | "upload_failed";

/**
 * Comprimă (dacă e cazul) și urcă poza în bucket-ul public `campaign-images`.
 * Întoarce URL-ul public, gata de pus în <img src=...> în email.
 * Aruncă un Error cu `.message` dintre UploadImageError la eșec.
 */
export async function uploadCampaignImage(
  file: File,
  userId: string,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not_image" satisfies UploadImageError);

  let blob: Blob;
  let ext: string;
  let contentType: string;

  if (file.type === "image/gif") {
    // GIF: păstrăm animația → fără canvas. Doar verificăm limita.
    if (file.size > MAX_CAMPAIGN_IMAGE_BYTES) throw new Error("too_large" satisfies UploadImageError);
    blob = file;
    ext = "gif";
    contentType = "image/gif";
  } else {
    // JPEG/PNG/WebP → comprimă la JPEG. Dacă tot e prea mare, mai strângem.
    blob = await compressToJpeg(file, 1280, 0.82);
    if (blob.size > MAX_CAMPAIGN_IMAGE_BYTES) {
      blob = await compressToJpeg(file, 1024, 0.7);
    }
    if (blob.size > MAX_CAMPAIGN_IMAGE_BYTES) throw new Error("too_large" satisfies UploadImageError);
    ext = "jpg";
    contentType = "image/jpeg";
  }

  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${userId}/${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from("campaign-images")
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error("upload_failed" satisfies UploadImageError);

  const { data } = supabase.storage.from("campaign-images").getPublicUrl(path);
  return data.publicUrl;
}
