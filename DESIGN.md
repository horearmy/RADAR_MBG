---
version: 1.0
name: radar-mbg-operational-design
description: Map-first distribution operations UI for clear, accessible monitoring and action.

colors:
  primary: "#1677FF"
  on-primary: "#FFFFFF"
  primary-hover: "#0F63D6"
  navy-950: "#071B3A"
  navy-900: "#0B2548"
  canvas: "#F4F7FB"
  surface: "#FFFFFF"
  surface-muted: "#F8FAFC"
  ink: "#12213A"
  ink-secondary: "#62728A"
  ink-muted: "#92A0B1"
  hairline: "#DCE4EF"
  success: "#16A765"
  warning: "#F59E0B"
  danger: "#EF4444"
  info: "#0EA5E9"
  accent-purple: "#6D5EF7"

typography:
  font-family: "Inter, system-ui, Arial, sans-serif"
  page-title: "24–32px / 600"
  section-title: "16–20px / 600"
  body: "14–16px / 400"
  metadata: "12–14px / 400"
  tabular-numbers: "Use tabular numerals for KPIs and operational counts"

spacing:
  base: "4px"
  scale: [4px, 8px, 12px, 16px, 24px, 32px, 48px]
  card-padding: "16–24px"

rounded:
  control: "8–10px"
  card: "12–16px"

components:
  app-shell: "Fixed navy sidebar, bright content canvas, responsive main column"
  sidebar-navigation: "Icon and text, visible active state, permission-aware items, count badges"
  page-header: "Breadcrumb, clear title, supporting description, contextual actions"
  kpi-card: "Label, tabular value, period/context, semantic status with text"
  map-panel: "Primary operational surface with freshness, legend, filters, selectable markers"
  status-badge: "Text label plus icon/shape and semantic color; never color alone"
  data-table: "Search/filter context, clear headers, pagination, mobile card fallback"
  alert-card: "Priority, time, linked object, owner/status, next action"
  feedback: "Loading, empty, error, success, offline, stale-data states"
---

## Overview

RADAR MBG is a map-first command view for monitoring Makan Bergizi Gratis distribution. The interface pairs a bright, low-noise canvas and white data surfaces with a deep navy navigation rail and operational blue actions. Density is compact enough for control-room scanning, but labels, timestamps, and freshness must remain explicit.

The local UI/UX specification is authoritative. `https://github.com/VoltAgent/awesome-design-md` is used as a format and discovery reference for DESIGN.md, not as a source to copy another product's identity.

## Design principles

- **Map-first:** give fleet location and freshness a prominent place.
- **Action-oriented:** alerts identify the object, priority, and next useful step.
- **Clear hierarchy:** KPIs, exceptions, and active trips scan quickly.
- **Progressive disclosure:** summarize first; expose detailed trip context on demand.
- **Data transparency:** distinguish live, stale, missing, estimated, and sample data.
- **Accessible and responsive:** keyboard focus, adequate contrast, text labels for statuses, and mobile layouts are required.

## Colors

| Token | Value | Use |
|---|---|---|
| Primary | `#1677FF` | Main actions, links, selected controls |
| Navy 950 | `#071B3A` | Sidebar and primary navigation chrome |
| Navy 900 | `#0B2548` | Dark operational panels and brand surfaces |
| Canvas | `#F4F7FB` | Application background |
| Surface | `#FFFFFF` | Cards, dialogs, and tables |
| Ink | `#12213A` | Main text |
| Secondary ink | `#62728A` | Supporting content |
| Hairline | `#DCE4EF` | Dividers and borders |
| Success | `#16A765` | Verified/completed outcomes |
| Warning | `#F59E0B` | Attention required |
| Danger | `#EF4444` | Critical, failed, or late states |
| Info | `#0EA5E9` | Informational and in-progress states |
| Purple | `#6D5EF7` | Secondary operational category |

Validate text and control contrast against WCAG 2.2 AA before release. Semantic color must always be paired with a readable label or icon.

## Typography and layout

- Prefer Inter with `system-ui`, Arial, and sans-serif fallbacks; do not require a remote font to render the application.
- Page titles: 24–32px; section titles: 16–20px; body: 14–16px; metadata: 12–14px.
- Use tabular numerals for counts and KPI values.
- Use a 4px spacing base and its 8/12/16/24/32/48px increments.
- Cards use 16–24px padding and 12–16px radii; controls use 8–10px radii, thin borders, and restrained shadows.
- At mobile widths, prioritize critical alerts and active trips, make touch targets comfortable, and convert complex tables to cards.

## Components and interaction

- **App shell:** navy sidebar, light canvas, white sticky top bar, content width constrained for readable scanning.
- **Sidebar navigation:** consistent Lucide icons, text labels, visible active state, permission-aware visibility, and labeled attention counts.
- **Page header:** title, supporting description, context, and actions; do not render inert controls as enabled.
- **KPI card:** metric label, value, period, and supporting count/definition. Never present sample values as operational data.
- **Map panel:** map is the principal situational surface. Show location timestamp/freshness, a text legend, working filters, and a selectable marker detail panel.
- **Status:** use words and icons/shapes in addition to color; distinguish `LIVE`, `STALE`, `OFFLINE`, and unavailable data.
- **Feedback:** every data/action surface needs loading, empty, error, success, and offline behavior appropriate to the workflow.
- **Sensitive actions:** explain object and consequence; require confirmation where specified and leave an audit trail.

## Do and don't

### Do

- Keep the operational map prominent and provide filter chips that can be removed.
- Show last server update and label stale/missing GPS honestly.
- Keep route, exception, and delivery data traceable to authorized scope.
- Preserve keyboard focus, reduced-motion preferences, and visible form errors.

### Don't

- Don't use color alone to convey status.
- Don't describe a stale location as live or claim continuous background GPS from a browser.
- Don't show demo/sample numbers as operational facts.
- Don't leave controls that look active but do nothing.
- Don't copy visual branding from entries in the Awesome DESIGN.md collection.

## Responsive behavior

| Range | Layout behavior |
|---|---|
| Mobile `<640px` | Compact navigation, single-column priority layout, map can expand, complex tables become cards |
| Tablet `640–1023px` | Collapsed sidebar, two-column KPI grid, filters may move to a drawer |
| Desktop `1024–1439px` | Full control-room shell, map and operational summaries side by side |
| Wide `≥1440px` | Preserve readable content width; use space for map and supporting analysis |

## Implementation notes and known gaps

- The dashboard shell is being aligned first; page-specific components must be migrated incrementally rather than replaced wholesale.
- Final KPI definitions, production map provider/CSP, route planning, and operational thresholds remain product decisions.
- Verify keyboard navigation, contrast, Android/iOS browser behavior, and real-device GPS/background limitations before release.
