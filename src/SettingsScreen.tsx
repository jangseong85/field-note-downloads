import React from "react";
import { Text, View } from "react-native";
import RecordAffiliation from "./RecordAffiliation";
import SquishThemeSwitch from "./SquishThemeSwitch";
import { RecordTabs } from "./ClinicalControls";
import { clinicalTheme } from "./clinicalTheme";
import type { SenderInfo } from "./smsMessage";
import { TYPE, makeStyles, useTextSize, type TextSize } from "./design";

const TEXT_SIZE_OPTIONS: { id: TextSize; label: string }[] = [
  { id: "small", label: "작게" },
  { id: "medium", label: "보통" },
  { id: "large", label: "크게" },
];

type Props = {
  isDark: boolean;
  useWheelPicker: boolean;
  wheelPreferenceReady: boolean;
  medicalTerms: boolean;
  followSystemTheme: boolean;
  onFollowSystemThemeChange: (follow: boolean) => void;
  onThemeChange: (dark: boolean) => void;
  onWheelChange: (enabled: boolean) => void;
  onMedicalTermsChange: (enabled: boolean) => void;
  onAffiliationSaved: (sender: SenderInfo) => void;
};

export default function SettingsScreen(p: Props) {
  const styles = useStyles();
  const textSize = useTextSize();
  const t = clinicalTheme(p.isDark);
  return <View style={styles.page}>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>소속 · 대원 정보</Text>
      <RecordAffiliation isDark={p.isDark} onSaved={p.onAffiliationSaved} />
    </View>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>화면 · 입력 방식</Text>
      <View style={[styles.sizeRow, { backgroundColor: t.field }]}>
        <Text style={[styles.label, { color: t.ink }]}>글자 크기</Text>
        <RecordTabs isDark={p.isDark} label="글자 크기" selectionRole="radio" options={TEXT_SIZE_OPTIONS}
          selectedId={textSize.size} onSelect={id => textSize.setSize(id as TextSize)} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>기기 화면 모드 따르기</Text>
          <Text style={[styles.detail, { color: t.muted }]}>{p.followSystemTheme ? "기기의 라이트·다크 설정을 따름" : "아래에서 직접 선택"}</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} accessibilityLabel="기기 화면 모드 따르기" checked={p.followSystemTheme} onChange={p.onFollowSystemThemeChange} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>다크 모드</Text>
          <Text style={[styles.detail, { color: t.muted }]}>{p.isDark ? "켜짐" : "꺼짐"}{p.followSystemTheme ? " · 기기 설정" : ""}</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} checked={p.isDark} onChange={p.onThemeChange} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>년월일 및 시각 입력</Text>
          <Text style={[styles.detail, { color: t.muted }]}>휠 모드 사용</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} accessibilityLabel="휠 모드 사용" checked={p.useWheelPicker} disabled={!p.wheelPreferenceReady} onChange={p.onWheelChange} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>의학용어로 표시</Text>
          <Text style={[styles.detail, { color: t.muted }]}>병력·검토사항을 HTN, DM처럼</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} accessibilityLabel="의학용어로 표시" checked={p.medicalTerms} onChange={p.onMedicalTermsChange} />
      </View>
    </View>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>기록 보관</Text>
      <Text style={[styles.detail, { color: t.muted }]}>환자 기록은 등록 후 24시간이 지나면 사진·녹취·필기·신분증 사진과 함께 이 기기에서 자동 삭제됩니다. 필요한 내용은 그 전에 전달해 주세요.</Text>
    </View>
  </View>;
}

const useStyles = makeStyles({
  page: { gap: 16 },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  heading: { fontSize: TYPE.section, lineHeight: 25, fontFamily: "Pretendard-Medium", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, borderRadius: 14, paddingLeft: 16 },
  sizeRow: { borderRadius: 14, padding: 12, paddingLeft: 16, gap: 10 },
  labelBlock: { flex: 1, paddingVertical: 12, gap: 4 },
  label: { fontSize: TYPE.body, lineHeight: 23, fontFamily: "Pretendard-Medium" },
  detail: { fontSize: TYPE.sub, lineHeight: 19, fontFamily: "Pretendard-Regular" },
});
