export const MAX_COVER_SOURCE_SIZE_MB = 60;
export const AUTO_COMPRESS_THRESHOLD_MB = 15;

const MAX_PREVIEW_EDGE = 3200;
const JPEG_QUALITY = 0.88;

export type CoverImageErrorCode = "invalid-type" | "too-large" | "decode-error";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode-error"));
    image.src = url;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("decode-error"));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("decode-error"));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function prepareCoverImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("invalid-type" satisfies CoverImageErrorCode);
  }

  if (file.size > MAX_COVER_SOURCE_SIZE_MB * 1024 * 1024) {
    throw new Error("too-large" satisfies CoverImageErrorCode);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("decode-error" satisfies CoverImageErrorCode);
    }

    const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("decode-error" satisfies CoverImageErrorCode);
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await canvasToBlob(canvas);
    return {
      dataUrl: await blobToDataUrl(compressedBlob),
      wasCompressed: file.size > AUTO_COMPRESS_THRESHOLD_MB * 1024 * 1024 || scale < 1
    };
  } catch (error) {
    if (error instanceof Error && error.message === "decode-error") throw error;
    throw new Error("decode-error" satisfies CoverImageErrorCode);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
