import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clinicalTheme } from "./clinicalTheme";
import { NoteModal } from "./NoteDialogs";
import RecordAffiliation from "./RecordAffiliation";
import SquishThemeSwitch from "./SquishThemeSwitch";
import type { SenderInfo } from "./smsMessage";

export type PopoverAnchor = { x: number; y: number; width: number; height: number };
type Props = {
  visible: boolean;
  isDark: boolean;
  anchor: PopoverAnchor | null;
  affiliation: string;
  senderRank?: string;
  senderName?: string;
  useWheelPicker: boolean;
  wheelPreferenceReady: boolean;
  medicalTerms: boolean;
  onMedicalTermsChange: (enabled: boolean) => void;
  showReset: boolean;
  onThemeChange: (dark: boolean) => void;
  onWheelChange: (enabled: boolean) => void;
  onAffiliationSaved: (sender: SenderInfo) => void;
  onReset: () => void;
  onClose: () => void;
};
export const POPOVER_WIDTH = 300;
const EDGE = 16;
const GAP = 8;

/** Places the panel below the anchor, right-aligned to it, inside the screen edges. */
export function popoverPosition(anchor: PopoverAnchor | null, screenWidth: number) {
  const width = Math.min(POPOVER_WIDTH, screenWidth - EDGE * 2);
  if (!anchor) return { top: 104, right: EDGE, width };
  const right = Math.max(EDGE, screenWidth - (anchor.x + anchor.width));
  return { top: anchor.y + anchor.height + GAP, right, width };
}

/** iOS record options: a popover under the header ⋯ button with inline toggles. */
export default function RecordOptionsPopover(p: Props) {
  const t = clinicalTheme(p.isDark);
  const { width: screenWidth } = useWindowDimensions();
  const [mode, setMode] = useState<"main" | "affiliation">("main");
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
    setMode("main");
    appear.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion)
      Animated.spring(appear, { toValue: 1, speed: 22, bounciness: 6, useNativeDriver: true }).start();
  }, [p.visible, reduceMotion, appear]);
  const position = popoverPosition(p.anchor, screenWidth);
  const panelColor = p.isDark ? "rgba(48,49,54,0.97)" : "rgba(250,249,247,0.98)";
  const separator = { backgroundColor: t.separator };
  const reset = () => {
    p.onClose();
    p.onReset();
  };
  return (
    <NoteModal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose}>
      <Pressable accessibilityLabel="기록 옵션 닫기" style={StyleSheet.absoluteFill} onPress={p.onClose} />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          position,
          { backgroundColor: panelColor, borderColor: t.border },
          {
            opacity: appear,
            transform: [
              { translateX: appear.interpolate({ inputRange: [0, 1], outputRange: [position.width * 0.08, 0] }) },
              { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
              { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1], easing: Easing.out(Easing.quad) }) },
            ],
          },
        ]}
      >
        {mode === "main" ? (
          <>
            <View style={styles.row}>
              <Text style={[styles.label, styles.grow, { color: t.ink }]}>다크 모드</Text>
              <SquishThemeSwitch checked={p.isDark} onChange={p.onThemeChange} />
            </View>
            <View style={[styles.separator, separator]} />
            <View style={styles.row}>
              <View style={styles.labelBlock}>
                <Text style={[styles.label, { color: t.ink }]}>휠 피커 사용</Text>
                <Text style={[styles.caption, { color: t.muted }]}>
                  {p.useWheelPicker ? "날짜·시각을 휠로 선택" : "숫자 직접 입력"}
                </Text>
              </View>
              <SquishThemeSwitch
                accessibilityLabel="휠 피커 사용"
                checked={p.useWheelPicker}
                disabled={!p.wheelPreferenceReady}
                onChange={p.onWheelChange}
              />
            </View>
            <View style={[styles.separator, separator]} />
            <View style={styles.row}>
              <View style={styles.labelBlock}>
                <Text style={[styles.label, { color: t.ink }]}>의학용어로 표시</Text>
                <Text style={[styles.caption, { color: t.muted }]}>병력·검토사항을 HTN, DM처럼</Text>
              </View>
              <SquishThemeSwitch
                accessibilityLabel="의학용어로 표시"
                checked={p.medicalTerms}
                onChange={p.onMedicalTermsChange}
              />
            </View>            <View style={[styles.separator, separator]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="소속 설정"
              onPress={() => setMode("affiliation")}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={styles.labelBlock}>
                <Text style={[styles.label, { color: t.ink }]}>소속</Text>
                <Text style={[styles.caption, { color: t.muted }]} numberOfLines={1}>
                  {[p.affiliation, p.senderRank, p.senderName].filter(Boolean).join(" ") || "설정되지 않음"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </Pressable>
            {p.showReset && (
              <>
                <View style={[styles.separator, separator]} />
                <Pressable
                  accessibilityRole="button"
                  onPress={reset}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.label, styles.grow, { color: t.danger }]}>환자 기록 전체 초기화</Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <View style={styles.affiliation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="기록 옵션으로 돌아가기"
              onPress={() => setMode("main")}
              style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="chevron-back" size={18} color={t.accent} />
              <Text style={[styles.backText, { color: t.accent }]}>기록 옵션</Text>
            </Pressable>
            <RecordAffiliation isDark={p.isDark} onSaved={p.onAffiliationSaved} />
          </View>
        )}
      </Animated.View>
    </NoteModal>
  );
}
const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  labelBlock: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontFamily: "Pretendard-Regular" },
  grow: { flex: 1 },
  caption: { fontSize: 13, fontFamily: "Pretendard-Regular" },
  separator: { height: StyleSheet.hairlineWidth },
  affiliation: { paddingVertical: 8, gap: 8 },
  back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { fontSize: 16, fontFamily: "Pretendard-Medium" },
});
