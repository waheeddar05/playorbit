# PlayOrbit — UI Design Review

**Date:** February 27, 2026
**Scope:** Full UI/UX audit covering design system, component consistency, UX writing, and accessibility
**Score:** 68/100

---

## Executive Summary

PlayOrbit has a strong visual foundation — the dark glassmorphism theme with cyan accents creates a premium, sports-tech feel that works well for the cricket booking domain. However, the codebase suffers from **inconsistent token usage**, **duplicated constants**, **native browser dialogs for critical flows**, and several **accessibility gaps** that undermine the polished surface. Addressing the high-priority items below would meaningfully improve both user experience and code maintainability.

---

## 1. Design System Audit

### Token Coverage

| Category | Defined Tokens | Hardcoded Values Found | Severity |
|----------|---------------|----------------------|----------|
| Colors | 12 tokens in `globals.css` | 40+ hardcoded hex values across pages | 🔴 High |
| Spacing | None (relies on Tailwind defaults) | Consistent via Tailwind | ✅ OK |
| Typography | 2 font families (Geist Sans/Mono) | Inconsistent size scale usage | 🟡 Medium |
| Borders | 1 token (`--color-border`) | 15+ hardcoded `border-white/[0.08]` etc. | 🟡 Medium |
| Shadows | Custom CSS classes (`shadow-glow`) | Inline shadow values in components | 🟡 Medium |
| Animations | 8 keyframes + utility classes | Some inline transition values | 🟢 Low |

**Key Finding:** The `@theme inline` block defines tokens like `--color-surface`, `--color-card`, `--color-muted`, but components frequently bypass them with raw values like `bg-[#030712]`, `bg-[#0f172a]`, `text-slate-400`, `border-white/10`. This creates a maintenance burden — a theme change would require touching dozens of files.

### Hardcoded Color Hotspots

- **`page.tsx` (landing):** ~25 hardcoded hex values (`#030712`, `#0f172a`, `#1e1b4b`, `#0c1929`, etc.)
- **`login/page.tsx`:** `bg-[#030712]`, inline gradient hex values
- **`Navbar.tsx`:** `bg-[#030712]/95`, `bg-[#030712]/98`
- **`slots/page.tsx`:** `bg-[#0c1929]`, `bg-[#0a1628]`, multiple inline hex colors
- **`bookings/page.tsx`:** `bg-[#0a1628]`, `text-slate-*` throughout

**Recommendation:** Create semantic Tailwind tokens for all recurring values. At minimum, alias `bg-background` for `#030712`, `bg-surface-dark` for `#0a1628`, and use `text-muted` instead of `text-slate-400`/`text-slate-500` interchangeably.

### Duplicated Constants

The following are defined in multiple files rather than shared:

| Constant | Found In | Impact |
|----------|----------|--------|
| `MACHINE_CARDS` (machine names, images, colors) | `slots/page.tsx`, `packages/page.tsx` | Data drift risk |
| Machine label maps (`machineLabels`) | `bookings/page.tsx`, `slots/page.tsx` | Already diverging |
| Pitch type labels | `bookings/page.tsx`, `SlotGrid.tsx` | Inconsistent naming |
| Status color mappings | `bookings/page.tsx`, `SlotGrid.tsx` | Different color choices |

**Recommendation:** Create a shared `src/lib/constants.ts` for all domain enums, label maps, and card data.

---

## 2. Component Completeness

| Component | States Covered | Variants | Reusability | Score |
|-----------|---------------|----------|-------------|-------|
| Toast | ✅ success/error/warning/info | ✅ 4 types | ✅ Context-based | 9/10 |
| EmptyState | ✅ icon/title/desc/action | ✅ Flexible | ✅ Shared component | 8/10 |
| Navbar | ✅ scroll/auth/mobile | ⚠️ No variants | ✅ Layout-level | 7/10 |
| SlotGrid | ✅ 6 status states | ✅ Color-coded | ⚠️ Tightly coupled | 7/10 |
| BookingBar | ✅ Package/discount/free | ⚠️ Fixed layout | ⚠️ Slots-specific | 6/10 |
| MachineSelector | ✅ Selected/unselected | ⚠️ Hardcoded machines | ❌ Not reusable | 5/10 |
| DateSelector | ✅ Today/selected/default | ⚠️ 7-day fixed | ⚠️ Slots-specific | 6/10 |
| Loading states | ⚠️ Inconsistent patterns | ❌ No shared skeleton | ❌ Per-page | 4/10 |
| Error states | ❌ Mostly `alert()` | ❌ No error boundary UI | ❌ None | 3/10 |

### Missing Shared Components

- **Button:** No shared button component — every page styles buttons inline with Tailwind classes, leading to 5+ different button styles.
- **Card:** No shared card component — glassmorphism card styling is repeated with slight variations everywhere.
- **Modal/Dialog:** No shared modal — packages page uses a custom overlay, while other flows use native `confirm()`.
- **Skeleton/Loading:** Each page implements its own loading spinner with slightly different styles.
- **Badge/Pill:** Status badges in bookings and slot grid use different color systems.

---

## 3. UX Writing Review

### Critical Issues

**3.1 Native `alert()` and `confirm()` for critical flows — 🔴 High Priority**

The app uses browser-native dialogs for booking confirmation, cancellation, and payment flows. These are:
- Visually jarring against the polished dark theme
- Non-customizable (can't match brand)
- Inconsistent across browsers/devices
- Blocking (freeze the UI thread)

Instances found:

| Location | Dialog | Copy |
|----------|--------|------|
| `slots/page.tsx` | `confirm()` | "Proceed to pay ₹{amount}..." (long multi-line) |
| `slots/page.tsx` | `alert()` | "Booking confirmed! Check My Bookings." |
| `bookings/page.tsx` | `confirm()` | "Cancel this booking?..." |
| `bookings/page.tsx` | `alert()` | "Booking cancelled successfully" |
| `packages/page.tsx` | `confirm()` | "Purchase {name} for ₹{price}?" |

**Recommendation:** Replace all `alert()`/`confirm()` with a custom `<ConfirmDialog>` component that matches the glassmorphism theme. The Toast system already exists — use it for success confirmations, and build a modal for destructive/payment confirmations.

**3.2 Error Message Quality — 🟡 Medium**

| Current Copy | Issue | Suggested |
|-------------|-------|-----------|
| "Failed to load slots" | Generic, no guidance | "Couldn't load available slots. Pull to refresh or try again in a moment." |
| "Failed to sign in. Please try again." | No specificity | "Sign-in didn't go through — check your connection and try again." |
| "Something went wrong" | Vague (used in multiple places) | Contextual: "Couldn't complete your booking. Your payment was not charged." |
| "Failed to load bookings" | Generic | "We couldn't fetch your bookings right now. Tap to retry." |

**3.3 Empty State Copy — 🟢 Good, Minor Tweaks**

The `EmptyState` component is well-structured. Current copy is functional but could be warmer:

| Current | Suggested |
|---------|-----------|
| "No bookings yet" | "No bookings yet — ready to hit the nets?" |
| "No slots available" | "No slots open for this date. Try another day or machine." |
| "Select a machine to see available slots" | ✅ Good as-is |

**3.4 CTA Button Labels — 🟡 Medium**

| Current | Context | Suggested |
|---------|---------|-----------|
| "Confirm Booking" | Bottom bar CTA | "Book {n} Slot{s} · ₹{amount}" (show what they're committing to) |
| "Buy Package" | Package purchase | "Get This Package" (softer, benefit-oriented) |
| "Cancel Booking" | Destructive action | "Cancel This Booking" (more explicit) |
| "Login" | Nav + mobile menu | "Sign In" (matches Google OAuth language) |

---

## 4. Visual & Interaction Issues

### 4.1 Logo Rendering — `mix-blend-screen`

Both the Navbar and Login page use `mix-blend-screen` on the logo image. This only works correctly on dark backgrounds — if any component renders over a lighter surface, the logo will appear washed out. Consider using a transparent PNG instead and removing the blend mode.

### 4.2 Inconsistent Border Radius Scale

| Component | Radius Used |
|-----------|------------|
| Login card | `rounded-2xl` (16px) |
| Slot cards | `rounded-xl` (12px) |
| Machine cards | `rounded-2xl` (16px) |
| Booking cards | `rounded-2xl` (16px) |
| Nav links | `rounded-lg` (8px) |
| Date pills | `rounded-xl` (12px) |
| Buttons | Mix of `rounded-lg` and `rounded-xl` |

Not dramatically inconsistent, but formalizing a scale (e.g., cards = `2xl`, interactive elements = `xl`, small pills = `lg`) would improve cohesion.

### 4.3 Touch Target Sizes

Several interactive elements are below the 44×44px minimum recommended for mobile:

- Date selector pills: `px-3 py-2` (~36px height)
- Nav links on mobile: `py-3` is good, but desktop `py-2` is tight
- Slot grid cards: adequate touch area ✅
- Machine selector cards: adequate ✅

### 4.4 Scroll Behavior on Slots Page

The slots page has a complex stacking of sticky elements (Navbar sticky top + options panel + BookingBar fixed bottom). On small screens this could leave very little viewport for actual slot content. Consider collapsing the options panel or making it a slide-out drawer on mobile.

---

## 5. Accessibility Concerns

### 5.1 Viewport Zoom Disabled — 🔴 Critical

```tsx
// layout.tsx
maximumScale: 1,
userScalable: false,
```

This prevents users from pinching to zoom, which is a **WCAG 2.1 AA failure** (Success Criterion 1.4.4). Users with low vision rely on zoom. Remove these restrictions.

### 5.2 Color Contrast Issues

| Element | Foreground | Background | Ratio (est.) | Required |
|---------|-----------|------------|-------------|----------|
| `text-slate-500` on `#030712` | `#64748b` | `#030712` | ~3.8:1 | 4.5:1 ❌ |
| `text-white/60` (nav username) | `rgba(255,255,255,0.6)` | Dark bg | ~4.2:1 | 4.5:1 ❌ |
| `text-white/70` (nav links) | `rgba(255,255,255,0.7)` | Dark bg | ~5.1:1 | 4.5:1 ✅ |
| `text-slate-400` (subtitles) | `#94a3b8` | `#030712` | ~5.5:1 | 4.5:1 ✅ |
| `text-accent` on dark bg | `#38bdf8` | `#030712` | ~7.2:1 | 4.5:1 ✅ |

**Fix:** Bump `text-slate-500` usages to `text-slate-400`, and `text-white/60` to `text-white/70` minimum.

### 5.3 Missing ARIA Attributes

- Mobile menu toggle: No `aria-expanded`, no `aria-label`
- Slot cards: No `role="button"` or `aria-label` describing the slot
- Machine selector: No `role="radiogroup"` / `role="radio"` semantics
- Date selector: No `role="listbox"` / `role="option"` semantics
- Toast notifications: Has `role="alert"` ✅

### 5.4 Keyboard Navigation

- Slot grid items are `<div onClick>` — not keyboard-focusable. Should be `<button>` or have `tabIndex={0}` + `onKeyDown`.
- Machine selector cards: same issue — `<button onClick>` wrapping would fix both.
- Mobile menu: no focus trap when open.

---

## 6. Performance & Mobile UX

### 6.1 Image Optimization

- Login page uses `<img>` instead of Next.js `<Image>` for the logo (with eslint-disable comment). The Navbar uses `<Image>` correctly. Standardize on `<Image>` everywhere for automatic optimization.
- Machine card images in `MachineSelector` use Next.js `<Image>` ✅
- Google OAuth icon loads from external URL (`gstatic.com`) — consider self-hosting for reliability.

### 6.2 Animation Performance

The landing page has multiple simultaneous animations (floating elements, orbiting dots, shimmer text, twinkling stars). On lower-end mobile devices, this could cause jank. Consider:
- Using `will-change: transform` on animated elements
- Reducing animation count on mobile via `prefers-reduced-motion`
- The `@keyframes orbit` with `translateX(100px)` may cause layout shifts

### 6.3 PWA Considerations

The app registers a service worker and has PWA support. The fixed bottom `BookingBar` correctly uses `safe-bottom` for iOS home indicator — good attention to detail.

---

## 7. Priority Action Items

### 🔴 High Priority (Do First)

1. **Replace all `alert()`/`confirm()` with custom modals** — These break the premium UX on every critical flow (booking, payment, cancellation).
2. **Remove `userScalable: false` and `maximumScale: 1`** — Accessibility violation that blocks zoom.
3. **Extract shared constants** — `MACHINE_CARDS`, label maps, status colors into `src/lib/constants.ts` to prevent data drift.

### 🟡 Medium Priority (Next Sprint)

4. **Create shared UI components** — `<Button>`, `<Card>`, `<ConfirmDialog>`, `<Skeleton>` to replace inline styling patterns.
5. **Fix color contrast** — Bump `text-slate-500` → `text-slate-400`, `text-white/60` → `text-white/70`.
6. **Consolidate hardcoded colors** — Replace the 40+ hardcoded hex values with semantic Tailwind tokens.
7. **Add ARIA attributes** — `aria-expanded` on menu, `role` attributes on custom widgets, keyboard support on slot/machine cards.

### 🟢 Low Priority (Polish)

8. **Standardize border-radius scale** — Document and enforce card vs element vs pill radius.
9. **Improve error message copy** — Make messages contextual and actionable.
10. **Add `prefers-reduced-motion`** — Respect user animation preferences on the landing page.
11. **Standardize on Next.js `<Image>`** — Replace remaining `<img>` tags.

---

## Design System Score Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| Token Definition | 7/10 | Good foundation, poor adoption |
| Token Usage Consistency | 4/10 | Heavy hardcoding throughout |
| Component Reusability | 5/10 | Toast & EmptyState good; missing Button, Card, Modal |
| Naming Consistency | 6/10 | Mostly conventional, some drift |
| UX Copy Quality | 5/10 | Functional but generic; native dialogs hurt |
| Accessibility | 4/10 | Zoom disabled, contrast issues, missing ARIA |
| Visual Consistency | 7/10 | Strong theme, minor radius/color inconsistencies |
| Mobile UX | 7/10 | Good responsive design, safe-area support |
| **Overall** | **68/100** | Strong visual base, needs system discipline |
