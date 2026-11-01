import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clinicalTheme, scrim } from "./clinicalTheme";
import { NoteModal } from "./NoteDialogs";
import { TYPE, makeStyles } from "./design";

export type PopoverAnchor = { x: number; y: number; width: number; height: number };
type Props = {
  visible: boolean;
  isDark: boolean;
  anchor: PopoverAnchor | null;
  onReset: () => void;
  onClose: () => void;
};
export const POPOVER_WIDTH = 300;
const EDGE = 16;
const GAP = 8;

/** Places the panel below the anchor, right-aligned to it, inside the screen edges. It is only as wide as its rows. */
export function popoverPosition(anchor: PopoverAnchor | null, screenWidth: number) {
  const maxWidth = Math.min(POPOVER_WIDTH, screenWidth - EDGE * 2);
  if (!anchor) return { top: 104, right: EDGE, maxWidth };
  const right = Math.max(EDGE, screenWidth - (anchor.x + anchor.width));
  return { top: anchor.y + anchor.height + GAP, right, maxWidth };
}

/** Memo actions under the header ⋯ button. Preferences live only on the settings tab. */
export default function RecordOptionsPopover(p: Props) {
  const styles = useStyles();
  const t = clinicalTheme(p.isDark);
  const { width: screenWidth } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!p.visible) return;
    appear.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion)
      Animated.spring(appear, { toValue: 1, speed: 22, bounciness: 6, useNativeDriver: true }).start();
  }, [p.visible, reduceMotion, appear]);
  const position = popoverPosition(p.anchor, screenWidth);
  const panelColor = p.isDark ? "rgba(48,49,54,0.97)" : "rgba(250,249,247,0.98)";
  const reset = () => {
    p.onClose();
    p.onReset();
  };

  return (
    <NoteModal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose}>
      <Pressable accessibilityLabel="메모 메뉴 닫기" style={[StyleSheet.absoluteFill, { backgroundColor: scrim("popover", p.isDark) }]} onPress={p.onClose} />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          position,
          { backgroundColor: panelColor, borderColor: t.border },
          {
            opacity: appear,
            transform: [
              { translateX: appear.interpolate({ inputRange: [0, 1], outputRange: [position.maxWidth * 0.08, 0] }) },
              { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
              { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1], easing: Easing.out(Easing.quad) }) },
            ],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={reset}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="trash-outline" size={20} color={t.danger} />
          <Text style={[styles.label, { color: t.danger }]}>환자 기록 전체 초기화</Text>
        </Pressable>
      </Animated.View>
    </NoteModal>
  );
}
const useStyles = makeStyles({
  panel: {
    position: "absolute",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 20,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontSize: TYPE.body, fontFamily: "Pretendard-Regular" },
});
