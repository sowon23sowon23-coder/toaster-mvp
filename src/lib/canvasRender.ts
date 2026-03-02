import { FilterConfig, FontConfig, TemplateConfig } from "./assets";
import { StickerItem } from "../store/usePhotoboothStore";

type RenderOptions = {
  photos: Blob[];
  template: TemplateConfig;
  filter: FilterConfig;
  stickers: StickerItem[];
  textLine: string;
  textFont: FontConfig;
  frameSrc: string;
  watermarkSrc: string;
  width?: number;
  height?: number;
};

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image load failed: ${src}`));
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

export async function renderPhotoboothImage(options: RenderOptions): Promise<Blob> {
  const width = options.width ?? 1080;
  const height = options.height ?? 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");

  const scaleX = width / 1080;
  const scaleY = height / 1350;

  ctx.fillStyle = options.template.background;
  ctx.fillRect(0, 0, width, height);

  // Match slot geometry to frame overlay placeholders to avoid visual overlap.
  const slot = {
    top: Math.round(92 * scaleY),
    width: Math.round(355 * scaleX),
    height: Math.round(266 * scaleY),
    gap: Math.round(22 * scaleY),
  };
  const photoLeft = Math.round((width - slot.width) / 2);

  ctx.filter = options.filter.canvasFilter;
  for (let i = 0; i < 4; i += 1) {
    const photo = options.photos[i];
    const y = slot.top + i * (slot.height + slot.gap);

    ctx.fillStyle = "#f4f0ea";
    ctx.fillRect(photoLeft, y, slot.width, slot.height);

    if (photo) {
      try {
        const image = await loadImageFromBlob(photo);
        ctx.save();
        ctx.beginPath();
        ctx.rect(photoLeft, y, slot.width, slot.height);
        ctx.clip();
        drawCover(ctx, image, photoLeft, y, slot.width, slot.height);
        ctx.restore();
      } catch {
        ctx.fillStyle = "#DDD";
        ctx.fillRect(photoLeft, y, slot.width, slot.height);
      }
    }

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = Math.max(2, Math.round(3 * scaleX));
    ctx.strokeRect(photoLeft, y, slot.width, slot.height);
  }
  ctx.filter = "none";

  for (const sticker of options.stickers) {
    const stickerSize = sticker.scale * width;
    const stickerX = sticker.x * width - stickerSize / 2;
    const stickerY = sticker.y * height - stickerSize / 2;

    try {
      const image = await loadImage(sticker.src);
      ctx.drawImage(image, stickerX, stickerY, stickerSize, stickerSize);
    } catch {
      ctx.fillStyle = "#ff6aa2";
      ctx.beginPath();
      ctx.arc(stickerX + stickerSize / 2, stickerY + stickerSize / 2, stickerSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (options.textLine.trim()) {
    const fontSize = Math.round(44 * scaleY);
    ctx.font = `700 ${fontSize}px ${options.textFont.cssFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5f2e51";
    ctx.fillText(options.textLine.trim(), width / 2, height - Math.round(128 * scaleY));
  }

  try {
    const frameImage = await loadImage(options.frameSrc);
    ctx.drawImage(frameImage, 0, 0, width, height);
  } catch {
    ctx.strokeStyle = "rgba(232, 83, 137, 0.7)";
    ctx.lineWidth = Math.round(18 * scaleX);
    ctx.strokeRect(0, 0, width, height);
  }

  try {
    const watermark = await loadImage(options.watermarkSrc);
    const watermarkWidth = Math.round(190 * scaleX);
    const watermarkHeight = Math.round((watermark.height / watermark.width) * watermarkWidth);
    const x = Math.round((width - watermarkWidth) / 2);
    const y = height - watermarkHeight - Math.round(32 * scaleY);
    ctx.globalAlpha = 0.82;
    ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
    ctx.globalAlpha = 1;
  } catch {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#7a4e66";
    ctx.font = `600 ${Math.round(24 * scaleY)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Yogurtland", width / 2, height - Math.round(38 * scaleY));
    ctx.globalAlpha = 1;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Failed to render PNG."));
      resolve(blob);
    }, "image/png");
  });
}

export function buildDownloadName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `Yogurtland_SweetMoment_${y}${m}${d}.png`;
}
