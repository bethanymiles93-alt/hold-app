export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999
} as const;

// Everyday palette: the app's normal, present-tense state.
const lightNormalColors = {
  background: "#F4F0E8",
  surface: "#E9E5DB",
  surfaceStrong: "#D9E2DA",
  text: "#242825",
  textMuted: "#555D58",
  border: "#AEB7B0",
  primary: "#334C43",
  primaryPressed: "#253A33",
  onPrimary: "#FFFFFF",
  link: "#315A50",
  error: "#8B2E2E",
  focus: "#805A18",
  white: "#FFFFFF"
} as const;

// Taking Time palette: subtly warmer/richer, golden-hour in feeling, never orange or sepia.
const lightQuietColors = {
  background: "#F6EFDD",
  surface: "#ECE3CE",
  surfaceStrong: "#DFE0C7",
  text: "#242825",
  textMuted: "#5B5A4E",
  border: "#BBAF95",
  primary: "#3B5642",
  primaryPressed: "#29392E",
  onPrimary: "#FFFFFF",
  link: "#3A5A45",
  error: "#8B2E2E",
  focus: "#805A18",
  white: "#FFFFFF"
} as const;

const darkNormalColors = {
  background: "#1B1F1C",
  surface: "#242923",
  surfaceStrong: "#2F362E",
  text: "#EDEFE8",
  textMuted: "#A7AFA3",
  border: "#4A5049",
  primary: "#7FA98A",
  primaryPressed: "#93BC9C",
  onPrimary: "#16211A",
  link: "#8CC29B",
  error: "#E2867D",
  focus: "#D9A54B",
  white: "#FFFFFF"
} as const;

// Dark Taking Time palette: same warm/rich shift as lightQuiet, applied within the dark register.
const darkQuietColors = {
  background: "#201C16",
  surface: "#2A2419",
  surfaceStrong: "#362F20",
  text: "#EDEFE8",
  textMuted: "#B0A896",
  border: "#524A38",
  primary: "#8AB08F",
  primaryPressed: "#9EC2A2",
  onPrimary: "#17211A",
  link: "#96C49E",
  error: "#E2867D",
  focus: "#D9A54B",
  white: "#FFFFFF"
} as const;

export const palettes = {
  lightNormal: lightNormalColors,
  lightQuiet: lightQuietColors,
  darkNormal: darkNormalColors,
  darkQuiet: darkQuietColors
} as const;

export type ThemeVariant = "normal" | "quiet";
export type ColorScheme = "light" | "dark";
export type ThemeColors = typeof lightNormalColors;

// Default export stays pinned to light-normal so existing screens are unaffected.
export const theme = {
  colors: lightNormalColors,
  spacing,
  radius
} as const;
