# Latent Vault — UI Audit & Redesign Report

**Date:** 2026-09-10
**Scope:** Full visual audit of the Latent Vault streaming archive interface
**Goal:** Transform from functional editorial design → premium, minimal, professional UI

---

## Executive Summary

The current design has a solid editorial foundation (Fraunces serif, dark warm palette, restrained amber accent) but suffers from **sharp geometry, cramped spacing, and inconsistent polish** that makes it feel more like a prototype than a premium streaming product. The redesign focuses on **softness, breathing room, refined hierarchy, and micro-interactions**.

---

## 1. Critical Issues (Must Fix)

### 1.1 Sharp 2px Border-Radius Everywhere
- **Problem:** All buttons, chips, inputs, and cards use `border-radius: 2px` — this reads as unfinished/crude
- **Impact:** Every interactive element feels harsh and unfriendly
- **Fix:** Introduce a tiered radius system: `--radius-xs: 6px`, `--radius-sm: 10px`, `--radius: 16px`, `--radius-lg: 24px`

### 1.2 `gap: 1px` Grid Dividers
- **Problem:** Episode grids use `gap: 1px` with `background: var(--line)` to create 1px dividers between cards
- **Impact:** Looks like a spreadsheet/table, not a premium card grid
- **Fix:** Use proper gaps (8-12px) with subtle card backgrounds or soft borders

### 1.3 Undersized Typography
- **Problem:** Multiple elements at 9px, 9.5px, 10px font sizes — below legibility thresholds
- **Impact:** Labels, badges, and metadata become invisible on standard displays
- **Fix:** Minimum 11px for any visible text, 12px preferred for body-adjacent labels

### 1.4 Inline Styles in Components
- **Problem:** `ContinueWatching.tsx:26` uses inline `style={{ fontSize: ..., fontWeight: ... }}`
- **Impact:** Breaks design system, hard to maintain, inconsistent
- **Fix:** Move to CSS classes

### 1.5 Mobile Tab Bar Limited to `pointer: coarse`
- **Problem:** Tab bar only shows on touch devices (`@media (pointer: coarse)`)
- **Impact:** iPad with Apple Pencil, Surface tablets, and other hybrid devices lose navigation
- **Fix:** Use viewport-based breakpoint instead

---

## 2. Visual Design Problems (Cheap/Unpolished)

### 2.1 Editorial Break Section
- **Problem:** The quote interlude between Season 2 and Bonus sections feels forced and visually cluttered
- **Impact:** Breaks the browsing flow, adds noise
- **Fix:** Simplify to a single elegant typographic divider or remove entirely

### 2.2 Search Hints/Chips
- **Problem:** Sharp 2px borders on search hint buttons look like a wireframe
- **Impact:** Feels like a form, not a discovery experience
- **Fix:** Rounded pill shapes, softer colors, subtle hover transitions

### 2.3 Unavailable Episode Panel
- **Problem:** Plain `border: 1px solid` box with centered text — no visual hierarchy
- **Impact:** Feels like an error page, not a graceful "coming soon"
- **Fix:** Add gradient background, subtle illustration, or more considered typography

### 2.4 Previous/Next Navigation
- **Problem:** Split 50/50 grid with 1px divider — feels utilitarian
- **Impact:** Undermines the editorial quality of the watch page
- **Fix:** Softer cards with proper padding, subtle background difference, rounded corners

### 2.5 Footer Layout
- **Problem:** Three-column grid with minimal spacing, small text
- **Impact:** Feels cramped, not like a premium site footer
- **Fix:** More generous spacing, larger brand presence, refined column widths

### 2.6 Watch Page Title Block
- **Problem:** Chips row is dense and uniform — no visual hierarchy between important and secondary info
- **Impact:** Hard to scan, feels cluttered
- **Fix:** Group related info, use size/color to differentiate primary vs secondary metadata

### 2.7 Hero Section
- **Problem:** The `aspect-ratio: 16/7` creates a very tall hero that may not work on smaller screens
- **Impact:** On mobile, the hero takes up most of the viewport with limited content
- **Fix:** More responsive aspect ratios, better mobile scaling

---

## 3. Missing Premium Features

### 3.1 No Page Transition Animations
- **Observation:** Only `fadeUp` animation exists, applied once on hero
- **Recommendation:** Add subtle page transitions, staggered card reveals, smooth scroll-linked effects

### 3.2 No Hover State Refinement
- **Observation:** Most hover states just change color slightly
- **Recommendation:** Add subtle lift, shadow, or scale transforms on cards

### 3.3 No Loading States
- **Observation:** No skeleton loaders or shimmer effects for content
- **Recommendation:** Add skeleton states for cards and images

### 3.4 No Scroll Progress Indicator
- **Observation:** Long pages have no scroll feedback
- **Recommendation:** Subtle scroll progress bar at top of page

### 3.5 No Image Lazy Load Placeholders
- **Observation:** Images just pop in when loaded
- **Recommendation:** Add blur-up or dominant color placeholders

---

## 4. Component-Specific Issues

| Component | Issue | Severity |
|-----------|-------|----------|
| `Header.tsx` | Brand mark at 32px feels small for the masthead | Medium |
| `Header.tsx` | Search input has 13px font — too small | Medium |
| `Hero.tsx` | Hero title at `clamp(2rem, 5.5vw, 4.4rem)` is good but guests text is weak | Low |
| `EpisodeCard.tsx` | Card body padding (14px 16px 18px) is tight | Medium |
| `EpisodeCard.tsx` | Play overlay button at 48px is small for touch | Medium |
| `Footer.tsx` | Brand name uses `footer-name` class but CSS targets `footer-brand-name` | High (Bug) |
| `ContinueWatching.tsx` | Inline styles bypass design system | Medium |
| `SearchExperience.tsx` | Empty state uses `tips` class but CSS defines no `.tips` styles | Medium |
| `WatchView.tsx` | Source note styling is very plain | Low |
| `MobileTabBar.tsx` | Icons are 21px — slightly oversized for tab bar | Low |

---

## 5. CSS Architecture Issues

### 5.1 Variable Naming Inconsistency
- Some variables use `--text-2`, `--text-3` (opacity-based names)
- Others use `--muted`, `--paper` (semantic names)
- Player CSS uses raw `rgba()` instead of CSS variables

### 5.2 Redundant Variables
- `--paper`, `--paper-dim`, `--muted`, `--gold-*` are "kept for player.css compatibility" but create confusion
- Should consolidate into a single token system

### 5.3 Missing Dark Mode Tokens
- The site is always dark, but uses hardcoded `rgba(14,13,11,...)` in many places instead of `var(--bg)` or `var(--bg-1)`
- Makes future theming impossible

### 5.4 No Consistent Easing Curve
- Uses both `--ease` and `--ease-spring` but applies them inconsistently
- Some transitions use `0.18s`, others `0.22s`, others `0.28s`

---

## 6. Redesign Decisions

### Color Palette (Refined)
```
--bg:       #0c0b09     (deeper, richer black)
--bg-1:     #12110e     (card surface)
--bg-2:     #1a1814     (elevated surface)
--bg-3:     #22201a     (highest elevation)
--text:     #f0ece4     (primary text — warmer white)
--text-2:   #a09688     (secondary text)
--text-3:   #6b6058     (tertiary text)
--accent:   #c9a84c     (refined gold — less orange)
--border:   rgba(240,236,228,0.08)
```

### Border Radius System
```
--radius-xs:  6px    (badges, small elements)
--radius-sm:  10px   (buttons, inputs, small cards)
--radius:     16px   (cards, panels)
--radius-lg:  24px   (hero, large surfaces)
```

### Spacing Scale
```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  24px
--space-6:  32px
--space-7:  48px
--space-8:  64px
```

### Typography Scale
```
--text-xs:    11px    (badges, labels)
--text-sm:    13px    (captions, secondary)
--text-base:  15px    (body)
--text-lg:    18px    (subheadings)
--text-xl:    24px    (section titles)
--text-2xl:   32px    (page titles)
--text-3xl:   48px    (hero titles)
```

### Animation Timing
```
--duration-fast:   120ms
--duration-normal: 220ms
--duration-slow:   400ms
```

---

## 7. Implementation Priority

| Phase | Changes | Impact |
|-------|---------|--------|
| **Phase 1** | CSS variables, radius system, spacing, typography | High — instant visual improvement |
| **Phase 2** | Grid/card redesign, remove `gap: 1px` pattern | High — transforms browsing experience |
| **Phase 3** | Component fixes (inline styles, footer bug, search) | Medium — polish and consistency |
| **Phase 4** | Animations, transitions, hover states | Medium — premium feel |
| **Phase 5** | Loading states, scroll effects, image placeholders | Low — nice-to-have enhancements |

---

*Report generated by UI audit. Redesign implementation follows.*
