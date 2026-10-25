import React from "react";
import { StyleSheet, Text, View } from "react-native";
import RecordAffiliation from "./RecordAffiliation";
import SquishThemeSwitch from "./SquishThemeSwitch";
import { clinicalTheme } from "./clinicalTheme";
import type { SenderInfo } from "./smsMessage";

type Props = {
  isDark: boolean;
  useWheelPicker: boolean;
  wheelPreferenceReady: boolean;
  medicalTerms: boolean;
  onThemeChange: (dark: boolean) => void;
  onWheelChange: (enabled: boolean) => void;
  onMedicalTermsChange: (enabled: boolean) => void;
  onAffiliationSaved: (sender: SenderInfo) => void;
};

export default function SettingsScreen(p: Props) {
  const t = clinicalTheme(p.isDark);
  return <View style={styles.page}>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>소속 · 대원 정보</Text>
      <RecordAffiliation isDark={p.isDark} onSaved={p.onAffiliationSaved} />
    </View>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>화면 · 입력 방식</Text>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>다크 모드</Text>
          <Text style={[styles.detail, { color: t.muted }]}>{p.isDark ? "켜짐" : "꺼짐"}</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} checked={p.isDark} onChange={p.onThemeChange} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>휠 피커 사용</Text>
          <Text style={[styles.detail, { color: t.muted }]}>{p.useWheelPicker ? "날짜·시각을 휠로 선택" : "숫자 직접 입력"}</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} accessibilityLabel="휠 피커 사용" checked={p.useWheelPicker} disabled={!p.wheelPreferenceReady} onChange={p.onWheelChange} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>의학용어로 표시</Text>
          <Text style={[styles.detail, { color: t.muted }]}>병력·검토사항을 HTN, DM처럼</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} accessibilityLabel="의학용어로 표시" checked={p.medicalTerms} onChange={p.onMedicalTermsChange} />
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  heading: { fontSize: 18, lineHeight: 25, fontFamily: "Pretendard-Medium", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, borderRadius: 14, paddingLeft: 16 },
  labelBlock: { flex: 1, paddingVertical: 12, gap: 4 },
  label: { fontSize: 16, lineHeight: 23, fontFamily: "Pretendard-Medium" },
  detail: { fontSize: 13, lineHeight: 19, fontFamily: "Pretendard-Regular" },
});
