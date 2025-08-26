# Quran & Sunnah

One clean place for **Quran**, **Hadith**, and **Prayer** — free for everyone.

> Tech: Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Framer Motion

---

## ✨ Features (current)

- **Landing** page with mission and verses cloud
- **Quran**
  - Surah index (search by name/number)
  - Reader page (mock ayat for now), font size & translation toggle
- **Hadith**
  - Six Books index (placeholders for collections)
- **Prayer**
  - Next prayer (live countdown)
  - Full daily times (incl. **Sunrise**)
  - **Qibla** bearing with simple compass (+ device heading where available)
  - “Use my location” geolocation
- **Global UI**
  - Centered “island” navigation (Quran / Hadith / Prayer)
  - Top-right: Search, Settings, Account (hidden on landing)
  - Dark/light theme (system default)
- **Settings**
  - Theme (Auto/Light/Dark)
  - Quran font preset & font size slider
  - Word-by-Word toggles (placeholders)
- **Account**
  - Local profile (name, email, avatar) saved to `localStorage`
- **Search**
  - Quick search across Surahs + Hadith collections

---

## 🚀 Quickstart

```bash
# install dependencies
npm install

# run dev server
npm run dev

# build for production
npm run build

# run the built app
npm start
