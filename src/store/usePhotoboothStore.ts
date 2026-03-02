import { create } from "zustand";
import { DEFAULT_CAPTION, FilterId, FontId, TemplateId } from "../lib/assets";

export type StickerItem = {
  id: string;
  src: string;
  x: number;
  y: number;
  scale: number;
};

type PhotoboothState = {
  selectedTemplateId: TemplateId | null;
  photos: Blob[];
  selectedFilterId: FilterId;
  stickers: StickerItem[];
  textLine: string;
  textFont: FontId;
  caption: string;
  setTemplate: (id: TemplateId) => void;
  setPhotos: (photos: Blob[]) => void;
  resetPhotos: () => void;
  setFilter: (filterId: FilterId) => void;
  addSticker: (src: string) => void;
  moveSticker: (id: string, x: number, y: number) => void;
  scaleSticker: (id: string, scale: number) => void;
  removeSticker: (id: string) => void;
  setTextLine: (value: string) => void;
  setTextFont: (value: FontId) => void;
  setCaption: (value: string) => void;
  resetEdit: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const usePhotoboothStore = create<PhotoboothState>((set) => ({
  selectedTemplateId: null,
  photos: [],
  selectedFilterId: "none",
  stickers: [],
  textLine: "",
  textFont: "sans",
  caption: DEFAULT_CAPTION,
  setTemplate: (id) => set({ selectedTemplateId: id }),
  setPhotos: (photos) => set({ photos }),
  resetPhotos: () => set({ photos: [] }),
  setFilter: (selectedFilterId) => set({ selectedFilterId }),
  addSticker: (src) =>
    set((state) => ({
      stickers: [
        ...state.stickers,
        {
          id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          src,
          x: 0.5,
          y: 0.46,
          scale: 0.18,
        },
      ],
    })),
  moveSticker: (id, x, y) =>
    set((state) => ({
      stickers: state.stickers.map((sticker) =>
        sticker.id === id
          ? { ...sticker, x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95) }
          : sticker,
      ),
    })),
  scaleSticker: (id, scale) =>
    set((state) => ({
      stickers: state.stickers.map((sticker) =>
        sticker.id === id ? { ...sticker, scale: clamp(scale, 0.08, 0.42) } : sticker,
      ),
    })),
  removeSticker: (id) =>
    set((state) => ({
      stickers: state.stickers.filter((sticker) => sticker.id !== id),
    })),
  setTextLine: (textLine) => set({ textLine: textLine.slice(0, 30) }),
  setTextFont: (textFont) => set({ textFont }),
  setCaption: (caption) => set({ caption }),
  resetEdit: () =>
    set({
      selectedFilterId: "none",
      stickers: [],
      textLine: "",
      textFont: "sans",
    }),
}));
