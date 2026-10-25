import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clinicalTheme } from "./clinicalTheme";
import type { SenderInfo } from "./smsMessage";

type Props = {
  isDark: boolean;
  sender: SenderInfo;
  onOpenMemo: () => void;
  onOpenSettings: () => void;
};

export default function HomeScreen({ isDark, sender, onOpenMemo, onOpenSettings }: Props) {
  const t = clinicalTheme(isDark);
  const identity = [sender.rank, sender.name].filter(Boolean).join(" ");
  return <View style={styles.page}>
    <View style={[styles.profile, { backgroundColor: t.surface }]}>
      <View style={styles.profileHeading}>
        <Text style={[styles.caption, { color: t.muted }]}>나의 소속</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="소속과 대원 정보 설정" onPress={onOpenSettings} style={styles.edit}>
          <Text style={[styles.editLabel, { color: t.accent }]}>수정</Text>
          <Ionicons name="chevron-forward" size={14} color={t.accent} />
        </Pressable>
      </View>
      <Text style={[styles.affiliation, { color: t.ink }, !sender.affiliation && styles.emptyAffiliation]}>
        {sender.affiliation || "소속을 등록해 주세요"}
      </Text>
      {!!identity && <Text style={[styles.identity, { color: t.muted }]}>{identity}</Text>}
    </View>
    <Text style={[styles.sectionLabel, { color: t.muted }]}>바로가기</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="환자 메모 열기" onPress={onOpenMemo}
      style={({ pressed }) => [styles.action, { backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.actionIcon, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="document-text-outline" size={24} color={t.accent} />
      </View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionTitle, { color: t.ink }]}>환자 메모</Text>
        <Text style={[styles.actionDetail, { color: t.muted }]}>환자 정보와 활력징후를 기록합니다</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.muted} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="앱 설정 열기" onPress={onOpenSettings}
      style={({ pressed }) => [styles.action, { backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.actionIcon, { backgroundColor: t.field }]}>
        <Ionicons name="settings-outline" size={24} color={t.ink} />
      </View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionTitle, { color: t.ink }]}>설정</Text>
        <Text style={[styles.actionDetail, { color: t.muted }]}>소속 · 화면 · 입력 방식</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.muted} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 12 },
  profile: { borderRadius: 16, padding: 20, paddingTop: 12, paddingBottom: 24, gap: 8 },
  profileHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: "Pretendard-Medium" },
  edit: { flexDirection: "row", alignItems: "center", justifyContent: "center", minWidth: 48, minHeight: 48, gap: 2 },
  editLabel: { fontSize: 14, fontFamily: "Pretendard-Medium" },
  affiliation: { fontSize: 30, lineHeight: 39, fontFamily: "Pretendard-Bold", letterSpacing: -0.6 },
  emptyAffiliation: { fontSize: 24, lineHeight: 34 },
  identity: { fontSize: 16, lineHeight: 23, fontFamily: "Pretendard-Regular" },
  sectionLabel: { marginTop: 12, fontSize: 14, lineHeight: 20, fontFamily: "Pretendard-Medium" },
  action: { flexDirection: "row", alignItems: "center", minHeight: 96, borderRadius: 16, padding: 16, gap: 14 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionBody: { flex: 1, gap: 5 },
  actionTitle: { fontSize: 18, lineHeight: 25, fontFamily: "Pretendard-Medium" },
  actionDetail: { fontSize: 14, lineHeight: 20, fontFamily: "Pretendard-Regular" },
});
