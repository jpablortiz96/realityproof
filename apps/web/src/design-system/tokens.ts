/**
 * RealityProof Design System v2 — token source of truth (JS mirror of index.css @theme).
 *
 * Purpose: give a future AG Studio theming layer a single, typed object it can
 * override per tenant (brand accent, radius, density) WITHOUT editing components.
 * GATE 2D-A intentionally does NOT wire AG Studio; this file is a contract only.
 */
export const RP_TOKENS = {
  color: {
    canvas: "#0B1020",
    canvas2: "#0D1426",
    surface: "#151E32",
    surface2: "#1A2540",
    surface3: "#222E4C",
    line: "rgba(148,163,184,0.14)",
    lineStrong: "rgba(148,163,184,0.28)",
    ink: "#F8FAFC",
    ink2: "#CBD5E1",
    ink3: "#A3B1C6",
    lime: "#C6FF62",
    limeHover: "#B6F046",
    limeInk: "#0B1020",
    blue: "#4A7BFF",
    blueInk: "#93B4FF",
    ok: "#4ADE80",
    warn: "#FBBF24",
    danger: "#FB7185",
    info: "#93B4FF",
    provReal: "#5EEAD4",
    provReplay: "#7DD3FC",
    provDemo: "#D8B4FE",
    provNone: "#A3B1C6",
  },
  typography: {
    fontSans: "Inter Variable",
    fontMono: "JetBrains Mono Variable",
    /** Minimum rendered size for any readable text (tags included). */
    minTextPx: 12,
    bodyPx: 15,
    scale: { xs: 12, sm: 14, base: 15, lg: 18, xl: 20, "2xl": 24, "3xl": 30 },
  },
  radius: { card: 16, control: 12, pill: 999 },
  motion: { enterMs: 200, reducedMotionRespected: true },
  /** Lime is reserved for the single primary action / key emphasis per context. */
  usageRules: [
    "One primary (lime) CTA per context.",
    "Provenance is never conveyed by colour alone: icon + text label are mandatory.",
    "Warning = amber, Error = rose, Success = green, Info = blue — never swapped.",
  ],
} as const;

export type RpTokens = typeof RP_TOKENS;

