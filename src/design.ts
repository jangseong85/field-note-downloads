import { createContext, useContext, useMemo } from "react";
import { StyleSheet } from "react-native";

/**
 * Six type roles; every font size in the app comes from here (see docs/DESIGN_SYSTEM.md).
 * display: screen titles, home affiliation, vital values · numeric: blood pressure, wheel digits
 * section: section and sheet titles · body: inputs and list rows · sub: labels, buttons, chips · caption: units, badges
 */
export const TYPE = { display: 28, numeric: 24, section: 18, body: 16, sub: 14, caption: 12 } as const;
export type TypeRole = keyof typeof TYPE;

/** App-level text size, multiplied with the system font scale (which stays enabled). */
export const TEXT_SIZES = { small: 0.9, medium: 1, large: 1.15 } as const;
export type TextSize = keyof typeof TEXT_SIZES;
export const TEXT_SIZE_KEY = "ems-log.text-size.v1";
export const isTextSize = (value: unknown): value is TextSize =>
  value === "small" || value === "medium" || value === "large";

type TextSizeState = { size: TextSize; setSize: (size: TextSize) => void };
const DEFAULT_TEXT_SIZE: TextSizeState = { size: "medium", setSize: () => undefined };
export const TextSizeContext = createContext<TextSizeState>(DEFAULT_TEXT_SIZE);
export function useTextSize(): TextSizeState {
  const state = useContext(TextSizeContext);
  return isTextSize(state?.size) ? state : DEFAULT_TEXT_SIZE;
}
export function useTextScale(): number {
  return TEXT_SIZES[useTextSize().size];
}

export function scaleType(scale: number): Record<TypeRole, number> {
  return Object.fromEntries(Object.entries(TYPE).map(([role, size]) => [role, Math.round(size * scale)])) as Record<TypeRole, number>;
}
/** Role sizes at the chosen text size, for styles written inline during render. */
export function useType(): Record<TypeRole, number> {
  const scale = useTextScale();
  return useMemo(() => scaleType(scale), [scale]);
}

/** Scales fontSize and lineHeight; everything else (spacing, touch sizes) stays put. */
export function scaleStyles<T>(source: T, scale: number): T {
  if (scale === 1) return source;
  return Object.fromEntries(Object.entries(source as Record<string, Record<string, unknown>>).map(([name, style]) => {
    const next = { ...style };
    for (const key of ["fontSize", "lineHeight"] as const)
      if (typeof next[key] === "number") next[key] = Math.round((next[key] as number) * scale);
    return [name, next];
  })) as T;
}

/** StyleSheet.create that returns a hook giving the styles at the current text size. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(source: T): () => T {
  const cache = new Map<number, T>();
  return function useStyles() {
    const scale = useTextScale();
    let styles = cache.get(scale);
    if (!styles) {
      styles = StyleSheet.create(scaleStyles(source, scale));
      cache.set(scale, styles);
    }
    return styles;
  };
}
