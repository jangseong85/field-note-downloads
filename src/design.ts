import { StyleSheet } from "react-native";

/** Shared visual scale. Keep platform font scaling enabled on Text/TextInput. */
export const design = {
  radius: { card: 16 },
  spacing: { medium: 16 },
  type: { caption: 12, label: 14, body: 16, section: 18, title: 24 },
} as const;

const titleStyles = new Set(["settingsTitle", "futureTitle"]);
const headingStyles = new Set(["handwritingTitle", "cameraTitle"]);
const bodyStyles = new Set(["modeTitle"]);
// Memo-header typography must retain its hierarchy rather than collapse to
// the generic 14px fallback. Other screens keep their existing normalization.
const memoTypeStyles = new Set(["noteBrandNumber", "noteBrandText", "noteTitle"]);

/** Normalize by role, not by screen; preserve circular camera controls and media. */
export function normalizeDesign<T extends StyleSheet.NamedStyles<T>>(
  source: T,
): T {
  return Object.fromEntries(
    Object.entries(source).map(([name, value]) => {
      const style = { ...(value as Record<string, unknown>) };
      if (typeof style.fontSize === "number" && !memoTypeStyles.has(name)) {
        const size = titleStyles.has(name)
          ? design.type.title
          : headingStyles.has(name)
            ? design.type.section
            : bodyStyles.has(name)
              ? design.type.body
              : style.fontSize <= 11
                ? design.type.caption
                : design.type.label;
        style.fontSize = size;
        style.lineHeight = Math.ceil(size * 1.4);
        style.fontWeight = titleStyles.has(name)
          ? "600"
          : bodyStyles.has(name) ||
              /Caption|Sub|Hint|unit|Unit|Placeholder/.test(name)
            ? "400"
            : "500";
      }
      if (name === "card") {
        style.borderRadius = design.radius.card;
        style.shadowOpacity = 0;
        style.elevation = 0;
      }
      if (name === "page") {
        style.paddingHorizontal = design.spacing.medium;
        style.paddingTop = design.spacing.medium;
        style.gap = design.spacing.medium;
      }
      return [name, style];
    }),
  ) as unknown as T;
}
