/** One visual contract for the patient record, in both appearances. */
export const clinicalMetrics = {
  fieldHeight: 52,
  touchHeight: 44,
  radius: 14,
  fontSize: 16,
  padding: 12,
} as const;
const light = {
  page: "#F2F1EE",
  sheet: "#FAF9F7",
  surface: "#FFFFFF",
  field: "#F3F3F1",
  border: "#DADAD6",
  separator: "#E3E3DF",
  ink: "#272625",
  muted: "#686663",
  placeholder: "#716E68",
  accent: "#4B6276",
  accentSoft: "#EAF0F4",
  brand: "#C9232D",
  danger: "#B33C38",
  dangerSoft: "#F8EDE8",
  onAccent: "#FFFFFF",
  selected: "#FFFFFF",
};
const dark: typeof light = {
  page: "#101113",
  sheet: "#1B1C1F",
  surface: "#1B1C1F",
  field: "#26272B",
  border: "#424349",
  separator: "#35363B",
  ink: "#F2F0EA",
  muted: "#B9B7B1",
  placeholder: "#A09D96",
  accent: "#A6B9C9",
  accentSoft: "#28333E",
  brand: "#FF5A64",
  danger: "#F18A81",
  dangerSoft: "#392B28",
  onAccent: "#FFFFFF",
  selected: "#38393F",
};
export function clinicalTheme(isDark: boolean) {
  return isDark ? dark : light;
}

/**
 * Dims the screen behind a popup so its content stands apart. A popover dims
 * less than sheets and dialogs that ask for a decision. Dark pages are
 * already near black, so dark mode dims harder to keep the layers separate.
 */
const SCRIM = {
  popover: { light: "rgba(0,0,0,0.45)", dark: "rgba(0,0,0,0.65)" },
  modal: { light: "rgba(0,0,0,0.6)", dark: "rgba(0,0,0,0.75)" },
} as const;
export function scrim(kind: keyof typeof SCRIM, isDark: boolean) {
  return SCRIM[kind][isDark ? "dark" : "light"];
}

/** Pastel tint per vital sign, only to tell the tiles apart at a glance. It never signals an abnormal value. */
const VITAL_TINTS = {
  light: {
    bp: { background: "#FCE8EC", label: "#9E3A4E" },
    pr: { background: "#FDECDF", label: "#9A5420" },
    rr: { background: "#E4F0FB", label: "#2E6698" },
    spo2: { background: "#E2F4EC", label: "#287052" },
    bt: { background: "#FBF1D3", label: "#806210" },
    bst: { background: "#EEE9FA", label: "#5F4B9C" },
  },
  dark: {
    bp: { background: "#3A2A2F", label: "#F2AAB8" },
    pr: { background: "#3A2F27", label: "#F3C09A" },
    rr: { background: "#26313D", label: "#A3C9EE" },
    spo2: { background: "#243630", label: "#9CD8BF" },
    bt: { background: "#37321F", label: "#E8D48E" },
    bst: { background: "#2F2A3C", label: "#C9B9F0" },
  },
} as const;
export type VitalTintKey = keyof (typeof VITAL_TINTS)["light"];
export function vitalTint(key: VitalTintKey, isDark: boolean) {
  return VITAL_TINTS[isDark ? "dark" : "light"][key];
}
