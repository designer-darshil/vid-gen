---
version: alpha
name: Veed
description: |
  VEED's design system embraces a modern, energetic aesthetic centered around
  creative media production. The palette is built on high-contrast dark and
  light surfaces — a deep black canvas paired with bright accent color —
  creating a professional yet approachable feel suitable for a video editing
  tool. Typography is clean and geometric, leveraging the Inter family for
  clarity and precision. The dominant accent (#FF5454) conveys energy and calls
  to action, while a soft cream (#FAFAF9) provides readable contrast on brand
  surfaces. The overall impression is tech-forward, with minimal ornamentation
  and a focus on clear hierarchy and functional clarity.
source:
  url: "https://www.veed.io/edit/5dda0878-c7d2-4b56-8a42-0f487e750179?source=landingPage&flow=%7B%22title%22%3A%22Free+Online+Video+Editor%22%2C%22steps%22%3A%5B%7B%22type%22%3A%22upload%22%2C%22config%22%3A%7B%22noVideo%22%3Afalse%2C%22noAudio%22%3Afalse%2C%22noImage%22%3Afalse%2C%22noTranscript%22%3Atrue%7D%7D%2C%7B%22type%22%3A%22navigation%22%2C%22config%22%3A%7B%22tabHref%22%3A%22%2Fvideo%22%2C%22pingTestIds%22%3A%5B%22%40upload-file%22%5D%2C%22pingType%22%3A%22shadow%22%2C%22unselectElement%22%3Afalse%7D%7D%5D%7D&subSource=tools%2Fvideo-editor"
  pagesAnalyzed: 1
  extractedAt: 2026-10-19
  tokensMeasured: true
colors:
  primary: "#FF5454"
  link: "#3C6300"
  canvas: "#000000"
  on-primary: "#FAFAF9"
  accent-1: "#0C0A09"
  neutral-1: "#333333"
typography:
  heading-lg:
    fontFamily: SwissNow
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.17
    letterSpacing: -0.12px
  heading-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: 0px
  heading-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0px
  heading-xs:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.23
    letterSpacing: 0px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.23
    letterSpacing: 0px
  body-xs:
    fontFamily: Inter
    fontSize: 11.5px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.12px
  button:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.23
    letterSpacing: 0px
  caption-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0px
  caption-sm:
    fontFamily: Inter
    fontSize: 11.5px
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: 0.12px
  caption-sm-strong:
    fontFamily: Inter
    fontSize: 11.5px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.12px
  caption-xs:
    fontFamily: Inter
    fontSize: 9px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0.09px
rounded:
  none: 0px
  xs: 4px
  sm: 5px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 48px
  section: 60px
  band: 108px
borderWidths:
  thin: 1px
shadows:
  sm: "rgba(68, 68, 70, 0.1) 0px 8px 12px 0px, rgba(68, 68, 70, 0.05) 0px 2px 8px -2px, rgba(68, 68, 70, 0.05) 0px 1px 4px -1px"
elevationStrategy: layered-micro
themes:
  derived: light   # the other theme is the site's measured palette
  light:
    bg: "#FFF7F7"
    surface: "#F5EDED"
    surfaceRaised: "#EDE6E6"
    text: "#1D1414"
    textMuted: "#716969"
    border: "#DBD4D4"
    accent: "#D90000"
    accentFg: "#FFFFFF"
    focusRing: "#FF4040"
    elevation: shadow
  dark:
    bg: "#000000"
    surface: "#000000"
    surfaceRaised: "#141414"
    text: "#111111"
    textMuted: "#0B0B0B"
    border: "#020202"
    accent: "#FF5454"
    accentFg: "#0B0B0C"
    focusRing: "#FF5454"
    elevation: "border+surface"
  contrastFailures:
    - "dark: text on bg = 1.11:1 (needs 4.5:1)"
    - "dark: muted on bg = 1.07:1 (needs 4.5:1)"
    - "dark: text on surface = 1.11:1 (needs 4.5:1)"
components:
  button-text:
    typography: "{typography.body-sm}"
    textColor: "oklch(0.405 0.101 131.063)"
    height: 40px
    padding: "12px 16px 12px 16px"
    rounded: "{rounded.md}"
    backgroundColor: "oklch(0.897 0.196 126.665)"
  button-text-2:
    typography: "{typography.body-sm}"
    textColor: "oklch(0.147 0.004 49.25)"
    height: 40px
    padding: "12px 16px 12px 16px"
    rounded: "{rounded.md}"
    backgroundColor: "oklch(0.97 0.001 106.424)"
  button-primary:
    typography: "{typography.body-sm}"
    textColor: "{colors.on-primary}"
    height: 32px
    padding: "7px 11px 7px 11px"
    rounded: "{rounded.md}"
    backgroundColor: "{colors.primary}"
  card:
    typography: "{typography.body-sm}"
    textColor: "oklch(0.147 0.004 49.25)"
    border: "1px solid rgba(0, 0, 0, 0.1)"
    rounded: "{rounded.md}"
  navigation:
    typography: "{typography.body-sm}"
    textColor: "oklch(0.147 0.004 49.25)"
    height: 44px
    padding: "4px 4px 4px 4px"
    boxShadow: "rgba(68, 68, 70, 0.1) 0px 8px 12px 0px, rgba(68, 68, 70, 0.05) 0px 2px 8px -2px, rgba(68, 68, 70, 0.05) 0px 1px 4px -1px"
    rounded: "{rounded.lg}"
    backgroundColor: "rgb(255, 255, 255)"
  link:
    typography: "{typography.body-sm}"
    textColor: "oklch(0.648 0.2 131.684)"
    rounded: "{rounded.md}"
  link-2:
    typography: "{typography.caption-sm-strong}"
    textColor: "{colors.link}"
states:
  other-hover:
    target: other
    state: hover
    backgroundColor: "rgba(0, 0, 0, 0.8)"
  other-focus:
    target: other
    state: focus
    opacity: 1
breakpoints:
  - width: 375
    containerWidth: 375
    gridColumns: 0
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 18
    bodyPx: 13
    sectionPaddingX: 0
  - width: 768
    containerWidth: 768
    gridColumns: 0
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 24
    bodyPx: 13
    sectionPaddingX: 0
  - width: 1024
    containerWidth: 1024
    gridColumns: 0
    navLinksVisible: 9
    menuToggleVisible: true
    headingPx: 24
    bodyPx: 13
    sectionPaddingX: 0
  - width: 1280
    containerWidth: 1280
    gridColumns: 3
    navLinksVisible: 9
    menuToggleVisible: true
    headingPx: 24
    bodyPx: 13
    sectionPaddingX: 0
  - width: 1440
    containerWidth: 1440
    gridColumns: 3
    navLinksVisible: 9
    menuToggleVisible: true
    headingPx: 24
    bodyPx: 13
    sectionPaddingX: 0
coverage:
  statesFound: 61
  gradientsFound: 0
  rolesUnassigned: 2
  archetypesUnnamed: 0
  archetypesDetected: 0
  responsiveMeasured: true
  stylesheetsBlocked: true
  semanticRampDeclared: false
---

# Design System Inspired by VEED

## 1. Visual Theme & Atmosphere

VEED's design system embraces a modern, energetic aesthetic centered around creative media production. The palette is built on high-contrast dark and light surfaces — a deep black canvas paired with bright accent color — creating a professional yet approachable feel suitable for a video editing tool. Typography is clean and geometric, leveraging the Inter family for clarity and precision. The dominant accent (`{colors.primary}` — `#FF5454`) conveys energy and calls to action, while a soft cream (`{colors.on-primary}` — `#FAFAF9`) provides readable contrast on brand surfaces. The overall impression is tech-forward, with minimal ornamentation and a focus on clear hierarchy and functional clarity.

**Key Characteristics**
- High-contrast colour blocking: deep black backgrounds with bright, saturated accent
- Clean, geometric typography with precise tracking
- Minimal shadows (layered-micro for subtle depth)
- Sharp or minimal corner rounding on interactive elements
- Generous whitespace and grid-based layouts
- Accessible link styling with live green accent for interaction

## 2. Color Palette & Roles

### Primary
- **Brand Accent** (`{colors.primary}` — `#FF5454`): Primary call-to-action buttons, active states, and critical feedback elements; projects energy and urgency

### Interactive
- **Link** (`{colors.link}` — `#3C6300`): Inline hyperlinks and textual interactions; a muted forest green suggesting trust and navigation

### Neutral Scale
- **Canvas** (`{colors.canvas}` — `#000000`): Default page background; establishes the dark, immersive editing environment
- **On Primary** (`{colors.on-primary}` — `#FAFAF9`): Label and text colour on brand surfaces; ensures legibility against accent fills
- **Neutral Surface** (`{colors.neutral-1}` — `#333333`): Unassigned secondary neutral; used for decorative or intermediate contrast layers

### Accent (Decorative)
- **Accent Dark** (`{colors.accent-1}` — `#0C0A09`): Decorative element; no primary functional role assigned

## 3. Typography Rules

### Font Family
**Primary:** Inter (https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap) — a humanist sans-serif optimized for screen clarity, available in weights 400, 500, 600, and 800.

**Fallback Stack:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display / Heading Large | Inter | 24px | 600 | 1.17 | −0.12px | Page section headers; measured on h2 |
| Heading Medium | Inter | 18px | 600 | 1.33 | 0px | Subsection titles |
| Heading Small | Inter | 15px | 600 | 1.4 | 0px | Card and component headers |
| Heading Extra Small | Inter | 13px | 600 | 1.23 | 0px | Small section labels |
| Body Standard | Inter | 13px | 500 | 1.23 | 0px | Primary link and body text; measured on link |
| Body Small | Inter | 13px | 400 | 1.23 | 0px | Button labels and general body copy |
| Body Extra Small | Inter | 11.5px | 400 | 1.4 | 0.12px | Fine print and secondary text |
| Caption Medium | Inter | 12px | 500 | 1.33 | 0px | Form labels and metadata |
| Caption Small | Inter | 11.5px | 500 | 1.04 | 0.12px | Figure captions and hints |
| Caption Small Strong | Inter | 11.5px | 600 | 1.4 | 0.12px | Emphasized captions and tags |
| Caption Extra Small | Inter | 9px | 500 | 1.33 | 0.09px | Minute labels and timestamps |

### Principles
- Negative letter-spacing (−0.12px) on the largest heading (24px) tightens the visual aperture and reinforces hierarchy
- Consistent 1.4 line height on smaller body sizes improves scannability at reduced sizes
- Weight progression (400 → 600) creates clear semantic distinction; 800-weight is reserved but not currently deployed
- Letter-spacing widens slightly (0.09–0.12px) on captions to combat crowding at small sizes

## 4. Component Stylings

### Buttons

**Primary Button**
- **Background:** `{colors.primary}` (`#FF5454`)
- **Text:** `{colors.on-primary}` (`#FAFAF9`)
- **Padding:** `{spacing.sm}` top/bottom, `{spacing.md}` left/right (`12px 16px`)
- **Font:** `{typography.body-sm}` (`13px`, weight 500)
- **Height:** `32px`
- **Border Radius:** `{rounded.md}` (`8px`)
- **Border:** None
- **Box Shadow:** None
- **Width:** `73px` (measured default)

**Secondary Button (Text Variant)**
- **Background:** `#FAFAF9` (near-white)
- **Text:** `#333333` (dark neutral)
- **Padding:** `{spacing.sm}` top/bottom, `{spacing.md}` left/right (`12px 16px`)
- **Font:** `{typography.body-sm}` (`13px`, weight 500)
- **Height:** `40px`
- **Border Radius:** `{rounded.md}` (`8px`)
- **Border:** None
- **Box Shadow:** None
- **Width:** `166px` (measured default)

**Tertiary Button (Text, Light)**
- **Background:** `#9FD356` (lime green, as measured)
- **Text:** `#405 0.101 131.063` (dark foreground)
- **Padding:** `{spacing.sm}` top/bottom, `{spacing.md}` left/right (`12px 16px`)
- **Font:** `{typography.body-sm}` (`13px`, weight 500)
- **Height:** `40px`
- **Border Radius:** `{rounded.md}` (`8px`)
- **Border:** None
- **Box Shadow:** None
- **Width:** `344px` (measured default)

### Cards & Containers

**Default Card**
- **Background:** Transparent (`rgba(0, 0, 0, 0)`)
- **Border:** `1px solid rgba(0, 0, 0, 0.1)` (subtle hairline at 40% opacity)
- **Border Radius:** `{rounded.md}` (`8px`)
- **Padding:** `0px` (no internal spacing; measured as image or frame)
- **Box Shadow:** None
- **Width:** `106px`, **Height:** `84px` (measured thumbnail default)
- **Font:** `{typography.body-sm}` (`13px`, weight 500)

### Inputs & Forms

**Input Field (Default)**
- **Background:** Transparent or light surface, responding to `:hover` and `:focus` with `box-shadow: 0 0 0px 1000px var(--color-background-raised) inset`
- **Border:** `1px solid` (hairline, thin as `{spacing.xxs}` derivative)
- **Border Radius:** `{rounded.sm}` (`5px`)
- **Padding:** `{spacing.sm}` vertical, `{spacing.md}` horizontal
- **Font:** `{typography.body-sm}` (`13px`, weight 400)
- **Height:** Consistent with button heights (`32–40px`)

### Navigation

**Navigation Bar (Default)**
- **Background:** `#FFFFFF` (white)
- **Padding:** `{spacing.xs}` (`4px`) on all sides for internal tab/button spacing
- **Border Radius:** `{rounded.lg}` (`12px`)
- **Box Shadow:** `rgba(68, 68, 70, 0.1) 0px 8px 12px 0px, rgba(68, 68, 70, 0.05) 0px 2px 8px -2px, rgba(68, 68, 70, 0.05) 0px 1px 4px -1px` (layered-micro elevation: sm)
- **Font:** `{typography.body-sm}` (`13px`, weight 500)
- **Height:** `44px`
- **Width:** `251px` (measured default)
- **Border:** None

### Links

**Inline Link (Default)**
- **Color:** `{colors.link}` (`#3C6300`)
- **Font:** `{typography.body-sm}` (`13px`, weight 500)
- **Text Decoration:** None (inferred from clean UI)
- **Background:** Transparent
- **Border:** None
- **Hover State:** Color shifts to indicate interactivity (CSS variable `var(--color-text-on-brand)`)

**Inline Link (Body Text Variant)**
- **Color:** `#3C6300` (measured on body link)
- **Font:** `{typography.caption-sm-strong}` (`11.5px`, weight 600)
- **Text Decoration:** Underline or color-only affordance
- **Hover State:** Color shifts to `var(--color-text-on-brand)`

## 5. Layout Principles

### Spacing System

Base unit: `{spacing.xs}` = `8px`. All spacing values are multiples of this base:
- `{spacing.xxs}` = `4px` — micro gaps between adjacent elements
- `{spacing.xs}` = `8px` — tight padding within small components
- `{spacing.sm}` = `12px` — standard padding for buttons and inputs
- `{spacing.md}` = `16px` — primary internal and external gutters
- `{spacing.lg}` = `20px` — comfortable spacing between sections
- `{spacing.xl}` = `24px` — generous separation for major components
- `{spacing.xxl}` = `32px` — emphasis gaps in layout
- `{spacing.xxxl}` = `48px` — large structural spacing
- `{spacing.section}` = `60px` — section separator (measured)
- `{spacing.band}` = `108px` — hero or full-width band height (measured)

### Grid & Container

- **Max Width:** Full viewport width at all breakpoints; no fixed container max-width observed
- **Column Strategy:** Flexible grid; measured at 1280px and 1440px shows 3-column capability but adaptive to content
- **Section Patterns:** Vertical stacking on mobile (375px), horizontal expansion on tablet (768px and above), grid breakout at desktop (1024px+)

### Whitespace Philosophy

Breathing room is consistent and intentional. Components use `{spacing.md}` (`16px`) as the standard breathing margin; sections separate by `{spacing.section}` (`60px`). Padding within sections is `0px` horizontally (full bleed), implying edge-to-edge layout with internal gutters managed at the component level rather than the container level.

### Border Radius Scale

- `{rounded.none}` = `0px` — Sharp corners on images, modals, and large blocks; used for a crisp, technical feel
- `{rounded.xs}` = `4px` — Minimal softening on decorative elements
- `{rounded.sm}` = `5px` — Input fields and form controls; subtle rounding
- `{rounded.md}` = `8px` — Standard rounding for buttons, cards, and interactive elements
- `{rounded.lg}` = `12px` — Navigation bars and larger UI containers
- `{rounded.full}` = `9999px` — Circular or pill-shaped affordances; not widely observed in measured components

### Border Widths

- **Thin** = `1px` — Primary border weight for inputs, cards, and subtle dividers
- No thicker borders measured; the system appears to favour single-weight hairlines

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow; `box-shadow: none` | Cards, buttons, backgrounds |
| Raised (sm) | `rgba(68, 68, 70, 0.1) 0px 8px 12px 0px, rgba(68, 68, 70, 0.05) 0px 2px 8px -2px, rgba(68, 68, 70, 0.05) 0px 1px 4px -1px` | Navigation bar, tooltips, popovers |
| Custom (md) | `rgba(0, 0, 0, 0) 0px 0px 0px 0px` × 5 (no actual shadow) | Reserved but unused |

**Shadow Philosophy:** The system employs a **layered-micro** approach — multiple translucent layers (10%, 5%, 5%) at varying blur and offset to create a barely-there lift. This subtlety maintains the dark, immersive aesthetic while signalling interactive elevation. Colours are standardized darkgrays rather than pure black, softening the effect.

### Opacity Levels

- `0.40` (40%) — Used for subtle overlays, disabled states, and background tints
- Hover states may transition opacity from `0` → `1` for fade-in effects

### Z-index / Layering

- **Base Layer:** `z-index: 1, 2, 3` — Standard stacking for content
- **Dropdown / Popover:** `z-index: 10, 12` — Floated menus and tooltips
- **Sticky / Fixed:** `z-index: 100` — Navigation bars, fixed headers
- **Modal / Dialog:** `z-index: 9998, 9999` — Modal overlays and the highest user-facing layer

## 7. Do's and Don'ts

### Do
- Use `{colors.primary}` (`#FF5454`) for all primary actions and critical alerts to maintain visual consistency and urgency
- Apply `{rounded.md}` (`8px`) to interactive components (buttons, inputs, cards) for a cohesive, friendly feel
- Maintain `{spacing.md}` (`16px`) as the default gutter and breathing space between elements
- Use `{typography.body-sm}` (`13px`, weight 500) for button labels and primary navigation text
- Leverage the layered-micro shadow (sm elevation) on floated components like navigation bars and popovers for subtle depth
- Align headings to the hierarchy: 24px for pages, 18px for sections, 15px for subsections
- Keep borders at `1px` thickness with low opacity (`0.1` or 40%) to maintain lightness
- Apply `{colors.neutral-1}` (`#333333`) as a secondary neutral for intermediate states or disabled states

### Don't
- Mix border styles; stick to solid `1px` hairlines across the system
- Use shortcuts like `border-radius: 50%` for pills unless explicitly `{rounded.full}` (`9999px`) is required
- Apply shadows to buttons; keep them flat for a modern, minimal aesthetic
- Exceed the measured typography sizes; honour the hierarchy to maintain rhythm
- Use colors beyond the defined palette for semantic purposes; the system lacks error/success/warning states (see Known Gaps)
- Increase padding on buttons beyond `{spacing.sm}` top/bottom and `{spacing.md}` left/right without design review
- Change the primary accent (`#FF5454`) hue; the brand relies on this specific warmth for recognition

## 8. Responsive Behavior

### Breakpoints

| Viewport | Width | Content Column | Grid Columns | Heading (h2) | Body | Section Padding-x |
|---|---|---|---|---|---|---|
| Mobile | 375px | 375px | 1 | 18px | 13px | 0px |
| Tablet | 768px | 768px | 1 | 24px | 13px | 0px |
| Small Desktop | 1024px | 1024px | n/a | 24px | 13px | 0px |
| Desktop | 1280px | 1280px | 3 | 24px | 13px | 0px |
| Large Desktop | 1440px | 1440px | 3 | 24px | 13px | 0px |

**Key Changes:**
- Heading size jumps from `18px` (375px) to `24px` (768px and up) — a single breakpoint at tablet scale
- Body text remains constant at `13px` across all breakpoints
- Grid columns appear at 1280px and maintain 3-column layout at 1440px
- All section padding-x is `0px`, indicating full-bleed layout with internal component gutters

### Touch Targets

- Minimum interactive height: `32px` (buttons); observed on primary buttons
- Minimum interactive width: `73px` (primary buttons); wider on secondary variants
- Navigation bar height: `44px` for larger, comfortable touch interaction
- Padding within interactive elements: `{spacing.sm}` (`12px`) vertical, `{spacing.md}` (`16px`) horizontal

### Collapsing Strategy

- **Mobile (375px):** Single-column layouts; buttons and cards span full width or adapt to content
- **Tablet (768px):** Maintain single-column primary content; secondary panels may appear side-by-side
- **Desktop (1024px+):** Multi-column grids unlock; navigation becomes fully horizontal; modals and overlays remain centered

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA:** Brand Accent (`{colors.primary}` — `#FF5454`) — use for buttons, active states, alerts
- **Canvas / Background:** Canvas (`{colors.canvas}` — `#000000`) — dark immersive editing environment
- **Text on Brand:** On Primary (`{colors.on-primary}` — `#FAFAF9`) — readable label on brand surfaces
- **Hyperlink:** Link (`{colors.link}` — `#3C6300`) — inline navigation and textual interactions
- **Secondary Neutral:** Neutral Surface (`{colors.neutral-1}` — `#333333`) — intermediate contrast, decorative fill

### Iteration Guide

1. **Hierarchy First:** All headings follow the measured scale (24px → 18px → 15px → 13px); body copy locks to 13px or smaller
2. **Spacing Rhythm:** Use `{spacing.md}` (`16px`) as the default gap; deviate only for micro (4px) or macro (24px+) emphasis
3. **Border Radius:** Apply `{rounded.md}` (`8px`) to buttons, cards, and inputs; `{rounded.lg}` (`12px`) to container-level nav; `{rounded.none}` (`0px`) to images and modals
4. **Shadows Are Subtle:** Only the navigation bar carries a shadow (sm elevation); buttons and cards remain flat
5. **Primary Red Accent:** All primary actions, warnings, and brand moments use `#FF5454`; do not substitute other reds
6. **Dark Canvas:** The black background (`#000000`) is non-negotiable for the immersive editor feel
7. **Touch-Friendly:** Minimum interactive height is `32–44px`; ensure sufficient padding for comfortable tapping
8. **Responsive Grid:** Breakpoint at 1280px unlocks 3-column layout; below that, expect single or adaptive columns
9. **Typography Weight:** Use weight 500 for buttons and navigation (medium emphasis); weight 400 for body copy; weight 600 for headings and labels

## 10. Known Gaps

- **Semantic Status Colors:** The site does not expose error, success, or warning colour roles. Only primary brand (`#FF5454`), link (`#3C6300`), and neutrals were measured. A semantic ramp (e.g. error red, success green) does not exist in the extracted tokens.
- **Interaction States:** While `:hover`, `:focus`, `:active`, and `:disabled` CSS rules were extracted, the rendered visual appearance of these states on specific components (e.g. button hover tint, input focus ring colour) could not be fully verified from screenshots. Hover colour shifts reference CSS variables (e.g. `var(--color-text-on-brand)`) whose final values were not captured.
- **Dark / Light Mode:** Only one theme was measured (dark canvas with light accents). No dark-mode or theme-toggle evidence was observed; the extraction does not confirm whether alternate themes exist.
- **Gradients & Decorative Effects:** No gradient fills, mesh backgrounds, or animated color transitions were found in the measured stylesheet.
- **Component State Variants:** Disabled button appearance, loading states, and skeleton screens are not documented in the extracted component data.
- **Surface Layers & Glass Morphism:** No frosted-glass or transparency-based surface treatments were measured.
- **Animation & Motion:** Transition durations, easing curves, and animation keyframes are not covered by this extraction.
- **Surfaces Behind Authentication:** The analysis covers only the public upload modal and editor UI. Authenticated features, account settings, and video library views were not visited.
- **Icon Library:** No icon dimensions, stroke weights, or naming conventions are provided; icon styling inferred from context only.
- **Decorative Accent Colour:** `{colors.accent-1}` (`#0C0A09`) was measured but has no assigned semantic role; its functional purpose remains unclear and it is treated as decorative only.
- **Code & Monospace Typography:** No code block styling, monospace font, or pre-formatted text rules were extracted.

---

# Design Tokens (YAML)

```yaml
version: "1.0"
tokens:
  colors:
    primary:
      value: "#FF5454"
      description: "Primary brand accent, CTA buttons, active states"
    link:
      value: "#3C6300"
      description: "Inline link colour"
    accent-1:
      value: "#0C0A09"
      description: "Decorative accent, role unassigned"
    canvas:
      value: "#000000"
      description: "Page background"
    on-primary:
      value: "#FAFAF9"
      description: "Text on brand surfaces"
    neutral-1:
      value: "#333333"
      description: "Secondary neutral"
  
  typography:
    display-lg:
      fontSize: "24px"
      fontWeight: 600
      lineHeight: 1.17
      letterSpacing: "-0.12px"
    heading-md:
      fontSize: "18px"
      fontWeight: 600
      lineHeight: 1.33
      letterSpacing: "0px"
    heading-sm:
      fontSize: "15px"
      fontWeight: 600
      lineHeight: 1.4
      letterSpacing: "0px"
    heading-xs:
      fontSize: "13px"
      fontWeight: 600
      lineHeight: 1.23
      letterSpacing: "0px"
    body-sm:
      fontSize: "13px"
      fontWeight: 500
      lineHeight: 1.23
      letterSpacing: "0px"
    body-base:
      fontSize: "13px"
      fontWeight: 400
      lineHeight: 1.23
      letterSpacing: "0px"
    body-xs:
      fontSize: "11.5px"
      fontWeight: 400
      lineHeight: 1.4
      letterSpacing: "0.12px"
    caption-md:
      fontSize: "12px"
      fontWeight: 500
      lineHeight: 1.33
      letterSpacing: "0px"
    caption-sm:
      fontSize: "11.5px"
      fontWeight: 500
      lineHeight: 1.04
      letterSpacing: "0.12px"
    caption-sm-strong:
      fontSize: "11.5px"
      fontWeight: 600
      lineHeight: 1.4
      letterSpacing: "0.12px"
    caption-xs:
      fontSize: "9px"
      fontWeight: 500
      lineHeight: 1.33
      letterSpacing: "0.09px"
  
  spacing:
    xxs: "4px"
    xs: "8px"
    sm: "12px"
    md: "16px"
    lg: "20px"
    xl: "24px"
    xxl: "32px"
    xxxl: "48px"
    section: "60px"
    band: "108px"
  
  rounded:
    none: "0px"
    xs: "4px"
    sm: "5px"
    md: "8px"
    lg: "12px"
    full: "9999px"
  
  shadows:
    sm: "rgba(68, 68, 70, 0.1) 0px 8px 12px 0px, rgba(68, 68, 70, 0.05) 0px 2px 8px -2px, rgba(68, 68, 70, 0.05) 0px 1px 4px -1px"
    md: "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px"
  
  borders:
    thin: "1px"
  
  opacity:
    subtle: 0.4
  
  zindex:
    base: 1
    dropdown: 10
    sticky: 100
    modal: 9999
```
