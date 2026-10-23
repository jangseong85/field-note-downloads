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
    <View style={{ gap: 12, marginTop: 16 }}>
      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>{L.patientPhone}</Text>
        <ClinicalInput
          isDark={isDark}
          value={formatPhoneNumber(form.patientPhone)}
          onChangeText={(value) => onUpdate("patientPhone", formatPhoneNumber(value))}
          keyboardType="phone-pad"
          autoComplete="off"
          placeholder={L.phonePlaceholder}
          accessibilityLabel="환자 연락처 입력"
        />
      </View>
      <View style={{ gap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="보호자 관계와 이름 설정"
          style={{ minHeight: 44, justifyContent: "center" }}
          onPress={() => {
            setName(form.guardianName);
            setRelation(form.guardianRelation);
            setOpen(true);
          }}
        >
          <Text style={{ ...labelStyle, color: t.accent }}>
            {L.guardian}
            {form.guardianRelation || form.guardianName
              ? ` · ${[form.guardianRelation, form.guardianName].filter(Boolean).join(" · ")}`
              : " · 관계 / 이름"}{" "}
            ›
          </Text>
        </Pressable>
        <ClinicalInput
          isDark={isDark}
          value={formatPhoneNumber(form.guardianPhone)}
          onChangeText={(value) => onUpdate("guardianPhone", formatPhoneNumber(value))}
          keyboardType="phone-pad"
          autoComplete="off"
          placeholder={L.phonePlaceholder}
          accessibilityLabel="보호자 연락처 입력"
        />
      </View>
      <NoteModal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={sheet.backdrop}>
          <Pressable accessibilityLabel="보호자 정보 취소" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={[sheet.body, { backgroundColor: t.surface }]}>
            <View style={[sheet.grabber, { backgroundColor: t.border }]} />
            <View style={sheet.header}>
              <Pressable accessibilityRole="button" accessibilityLabel="취소" onPress={() => setOpen(false)} style={[sheet.round, { backgroundColor: t.field }]}>
                <Ionicons name="close" size={18} color={t.ink} />
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
            <Text style={[sheet.note, { color: t.muted }]}>✓를 눌러야 기록에 반영됩니다. 닫으면 취소됩니다.</Text>
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
  note: { fontSize: 12, marginTop: 12, marginHorizontal: 4 },
});
