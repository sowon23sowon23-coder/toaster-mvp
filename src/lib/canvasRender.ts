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

type TemplateLayout = {
  backdropInsetX: number;
  backdropInsetY: number;
  backdropRadius: number;
  panelInsetX: number;
  panelInsetY: number;
  panelRadius: number;
  panelBorderWidth: number;
  panelFill: string;
  panelBorder: string;
  slotTop: number;
  slotWidth: number;
  slotHeight: number;
  slotGap: number;
  watermarkWidth: number;
  watermarkBottom: number;
};

function getTemplateLayout(templateId: string): TemplateLayout {
  if (templateId === "signature") {
    return {
      backdropInsetX: 150,
      backdropInsetY: 6,
      backdropRadius: 56,
      panelInsetX: 270,
      panelInsetY: 10,
      panelRadius: 44,
      panelBorderWidth: 14,
      panelFill: "#E9E1D7",
      panelBorder: "#D75A8E",
      slotTop: 86,
      slotWidth: 510,
      slotHeight: 272,
      slotGap: 22,
      watermarkWidth: 132,
      watermarkBottom: 34,
    };
  }

  return {
    backdropInsetX: 0,
    backdropInsetY: 0,
    backdropRadius: 0,
    panelInsetX: 0,
    panelInsetY: 0,
    panelRadius: 0,
    panelBorderWidth: 0,
    panelFill: "",
    panelBorder: "",
    slotTop: 92,
    slotWidth: 355,
    slotHeight: 266,
    slotGap: 22,
    watermarkWidth: 190,
    watermarkBottom: 32,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

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
  const layout = getTemplateLayout(options.template.id);

  if (options.template.id !== "signature") {
    ctx.fillStyle = options.template.background;
    ctx.fillRect(0, 0, width, height);
  }

  if (options.template.id === "signature") {
    const backdropX = Math.round(layout.backdropInsetX * scaleX);
    const backdropY = Math.round(layout.backdropInsetY * scaleY);
    const backdropWidth = width - backdropX * 2;
    const backdropHeight = height - backdropY * 2;
    drawRoundedRect(
      ctx,
      backdropX,
      backdropY,
      backdropWidth,
      backdropHeight,
      Math.round(layout.backdropRadius * scaleX),
    );
    ctx.fillStyle = "#fffdfd";
    ctx.fill();

    const panelX = Math.round(layout.panelInsetX * scaleX);
    const panelY = Math.round(layout.panelInsetY * scaleY);
    const panelWidth = width - panelX * 2;
    const panelHeight = height - panelY * 2;
    drawRoundedRect(
      ctx,
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      Math.round(layout.panelRadius * scaleX),
    );
    ctx.lineWidth = Math.max(4, Math.round(layout.panelBorderWidth * scaleX));
    ctx.strokeStyle = layout.panelBorder;
    ctx.stroke();
  }

  const slot = {
    top: Math.round(layout.slotTop * scaleY),
    width: Math.round(layout.slotWidth * scaleX),
    height: Math.round(layout.slotHeight * scaleY),
    gap: Math.round(layout.slotGap * scaleY),
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

  if (options.template.id !== "signature") {
    try {
      const frameImage = await loadImage(options.frameSrc);
      ctx.drawImage(frameImage, 0, 0, width, height);
    } catch {
      ctx.strokeStyle = "rgba(232, 83, 137, 0.7)";
      ctx.lineWidth = Math.round(18 * scaleX);
      ctx.strokeRect(0, 0, width, height);
    }
  }

  try {
    const watermark = await loadImage(options.watermarkSrc);
    const watermarkWidth = Math.round(layout.watermarkWidth * scaleX);
    const watermarkHeight = Math.round((watermark.height / watermark.width) * watermarkWidth);
    const x = Math.round((width - watermarkWidth) / 2);
    const y = height - watermarkHeight - Math.round(layout.watermarkBottom * scaleY);
    ctx.globalAlpha = 0.82;
    ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
    ctx.globalAlpha = 1;
  } catch {
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
