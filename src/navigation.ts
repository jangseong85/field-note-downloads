export const NAVIGATION_ITEMS = [
  { id: "home", label: "홈", icon: "home-outline", selectedIcon: "home" },
  { id: "memo", label: "메모", icon: "document-text-outline", selectedIcon: "document-text" },
  { id: "mci", label: "다수사상자", icon: "people-outline", selectedIcon: "people" },
  { id: "settings", label: "설정", icon: "settings-outline", selectedIcon: "settings" },
] as const;
export type AppTab = typeof NAVIGATION_ITEMS[number]["id"];

/** Keep the compact icon/label stack inside a minimum 50dp touch target. */
export function navigationItemHeight(fontScale: number): number {
  return Math.max(50, Math.ceil(20 + 2 + 17 * fontScale + 8));
}
