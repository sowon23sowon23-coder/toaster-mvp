import { FilterConfig, FontConfig, TemplateConfig } from "./assets";
import { StickerItem } from "../store/usePhotoboothStore";

type RenderOptions = {
  photos: Blob[];
  template: TemplateConfig;
  filter: FilterConfig;
  stickers: StickerItem[];
  textLine: string;
  textFont: FontConfig;
  watermarkSrc: string;
  width?: number;
  height?: number;
  // Live tuning overrides (used by the /admin layout tool) — merged over the
  // template's default layout/overscan/anchor so the preview renders through
  // the exact same code path production uses.
  layoutOverride?: Partial<TemplateLayout>;
  photoOverscanOverride?: number;
  verticalAnchorOverride?: number;
};

export type TemplateLayout = {
  backdropInsetX: number;
  backdropInsetY: number;
  backdropRadius: number;
  slotLeft: number;
  slotTop: number;
  slotWidth: number;
  slotHeight: number;
  slotGap: number;
  watermarkWidth: number;
  watermarkBottom: number;
};

const OUTPUT_WIDTH = 483;
const OUTPUT_HEIGHT = 1376;

// Photo slots are much wider than the captured portrait photo, so most of its height
// gets cropped away. Anchoring near the top (0 = top, 0.5 = center, 1 = bottom) keeps
// foreheads/hair in frame instead of centering and risking a cut-off forehead.
const DEFAULT_PHOTO_VERTICAL_ANCHOR = 0.3;
const DEFAULT_TOY_STORY_OVERSCAN = 1.08;

// Per-template tuning, set via the /admin layout tool. Falls back to the shared
// defaults below when a template has no entry of its own.
const PHOTO_OVERSCAN_BY_TEMPLATE: Partial<Record<string, number>> = {
  toystory1: 1,
  toystory2: 1,
  toystory3: 1,
};

const VERTICAL_ANCHOR_BY_TEMPLATE: Partial<Record<string, number>> = {
  toystory1: 0.34,
  toystory2: 0.46,
  toystory3: 0.3,
};

export function isToyStoryTemplateId(templateId: string): boolean {
  return templateId === "toystory1" || templateId === "toystory2" || templateId === "toystory3";
}

export function getDefaultPhotoOverscan(templateId: string): number {
  return PHOTO_OVERSCAN_BY_TEMPLATE[templateId]
    ?? (isToyStoryTemplateId(templateId) ? DEFAULT_TOY_STORY_OVERSCAN : 1);
}

export function getDefaultVerticalAnchor(templateId: string): number {
  return VERTICAL_ANCHOR_BY_TEMPLATE[templateId] ?? DEFAULT_PHOTO_VERTICAL_ANCHOR;
}

export function getTemplateLayout(templateId: string): TemplateLayout {
  if (templateId === "signature") {
    return {
      backdropInsetX: 12,
      backdropInsetY: 12,
      backdropRadius: 18,
      slotLeft: 57,
      slotTop: 168,
      slotWidth: 369,
      slotHeight: 234,
      slotGap: 5,
      watermarkWidth: 96,
      watermarkBottom: 22,
    };
  }

  // toy-story-blue.png: 537px wide → scale 0.899 to 483px canvas
  // slot cutout measured directly from the PNG's alpha channel: native x=[79,448), y=[166,400)
  // slotTop nudged to 169 via /admin tuning.
  if (templateId === "toystory1") {
    return {
      backdropInsetX: 0,
      backdropInsetY: 0,
      backdropRadius: 0,
      slotLeft: 71,
      slotTop: 169,
      slotWidth: 332,
      slotHeight: 234,
      slotGap: 5,
      watermarkWidth: 0,
      watermarkBottom: 0,
    };
  }

  // toy-story-green.png: 501px wide → scale 0.964 to 483px canvas
  if (templateId === "toystory2") {
    return {
      backdropInsetX: 0,
      backdropInsetY: 0,
      backdropRadius: 0,
      slotLeft: 60,
      slotTop: 168,
      slotWidth: 369,
      slotHeight: 234,
      slotGap: 5,
      watermarkWidth: 0,
      watermarkBottom: 0,
    };
  }

  // toy-story-skyblue.png: 543px wide → scale 0.890 to 483px canvas
  // slot cutout measured directly from the PNG's alpha channel: native x=[89,458), y=[166,400)
  // slotHeight/slotGap adjusted via /admin tuning.
  if (templateId === "toystory3") {
    return {
      backdropInsetX: 0,
      backdropInsetY: 0,
      backdropRadius: 0,
      slotLeft: 79,
      slotTop: 166,
      slotWidth: 328,
      slotHeight: 237,
      slotGap: 0,
      watermarkWidth: 0,
      watermarkBottom: 0,
    };
  }

  // Matches the toy story frames' photo slot position/size per request.
  if (templateId === "sprinkle") {
    return {
      backdropInsetX: 0,
      backdropInsetY: 0,
      backdropRadius: 0,
      slotLeft: 71,
      slotTop: 165,
      slotWidth: 332,
      slotHeight: 234,
      slotGap: 5,
      watermarkWidth: 96,
      watermarkBottom: 22,
    };
  }

  if (templateId === "soccer") {
    return {
      backdropInsetX: 0,
      backdropInsetY: 0,
      backdropRadius: 0,
      slotLeft: 57,
      slotTop: 168,
      slotWidth: 369,
      slotHeight: 234,
      slotGap: 5,
      watermarkWidth: 0,
      watermarkBottom: 0,
    };
  }

  return {
    backdropInsetX: 0,
    backdropInsetY: 0,
    backdropRadius: 0,
    slotLeft: 57,
    slotTop: 168,
    slotWidth: 369,
    slotHeight: 234,
    slotGap: 5,
    watermarkWidth: 96,
    watermarkBottom: 22,
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
  verticalAnchor = 0.5,
) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y - (drawHeight - height) * verticalAnchor;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, value));
}

function rotateHue(r: number, g: number, b: number, degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    r:
      (0.213 + cos * 0.787 - sin * 0.213) * r
      + (0.715 - cos * 0.715 - sin * 0.715) * g
      + (0.072 - cos * 0.072 + sin * 0.928) * b,
    g:
      (0.213 - cos * 0.213 + sin * 0.143) * r
      + (0.715 + cos * 0.285 + sin * 0.14) * g
      + (0.072 - cos * 0.072 - sin * 0.283) * b,
    b:
      (0.213 - cos * 0.213 - sin * 0.787) * r
      + (0.715 - cos * 0.715 + sin * 0.715) * g
      + (0.072 + cos * 0.928 + sin * 0.072) * b,
  };
}

function applyFilterAdjustments(
  imageData: ImageData,
  adjustments: FilterConfig["adjustments"],
) {
  const {
    brightness = 1,
    saturation = 1,
    contrast = 1,
    hueRotate = 0,
    grayscale = 0,
  } = adjustments;
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (brightness !== 1) {
      r *= brightness;
      g *= brightness;
      b *= brightness;
    }

    if (saturation !== 1) {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + (r - luma) * saturation;
      g = luma + (g - luma) * saturation;
      b = luma + (b - luma) * saturation;
    }

    if (hueRotate !== 0) {
      const rotated = rotateHue(r, g, b, hueRotate);
      r = rotated.r;
      g = rotated.g;
      b = rotated.b;
    }

    if (grayscale > 0) {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = r * (1 - grayscale) + luma * grayscale;
      g = g * (1 - grayscale) + luma * grayscale;
      b = b * (1 - grayscale) + luma * grayscale;
    }

    if (contrast !== 1) {
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
    }

    data[i] = clampChannel(r);
    data[i + 1] = clampChannel(g);
    data[i + 2] = clampChannel(b);
  }
}

function drawFilteredCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  filter: FilterConfig,
  verticalAnchor = 0.5,
) {
  const buffer = document.createElement("canvas");
  buffer.width = width;
  buffer.height = height;
  const bufferCtx = buffer.getContext("2d", { willReadFrequently: true });
  if (!bufferCtx) {
    drawCover(ctx, image, x, y, width, height, verticalAnchor);
    return;
  }

  drawCover(bufferCtx, image, 0, 0, width, height, verticalAnchor);

  if (filter.id !== "none") {
    try {
      const imageData = bufferCtx.getImageData(0, 0, width, height);
      applyFilterAdjustments(imageData, filter.adjustments);
      bufferCtx.putImageData(imageData, 0, 0);
    } catch {
      // Some mobile browsers block getImageData (canvas taint / privacy restrictions).
      // Fall through — buffer already holds the unfiltered image.
    }
  }

  ctx.drawImage(buffer, x, y, width, height);
}

export async function renderPhotoboothImage(options: RenderOptions): Promise<Blob> {
  const width = options.width ?? OUTPUT_WIDTH;
  const height = options.height ?? OUTPUT_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");

  const scaleX = width / OUTPUT_WIDTH;
  const scaleY = height / OUTPUT_HEIGHT;
  const layout = { ...getTemplateLayout(options.template.id), ...options.layoutOverride };

  if (options.template.background !== "transparent") {
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
  }

  const slot = {
    left: Math.round(layout.slotLeft * scaleX),
    top: Math.round(layout.slotTop * scaleY),
    width: Math.round(layout.slotWidth * scaleX),
    height: Math.round(layout.slotHeight * scaleY),
    gap: Math.round(layout.slotGap * scaleY),
  };

  // Toy Story frames are transparent die-cuts overlaid on top of the photo; the cutout
  // edges can't be measured with perfect pixel precision, so the photo is drawn slightly
  // larger than its slot (same center) to guarantee it reaches every edge of the cutout.
  // The overscanned edges are hidden under the opaque frame artwork on top.
  const photoOverscan = options.photoOverscanOverride ?? getDefaultPhotoOverscan(options.template.id);
  const verticalAnchor = options.verticalAnchorOverride ?? getDefaultVerticalAnchor(options.template.id);

  for (let i = 0; i < 4; i += 1) {
    const photo = options.photos[i];
    const y = slot.top + i * (slot.height + slot.gap);
    const photoWidth = slot.width * photoOverscan;
    const photoHeight = slot.height * photoOverscan;
    const photoLeft = slot.left - (photoWidth - slot.width) / 2;
    const photoTop = y - (photoHeight - slot.height) / 2;

    ctx.fillStyle = "#f4f0ea";
    ctx.fillRect(slot.left, y, slot.width, slot.height);

    if (photo) {
      ctx.save();
      try {
        const image = await loadImageFromBlob(photo);
        ctx.beginPath();
        ctx.rect(photoLeft, photoTop, photoWidth, photoHeight);
        ctx.clip();
        drawFilteredCover(
          ctx,
          image,
          photoLeft,
          photoTop,
          photoWidth,
          photoHeight,
          options.filter,
          verticalAnchor,
        );
      } catch {
        ctx.fillStyle = "#DDD";
        ctx.fillRect(slot.left, y, slot.width, slot.height);
      } finally {
        ctx.restore();
      }
    }

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = Math.max(2, Math.round(3 * scaleX));
    ctx.strokeRect(slot.left, y, slot.width, slot.height);
  }

  if (options.template.frameOverlay) {
    try {
      const frameImage = await loadImage(options.template.frameSrc);
      // Frame art has hard-edged (non-antialiased) cutouts, including irregular shapes
      // like the scalloped Toy Story 2 slot. Bilinear smoothing during the downscale to
      // canvas size blurs those cutout edges into semi-transparent fringes that visibly
      // mismatch the photo's straight rectangular crop underneath, so it's disabled here.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frameImage, 0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
    } catch {
      // frame overlay load failed — skip silently
    }
  }

  for (const sticker of options.stickers) {
    const stickerWidth = sticker.scale * width;
    const stickerX = sticker.x * width;
    const stickerY = sticker.y * height;

    try {
      const image = await loadImage(sticker.src);
      const imageWidth = image.naturalWidth || image.width || 1;
      const imageHeight = image.naturalHeight || image.height || 1;
      const stickerHeight = stickerWidth * (imageHeight / imageWidth);

      ctx.save();
      ctx.translate(stickerX, stickerY);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.drawImage(
        image,
        -stickerWidth / 2,
        -stickerHeight / 2,
        stickerWidth,
        stickerHeight,
      );
      ctx.restore();
    } catch {
      ctx.fillStyle = "#ff6aa2";
      ctx.beginPath();
      ctx.arc(stickerX, stickerY, stickerWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (options.textLine.trim()) {
    const fontSize = Math.round(26 * scaleY);
    ctx.font = `700 ${fontSize}px ${options.textFont.cssFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5f2e51";
    ctx.fillText(options.textLine.trim(), width / 2, height - Math.round(18 * scaleY));
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
