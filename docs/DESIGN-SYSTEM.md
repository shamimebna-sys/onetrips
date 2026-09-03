# ONETRIPS Design System

Extracted from `apps/web/app/page.tsx`. Do not invent a new visual language.

## Color

| Token | Hex | Use |
| --- | --- | --- |
| ink | `#0F172A` / `slate-900` | Primary text and primary buttons |
| gold | `#d4af37` | Brand accent, focus rings, hover fills |
| gold-dark | `#996515` | Active tabs, icon color, gradient midpoint |
| muted | `#F0F5FA` | Input fills, page chrome |
| surface | `#FFFFFF` | Page and cards |
| muted text | `slate-400` / `slate-500` | Labels and inactive nav |

Do not use `#C5A059` or `blue-600`.

## Typography

- Font: Inter (`next/font/google`, CSS variable `--font-inter`)
- Headings: `font-black`, uppercase, tight tracking
- Micro labels: `text-[10px]`–`text-[11px]`, `font-black`, `tracking-widest`, uppercase
- Hero: `text-6xl md:text-[100px]`, `leading-[0.8]`

## Radius

- Search shell / large banners: `rounded-[3rem]`
- Cards: `rounded-[45px]` / `rounded-4xl`
- Inputs: `rounded-2xl` / `rounded-3xl`
- Buttons: `rounded-xl` to `rounded-full`

## Motion

- Primary button hover: navy → gold (`hover:bg-[#d4af37]`)
- Cards: slight lift (`hover:-translate-y-2`)
- Frosted nav: `bg-white/90 backdrop-blur-md`

## Shared components (`@onetrips/ui`)

- `BrandLogo`
- `Button`
- `Input`
- `Card`
- `Alert`
- `SearchField`

Home page layout, copy, and search UI stay as designed. New pages must match these tokens.
