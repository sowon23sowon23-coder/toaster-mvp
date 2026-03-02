# Yogurtland Sweet Moment Photo Booth (MVP)

Mobile-first photobooth campaign app built with React + Vite + TypeScript.

## Features
- Full flow: Landing -> Template Select -> Camera (4 shots) -> Edit -> Preview
- Client-only rendering (no server)
- 1080x1350 PNG export for Instagram feed
- Edit tools:
  - 5 filters
  - 12 sticker placeholders (drag + scale + delete)
  - 1-line text (max 30 chars, 3 font options)
- Caption copy with Clipboard API fallback
- Analytics stubs in console:
  - `start_clicked`
  - `template_selected`
  - `capture_completed`
  - `download_clicked`
  - `caption_copied`

## Run
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
npm run preview
```

## Project Structure
```text
src/
  components/
    Button.tsx
    Header.tsx
    StickerCanvasOverlay.tsx
    Tabs.tsx
    TemplateCard.tsx
  lib/
    analytics.ts
    assets.ts
    camera.ts
    canvasRender.ts
  pages/
    Capture.tsx
    Edit.tsx
    Landing.tsx
    Preview.tsx
    Templates.tsx
  store/
    usePhotoboothStore.ts
  App.tsx
  main.tsx
  styles.css
public/
  brand/
    logo_placeholder.png
    yogurtland_mark.png
  frames/
    signature.png
    sprinkle.png
    minimal.png
  stickers/
    sticker-01.png ... sticker-12.png
```

## Real Asset Replacement
Replace placeholder assets with production assets:
- `/public/frames/signature.png`
- `/public/frames/sprinkle.png`
- `/public/frames/minimal.png`
- `/public/stickers/*.png`
- `/public/brand/logo_placeholder.png`
- `/public/brand/yogurtland_mark.png`

Expected frame size: `1080x1350` transparent PNG.

## iOS Safari Notes
- Camera requires HTTPS or localhost.
- User gesture may be required before camera playback on some iOS versions.
- Clipboard API may be restricted in private mode; fallback uses `execCommand`.
- `ctx.filter` support can vary by iOS version; filters are implemented with Canvas 2D filter and may render slightly differently by browser.

## MVP Scope Notes
- No backend persistence.
- All state is in-memory (Zustand).
- Export is always generated client-side via offscreen canvas.
