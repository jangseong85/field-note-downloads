import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClinicalInput } from "./ClinicalControls";
import { NoteModal } from "./NoteDialogs";
import { clinicalTheme } from "./clinicalTheme";
import { formatPhoneNumber } from "./phoneNumber";
import { terms } from "./terms";

export const GUARDIAN_RELATIONS = [
  "부모",
  "친인척",
  "지인",
  "요양보호사",
  "회사관계자",
  "기타",
];
export type ContactKey =
  "patientPhone" | "guardianPhone" | "guardianName" | "guardianRelation";
export default function PatientContacts({
  isDark,
  form,
  onUpdate,
  medical = false,
}: {
  isDark: boolean;
  medical?: boolean;
  form: Record<ContactKey, string>;
  onUpdate: (key: ContactKey, value: string) => void;
}) {
  const t = clinicalTheme(isDark);
  const L = terms(medical);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const labelStyle = {
    color: t.muted,
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
  };
  return (
    <View style={[rows.card, { backgroundColor: t.field }]}>
      <View style={rows.row}>
        <View style={rows.label}>
          <Text style={labelStyle}>{L.patientPhone}</Text>
        </View>
        <ClinicalInput
          isDark={isDark}
          embedded
          value={formatPhoneNumber(form.patientPhone)}
          onChangeText={(value) => onUpdate("patientPhone", formatPhoneNumber(value))}
          keyboardType="phone-pad"
          autoComplete="off"
          placeholder={L.phonePlaceholder}
          accessibilityLabel="환자 연락처 입력"
          style={rows.input}
        />
      </View>
      <View style={[rows.separator, { backgroundColor: t.separator }]} />
      <View style={rows.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="보호자 관계와 이름 설정"
          style={rows.label}
          onPress={() => {
            setName(form.guardianName);
            setRelation(form.guardianRelation);
            setOpen(true);
          }}
        >
          <Text style={{ ...labelStyle, color: t.accent }}>{L.guardian} ›</Text>
          {!!(form.guardianRelation || form.guardianName) && (
            <Text numberOfLines={1} style={[rows.caption, { color: t.muted }]}>
              {[form.guardianRelation, form.guardianName].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Pressable>
        <ClinicalInput
          isDark={isDark}
          embedded
          value={formatPhoneNumber(form.guardianPhone)}
          onChangeText={(value) => onUpdate("guardianPhone", formatPhoneNumber(value))}
          keyboardType="phone-pad"
          autoComplete="off"
          placeholder={L.phonePlaceholder}
          accessibilityLabel="보호자 연락처 입력"
          style={rows.input}
        />
      </View>
      <NoteModal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={sheet.backdrop}>
          <Pressable accessibilityLabel="보호자 정보 취소" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={[sheet.body, { backgroundColor: t.surface }]}>
            <View style={[sheet.grabber, { backgroundColor: t.border }]} />
            <View style={sheet.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="보호자 관계와 이름 지우기"
                onPress={() => {
                  setRelation("");
                  setName("");
                }}
                style={[sheet.round, { backgroundColor: t.field }]}
              >
                <Ionicons name="trash-outline" size={18} color={t.danger} />
              </Pressable>
              <Text style={[sheet.title, { color: t.ink }]}>보호자 정보</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="적용"
                onPress={() => {
                  onUpdate("guardianRelation", relation);
                  onUpdate("guardianName", name.trim());
                  setOpen(false);
                }}
                style={[sheet.round, { backgroundColor: t.accent }]}
              >
                <Ionicons name="checkmark" size={20} color={t.surface} />
              </Pressable>
            </View>
            <Text style={[labelStyle, sheet.label]}>환자와의 관계</Text>
            <View style={sheet.chips}>
              {GUARDIAN_RELATIONS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: relation === item }}
                  onPress={() => setRelation(relation === item ? "" : item)}
                  style={[sheet.chip, { backgroundColor: relation === item ? t.ink : t.field }]}
                >
                  <Text
                    style={{
                      color: relation === item ? t.surface : t.ink,
                      fontSize: 15,
                      fontFamily: relation === item ? "Pretendard-SemiBold" : "Pretendard-Regular",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[labelStyle, sheet.label]}>이름 (선택)</Text>
            <View>
              <ClinicalInput
                isDark={isDark}
                value={name}
                onChangeText={setName}
                maxLength={60}
                placeholder="이름 입력"
                accessibilityLabel="보호자 이름 입력"
                style={{ paddingRight: 48 }}
              />
              {!!name && (
                <Pressable accessibilityRole="button" accessibilityLabel="이름 지우기" onPress={() => setName("")} style={sheet.clear}>
                  <Ionicons name="close-circle" size={20} color={t.muted} />
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </NoteModal>
    </View>
  );
}
const sheet = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  body: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingBottom: 16 },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Pretendard-SemiBold" },
  label: { marginTop: 12, marginBottom: 8, marginHorizontal: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: "center" },
  clear: { position: "absolute", right: 4, top: 0, bottom: 0, width: 44, alignItems: "center", justifyContent: "center" },
});
const rows = StyleSheet.create({
  card: { borderRadius: 12, paddingHorizontal: 14, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: 10 },
  label: { width: 92, justifyContent: "center", minHeight: 44 },
  caption: { fontSize: 11, marginTop: 2, fontFamily: "Pretendard-Regular" },
  input: { flex: 1, paddingHorizontal: 0 },
  separator: { height: StyleSheet.hairlineWidth },
});
