# InciFact Design System — Botanical Trust & Precision

> Synthesized from OpenDesign (`starbucks` + `apple` design systems).
> Domain: Scientific Cosmetic, Food & Multi-Authority Halal Transparency Scanner (`10` Languages, `TR/EU/US` Regulations, `30,594` CosIng Dictionary).

## 1. Visual Theme & Atmosphere

InciFact pairs botanical clarity with apothecary precision. Warm stone neutrals replace sterile cold grays (`#F2F0EB` page canvas, `#FFFFFF` elevated cards, `#EDEBE9` warm recessed surfaces), anchored by a disciplined four-tier botanical green accent (`#00754A` CTA, `#006241` deep display, `#1E3932` camera surface, `#2FA877` dark-mode luminous CTA) and muted ceremony gold (`#CBA258` / `#D9B972`) reserved strictly for verification crests and framing details.

## 2. Color Palette & Tokens

| Token Role | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| Canvas (`bg`) | `#F2F0EB` | `#091410` | Primary mobile & phone-frame background |
| Outer Studio (`web body`) | `#E9E6DF` | `#060D0A` | Warm studio surround in `public/index.html` |
| Surface (`surface` / `card`) | `#FFFFFF` | `#11221B` | Cards, navigation bars, modals |
| Subtle (`subtle` / `surface2`) | `#EDEBE9` | `#183026` | Nested score heroes, resting chips, quiet wells |
| Border (`border` / `line`) | `#E2DED6` | `#254739` | 1px hairline containment & row dividers |
| Strong Border (`borderStrong`) | `#C9C3B8` | `#34604E` | Hover & selected outline emphasis |
| Primary Ink (`fg` / `text`) | `#14261D` | `#F3EFE6` | Headlines, ingredient names, primary labels |
| Muted Ink (`muted`) | `#52615A` | `#A4B5AC` | Secondary metadata, descriptions |
| Primary Accent (`accent`) | `#00754A` | `#2FA877` | Active tabs, primary CTAs, scan FAB, focus rings |
| Deep Accent (`accentDeep`) | `#006241` | `#34C38B` | High-contrast labels & theme-color meta |
| Accent Soft (`soft`) | `#E4F3EC` | `#0D3526` | Active profile rows, false-positive shield tint |
| Gold Crest (`gold`) | `#CBA258` | `#D9B972` | App icon framing & verification badges only |
| Success (`ok` / `okBg`) | `#0F5132` / `#E4F3EC` | `#6EE7B7` / `#0D3526` | Allowed / Halal OK status |
| Warning (`warn` / `warnBg`) | `#8A5300` / `#FEF4DB` | `#FBBF24` / `#3A270B` | Restricted / Doubtful / OCR confirmation |
| Danger (`bad` / `badBg`) | `#B42318` / `#FDEAEA` | `#FCA5A5` / `#3D1418` | EU Annex II banned / Prohibited / Watchlist alert |
| Info (`info` / `infoBg`) | `#1E3A8A` / `#EFF6FF` | `#93C5FD` / `#172554` | Unknown pregnancy safety / Informational notices |

## 3. Typography, Geometry & Motion

- **Typography:** Figtree / platform sans (`system-ui`, `-apple-system`) for UI + IBM Plex Mono (`ui-monospace`) with `font-variant-numeric: tabular-nums` on every score, fraction, barcode, and counter.
- **Radii:** Full pills (`9999px`) on primary CTAs, filter pills, and status badges; `16px–18px` on cards; `12px–14px` on inner rows, inputs, and 2×2 authority cells.
- **Hierarchy via Surface & Spacing:** Avoid heavy 2px wireframe outlines on resting cards; use 1px hairlines (`border`) and surface contrast (`bg` → `surface` → `subtle`).
- **Tactile Motion:** Explicit transitions (`180ms cubic-bezier(0.23, 1, 0.32, 1)`), subtle press feedback (`scale(0.97)` on Web `:active`, `activeOpacity={0.82}` on React Native), `:focus-visible` outlines on interactive controls, and full `@media (prefers-reduced-motion: reduce)` compliance.

## 4. Accessibility & 10-Language RTL Discipline

- Support all 10 locales (`tr, en, ar [RTL], de, fr, id, ms, es, ru, ur [RTL]`) with dynamic `row-reverse` mirroring, minimum `44px`/`44dp` tap targets, visible keyboard focus rings, and zero hardcoded pastel leaks in dark mode.
