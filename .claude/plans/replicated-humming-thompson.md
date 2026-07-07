# Context: UI ni "Wow" darajasiga ko'tarish va mobile fix

## Mobile "qotish" muammosi sabablari
1. `body::before` — `inset: -30%` + `blur(80px)` + `aurora-dance` animatsiyasi → **GPU overdraw** (telefonlarda lag)
2. `body::after` — SVG turbulence (`fractalNoise`) + `mix-blend-mode: overlay` → **rendering qotishi**
3. Bir nechta `backdrop-filter: blur()` qatlamlari → **GPU tezligi pasayishi**
4. `body::before` opacity 0.65 (dark mode) → qorong'i joylarda ko'proq resource

## UI "Wow" qilish uchun o'zgarishlar

### 1. globals.css — Mobile perf va vizual yangilanish
- **Mobile uchun heavy effektlarni o'chirish**: 
  - `@media (max-width: 767px)` da aurora (`body::before`) va grain (`body::after`) to'liq o'chiriladi
  - `backdrop-filter` mobile da minimal darajaga tushiriladi
- **Color palette refinement**: 
  - Dark mode `--background` ni boyroq qilish (24 12% 7% → 24 15% 5%)
  - `--primary` glow effect ni kuchaytirish (42 95% 58% → 42 95% 62%)
  - Shadow'larni premium qilish (qora/oltin aralashmasi)
- **Animatsiyalar**:
  - `aurora-dance` mobil da o'chiriladi
  - `message-slide` animatsiyasi yanada silliqroq `cubic-bezier`
  - Yangi `fade-in`, `scale-in` animatsiyalar
- **Bubble UI**:
  - User bubble: gradient + glow + shadow
  - Assistant bubble: glassmorphism + subtle border glow
- **Yangi utility classlar**:
  - `.presence-dot` — online/offline indikatori
  - `.typing-indicator` — yaxshilangan yozish animatsiyasi
  - `.message-enter` / `.message-exit` — xabar animatsiyalari

### 2. chat-window.tsx — Mobile layout fix
- Input panelni `position: sticky` bilan emas, flex layout bilan mahkamlash
- Messages areani `flex-1 overflow-y-auto` qilish
- iOS `safe-area-inset-bottom` ni to'g'ri ishlatish

### 3. message-bubble.tsx — Mobile UX
- Hover effektlari mobil da umuman ishlamaydi (group-hover o'rniga bosilganda)
- Actions (copy, thumbs) mobil da har doim ko'rinadi (opacity 0.8)
- Touch event'lar uchun `active:` state qo'shish

### 4. theme-toggle.tsx — Soddaroq, lekin zamonaviy
- Dropdown o'rniga inline toggle (3 holat: light/dark/system)
- Mobil da barmoq bilan bosish uchun kattaroq target

## Asosiy o'zgarishlar faqat globals.css da
Eng katta o'zgarishlar globals.css da bo'ladi:
- CSS variables refinement
- Mobile media queries (heavy effektlarni o'chirish)
- Yangi utility classlar
- Animatsiyalarni optimizatsiya qilish
- Bubble styling yangilash
- Scrollbar, selection, focus styling

Boshqa fayllarda kichik o'zgarishlar:
- `chat-window.tsx` — mobile layout tweaks
- `message-bubble.tsx` — mobile touch UX

## Verification
1. `npm run build` — kompilyatsiya xatosi yo'q
2. Telefonda (iOS/Android) chat — lag/qotish yo'q
3. Dark/light mode — hammasi to'g'ri ko'rinadi
4. Uzun matnlar + xabarlar — scrolling silliq
