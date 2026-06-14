# F1 Manager UI Design System

This document outlines the core design language, typography, color palette, and component structure for the newly migrated F1 Manager application, codenamed "Championship Hub." 

## 1. Core Philosophy
The new design leverages a sleek, modern **glassmorphism** style, featuring translucent panels over deep, dark backgrounds. The goal is to evoke the feeling of a high-tech telemetry dashboard on an F1 pit wall. 

- **Dark Mode Default:** Reduces eye strain and allows vibrant accent colors to pop.
- **Glassmorphism:** Achieved via low-opacity background colors combined with `backdrop-filter: blur()`.
- **Data-Driven:** Important numbers and statistics are rendered using distinct monospace typography to mimic raw data feeds.

## 2. Color Palette

The interface relies on a strict set of predefined tokens to ensure consistency across every screen:

| Token | Hex Code | Usage |
|-------|----------|-------|
| `HUB.bg` | `#0B0F19` | Main application background (very dark navy/black). |
| `HUB.sidebar` | `#080B12` | Sidebar and fixed navigational elements. |
| `HUB.accent` | `#E10600` | The primary "Racing Red" used for active states, CTA buttons, and highlights. |
| `HUB.textPrimary` | `#FFFFFF` | Standard headings and primary body text. |
| `HUB.textMuted` | `#94A3B8` | Slate gray used for secondary labels, kickers, and inactive elements. |
| `HUB.border` | `rgba(255, 255, 255, 0.05)` | Faint borders used to define the edges of glass panels. |
| `HUB.borderMid` | `rgba(255, 255, 255, 0.1)` | Slightly stronger borders for interactive card outlines. |

## 3. Typography

To separate prose from data, the system utilizes local Formula 1 fonts with a strict hierarchy:

1. **Brand / App Logo & Page Title Font (`'Formula1-Wide', sans-serif`)**
   - Used for the app logo/title, major page titles, hero headings, championship screens, race weekend headers, and landing page headings.
   - **Weights:** `900` / Wide-extended.
   - *Example:* "CHAMPIONSHIP HUB", "APEX RACING"

2. **UI Navigation / Cards / Names / Data Font (`'Formula1-Bold', sans-serif`)**
   - Used for card titles, driver/team names, buttons, navigation items, section headers, statistics, numeric values, table headers, and standings.
   - **Weights:** `700` (Bold).
   - *Example:* `PACE: 85.0`, `$140M`

3. **Body & Helper Text Font (`'Formula1-Regular', sans-serif`)**
   - Used for body text, descriptions, labels, form inputs, helper text, and secondary UI text.
   - **Weights:** `400` (Regular).
   - *Example:* "Select which two drivers will compete in the upcoming race weekend."

### Scale and Hierarchy (Standardized)
- **Page Titles:** `24px` to `28px`, `fontFamily: HUB.fontWide`, uppercase.
- **Subtitles:** `13px`, `fontFamily: HUB.fontRegular`, `#94A3B8`.
- **Stat & Numeric Values:** `20px` to `24px`, `fontFamily: HUB.fontMono` (which maps to Formula1-Bold), `fontVariantNumeric: 'tabular-nums'`, `letterSpacing: '0.03em'`.
- **Card Titles:** `16px` to `18px`, `fontFamily: HUB.fontBold`.
- **Kickers (Eyebrows):** `10px`, uppercase, widely letter-spaced (`0.15em` - `0.3em`), `fontFamily: HUB.fontRegular`.

## 4. Reusable Components (`HubLayout.tsx`)

The design system exports several functional styles to keep layouts DRY:

### `glassCard(extra)`
The fundamental building block of the UI.
- **Background:** `rgba(26, 30, 46, 0.6)`
- **Backdrop Filter:** `blur(12px)`
- **Border:** `1px solid rgba(255, 255, 255, 0.05)`
- **Border Radius:** `16px`

### `actionBtn(extra)`
The primary red interactive button.
- **Background:** `#E10600`
- **Text:** Uppercase, `12px`, letter spacing `0.1em`.
- **Hover/Glow:** Incorporates a subtle red drop-shadow `box-shadow: 0 8px 32px rgba(225, 6, 0, 0.3)`.

### Typography Primitives
- **`sectionLabel(text)`**: Renders a tiny, heavily letter-spaced, red uppercase label.
- **`pageTitle(text)`**: Renders the standard `28px` white bold title.
- **`pageSubtitle(text)`**: Renders the standard `13px` slate-gray description text.
- **`statLabel(text)`** & **`statValue(text)`**: Renders a vertical stack of a label and a monospace numeric value.

## 5. Screen Migration Architecture

The legacy application operated via `.innerHTML` string injection. The new system is fully React-based.

- **`reactRoot.tsx`**: Responsible for mounting isolated full-screen React experiences (like the Landing Page, Auth Portal, and Setup Screen).
- **`mountLayout()`**: Injects sub-screens (like Race Weekend, Market, Office) into the right-hand `main` content area of the `ChampionshipHub` scaffold, preserving the Sidebar and Top Header navigation without full page reloads.

## 6. Layout Scaling Guidelines

To prevent the UI from feeling "enlarged" or unpolished:
- Never exceed `28px` for standard module headings. Reserve `48px` sizes exclusively for isolated, single-focus hero screens (like the initial Landing page).
- Maintain consistent `24px` or `32px` gaps in CSS Grids.
- Driver face avatars should be bound by `40px` (lists), `48px` (cards), or `64px` (hero profiles), with circular clipping (`borderRadius: '50%'`) and `objectFit: 'cover'`.
