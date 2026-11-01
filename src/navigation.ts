export const NAVIGATION_ITEMS = [
  { id: "patient", label: "환자", icon: "person-outline", selectedIcon: "person" },
  { id: "status", label: "상태", icon: "pulse-outline", selectedIcon: "pulse" },
  { id: "medication", label: "약물", icon: "medkit-outline", selectedIcon: "medkit" },
  { id: "records", label: "기록", icon: "mic-outline", selectedIcon: "mic" },
  { id: "settings", label: "설정", icon: "settings-outline", selectedIcon: "settings" },
] as const;
/** English mode labels; five tabs share the width, so each stays one short word. */
export const NAVIGATION_LABELS_EN: Record<(typeof NAVIGATION_ITEMS)[number]["id"], string> = {
  patient: "Patient",
  status: "Status",
  medication: "Meds",
  records: "Records",
  settings: "Settings",
};
export type AppTab = typeof NAVIGATION_ITEMS[number]["id"];
/** The four tabs that show one part of the selected patient's record. */
export type NoteSection = Exclude<AppTab, "settings">;

/** Keep the compact icon/label stack inside a minimum 50dp touch target. */
export function navigationItemHeight(fontScale: number): number {
  return Math.max(50, Math.ceil(20 + 2 + 17 * fontScale + 8));
}
