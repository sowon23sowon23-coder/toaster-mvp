export type TemplateId = "signature" | "sprinkle" | "minimal";
export type FilterId = "none" | "soft" | "vivid" | "cool" | "mono";
export type FontId = "sans" | "serif" | "mono";

export type TemplateConfig = {
  id: TemplateId;
  name: string;
  description: string;
  frameSrc: string;
  background: string;
};

export type FilterConfig = {
  id: FilterId;
  name: string;
  canvasFilter: string;
};

export type FontConfig = {
  id: FontId;
  name: string;
  cssFamily: string;
};

export const TEMPLATES: TemplateConfig[] = [
  {
    id: "signature",
    name: "Signature Cream",
    description: "Warm and creamy look with a classic signature mood.",
    frameSrc: "/frames/signature.png",
    background: "#FFFFFF",
  },
  {
    id: "sprinkle",
    name: "Sprinkle Pop",
    description: "Bright pop colors for playful campaign shots.",
    frameSrc: "/frames/sprinkle.png",
    background: "#FFF2FA",
  },
  {
    id: "minimal",
    name: "Minimal Mood",
    description: "Simple clean style that keeps faces in focus.",
    frameSrc: "/frames/minimal.png",
    background: "#FFFFFF",
  },
];

export const FILTERS: FilterConfig[] = [
  { id: "none", name: "Original", canvasFilter: "none" },
  { id: "soft", name: "Soft Cream", canvasFilter: "brightness(1.06) saturate(0.9) contrast(0.94)" },
  { id: "vivid", name: "Pop Berry", canvasFilter: "brightness(1.04) saturate(1.22) contrast(1.08)" },
  { id: "cool", name: "Mint Cool", canvasFilter: "brightness(1.02) saturate(0.85) hue-rotate(8deg)" },
  { id: "mono", name: "Classic Mono", canvasFilter: "grayscale(1) contrast(1.06)" },
];

export const FONTS: FontConfig[] = [
  { id: "sans", name: "Clean Sans", cssFamily: "'Trebuchet MS', 'Avenir Next', Arial, sans-serif" },
  { id: "serif", name: "Sweet Serif", cssFamily: "Georgia, 'Times New Roman', serif" },
  { id: "mono", name: "Booth Mono", cssFamily: "'Courier New', Courier, monospace" },
];

export const STICKER_ASSETS = [
  ...Array.from({ length: 12 }, (_, i) => {
    const value = String(i + 1).padStart(2, "0");
    return `/stickers/sticker-${value}.png`;
  }),
  "/pineapple.png",
];

export const DEFAULT_CAPTION = `Sweet moments in every cut
#SweetMoment #ShareTheJoy`;
