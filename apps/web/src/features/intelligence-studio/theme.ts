import {
  studioTheme,
  type AgStudioTheme,
  type AgStudioThemeParams,
} from "ag-studio";

/**
 * RealityProof Design System v2 — Dark-First AG Studio 3.0 Theme
 * Canvas: #0B1020 · Surface: #151E32 · Primary Accent: #C6FF62 · Secondary: #4A7BFF
 */
export const realityProofStudioTheme: AgStudioTheme<AgStudioThemeParams> =
  studioTheme.withParams({
    accentColor: "#C6FF62",
    backgroundColor: "#0B1020",
    foregroundColor: "#F8FAFC",
    textColor: "#F8FAFC",
    borderColor: "#24324D",
    browserColorScheme: "dark",
    gridBrowserColorScheme: "dark",
    gridAccentColor: "#C6FF62",
    gridCellTextColor: "#F8FAFC",
    gridHeaderTextColor: "#F8FAFC",
    gridDataBackgroundColor: "#0E1629",
    gridOddRowBackgroundColor: "#151E32",
    gridHeaderBackgroundColor: "#0B1020",
    studioCanvasBackgroundColor: "#0B1020",
    studioWidgetBackgroundColor: "#151E32",
    studioWidgetBorderRadius: 12,
    studioWidgetPadding: 10,
    studioWidgetTitleTextColor: "#F8FAFC",
    studioWidgetTitleFontSize: 15,
    studioWidgetSubtitleTextColor: "#CBD5E1",
    studioWidgetCaptionTextColor: "#CBD5E1",
    studioToggleButtonActiveBackgroundColor: "#C6FF62",
    studioToggleButtonActiveBorderColor: "#C6FF62",
    studioToggleButtonActiveColor: "#0B1020",
    chartTextColor: "#F8FAFC",
    chartSubtleTextColor: "#CBD5E1",
    chartAxisLabelColor: "#E2E8F0",
    chartAxisTitleColor: "#F8FAFC",
    chartGridLineColor: "#1E293B",
    chartPaletteFills1Color: "#C6FF62",
    chartPaletteFills2Color: "#4A7BFF",
    chartPaletteFills3Color: "#34D399",
    chartPaletteFills4Color: "#FBBF24",
    chartPaletteStrokes1Color: "#C6FF62",
    chartPaletteStrokes2Color: "#4A7BFF",
    chartPaletteStrokes3Color: "#34D399",
    chartPaletteStrokes4Color: "#FBBF24",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 13,
  });
