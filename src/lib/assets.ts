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
    background: "#D75A8E",
  },
  {
    id: "sprinkle",
    name: "Sprinkle Pop",
    description: "Bright pop colors for playful campaign shots.",
    frameSrc: "/frames/sprinkle.png",
    background: "#C03DCC",
  },
  {
    id: "minimal",
    name: "Minimal Mood",
    description: "Simple clean style that keeps faces in focus.",
    frameSrc: "/frames/minimal.png",
    background: "#74668C",
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

const STICKER_FILES = [
  "pineapple.png",
  "sticker1.png",
  "sticker2.png",
  "sticker3.png",
  "sticker4.png",
  "sticker5.png",
  "sticker6.png",
  "sticker7.png",
  "sticker8.png",
  "sticker9.png",
  "sticker10.png",
  "sticker11.png",
  "sticker12.png",
  "sticker13.png",
  "sticker14.png",
  "sticker15.png",
  "sticker16.png",
  "sticker17.png",
  "sticker18.png",
] as const;

export const STICKER_ASSETS = STICKER_FILES.map((fileName) => `/stickers/${fileName}`);

export const DEFAULT_CAPTION = `Sweet moments in every cut
#SweetMoment #ShareTheJoy`;
