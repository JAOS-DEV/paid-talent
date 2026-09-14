import {
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_MAX_DIMENSION,
} from "@/lib/media/profile-photo";

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Resize/compress a profile photo in the browser.
 * Uses canvas only — no extra imaging dependency.
 * If the environment cannot decode the image, the original file is returned.
 */
export async function prepareProfileImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale =
      longest > PROFILE_PHOTO_MAX_DIMENSION
        ? PROFILE_PHOTO_MAX_DIMENSION / longest
        : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (
      scale === 1 &&
      file.size <= PROFILE_PHOTO_MAX_BYTES &&
      typeof document === "undefined"
    ) {
      return file;
    }

    if (typeof document === "undefined") {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const outputType =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";

    let quality = outputType === "image/jpeg" ? 0.85 : 0.92;
    let blob = await canvasToBlob(canvas, outputType, quality);

    if (blob && blob.size > PROFILE_PHOTO_MAX_BYTES && outputType === "image/jpeg") {
      quality = 0.72;
      blob = await canvasToBlob(canvas, outputType, quality);
    }

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const nextName = file.name.replace(
      /\.[^.]+$/,
      `.${extensionForType(outputType)}`
    );

    return new File([blob], nextName, { type: outputType });
  } finally {
    bitmap.close();
  }
}
