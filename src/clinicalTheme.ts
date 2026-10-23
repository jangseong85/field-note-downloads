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
