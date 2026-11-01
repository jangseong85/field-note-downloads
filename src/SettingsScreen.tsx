import React from "react";
import { Text, View } from "react-native";
import RecordAffiliation from "./RecordAffiliation";
import SquishThemeSwitch from "./SquishThemeSwitch";
import { RecordTabs } from "./ClinicalControls";
import { clinicalTheme } from "./clinicalTheme";
import { PRIVACY_NOTICE, USAGE_NOTICE } from "./privacyNotice";
import type { SenderInfo } from "./smsMessage";
import { TYPE, makeStyles, useTextSize, type TextSize } from "./design";

const TEXT_SIZE_OPTIONS: { id: TextSize; label: string; en: string }[] = [
  { id: "small", label: "작게", en: "Small" },
  { id: "medium", label: "보통", en: "Medium" },
  { id: "large", label: "크게", en: "Large" },
];
/** Each language is named in itself so it can be found from either mode. */
const LANGUAGE_OPTIONS = [
  { id: "ko", label: "한글" },
  { id: "en", label: "English" },
];

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
  const styles = useStyles();
  const textSize = useTextSize();
  const t = clinicalTheme(p.isDark);
  const en = p.medicalTerms;
  return <View style={styles.page}>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>{en ? "Unit · Crew" : "소속 · 대원 정보"}</Text>
      <RecordAffiliation isDark={p.isDark} english={en} onSaved={p.onAffiliationSaved} />
    </View>
    <View style={[styles.card, { backgroundColor: t.surface }]}>
      <Text style={[styles.heading, { color: t.ink }]}>{en ? "Display · Input" : "화면 · 입력 방식"}</Text>
      <View style={[styles.sizeRow, { backgroundColor: t.field }]}>
        <Text style={[styles.label, { color: t.ink }]}>언어 · Language</Text>
        <RecordTabs isDark={p.isDark} label="언어 · Language" selectionRole="radio" options={LANGUAGE_OPTIONS}
          selectedId={en ? "en" : "ko"} onSelect={id => p.onMedicalTermsChange(id === "en")} />
        <Text style={[styles.detail, { color: t.muted }]}>
          {en ? "Medical abbreviations first (C/C, V/S, HTN); records are saved in Korean." : "영문은 의학 약어(C/C, V/S, HTN)를 우선 표기합니다. 저장 값은 한글로 유지됩니다."}
        </Text>
      </View>
      <View style={[styles.sizeRow, { backgroundColor: t.field }]}>
        <Text style={[styles.label, { color: t.ink }]}>{en ? "Text size" : "글자 크기"}</Text>
        <RecordTabs isDark={p.isDark} label="글자 크기" selectionRole="radio" options={TEXT_SIZE_OPTIONS.map(o => ({ id: o.id, label: en ? o.en : o.label }))}
          selectedId={textSize.size} onSelect={id => textSize.setSize(id as TextSize)} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>{en ? "Dark mode" : "다크 모드"}</Text>
          <Text style={[styles.detail, { color: t.muted }]}>{p.isDark ? (en ? "On" : "켜짐") : en ? "Off" : "꺼짐"}</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} checked={p.isDark} onChange={p.onThemeChange} />
      </View>
      <View style={[styles.row, { backgroundColor: t.field }]}>
        <View style={styles.labelBlock}>
          <Text style={[styles.label, { color: t.ink }]}>{en ? "Date & time input" : "년월일 및 시각 입력"}</Text>
          <Text style={[styles.detail, { color: t.muted }]}>{en ? "Wheel picker" : "휠 모드 사용"}</Text>
        </View>
        <SquishThemeSwitch isDark={p.isDark} accessibilityLabel="휠 모드 사용" checked={p.useWheelPicker} disabled={!p.wheelPreferenceReady} onChange={p.onWheelChange} />
      </View>
    </View>
    {([["개인정보 처리방침", PRIVACY_NOTICE], ["이용 안내", USAGE_NOTICE]] as const).map(([heading, items]) => (
      <View key={heading} style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={[styles.heading, { color: t.ink }]}>{heading}</Text>
        {items.map((item) => (
          <View key={item.title} style={styles.notice}>
            <Text style={[styles.noticeTitle, { color: t.ink }]}>{item.title}</Text>
            <Text style={[styles.detail, { color: t.muted }]}>{item.body}</Text>
          </View>
        ))}
      </View>
    ))}
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
  notice: { gap: 4 },
  noticeTitle: { fontSize: TYPE.sub, lineHeight: 19, fontFamily: "Pretendard-Medium" },
});
