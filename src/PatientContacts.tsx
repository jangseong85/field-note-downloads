import React, { useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClinicalInput } from "./ClinicalControls";
import { NoteModal } from "./NoteDialogs";
import { clinicalTheme, scrim } from "./clinicalTheme";
import { formatPhoneNumber } from "./phoneNumber";
import { relationTerm, terms } from "./terms";
import { TYPE, makeStyles, useType } from "./design";

export const GUARDIAN_RELATIONS = [
  "부모",
  "배우자",
  "자녀",
  "형제자매",
  "조부모",
  "손자녀",
  "며느리",
  "사위",
  "친인척",
  "지인",
  "요양보호사",
  "회사관계자",
  "기타",
];
const OTHER = "기타";

/** A saved relation that is not one of the chips was typed under 기타. */
export function splitRelation(value: string): { relation: string; custom: string } {
  if (!value || (GUARDIAN_RELATIONS.includes(value) && value !== OTHER)) return { relation: value, custom: "" };
  return { relation: OTHER, custom: value === OTHER ? "" : value };
}

export function joinRelation(relation: string, custom: string): string {
  return relation === OTHER ? custom.trim() || OTHER : relation;
}
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
  const sheet = useSheet();
  const rows = useRows();
  const type = useType();
  const t = clinicalTheme(isDark);
  const L = terms(medical);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [custom, setCustom] = useState("");
  const labelStyle = {
    color: t.muted,
    fontSize: type.sub,
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
            const saved = splitRelation(form.guardianRelation);
            setRelation(saved.relation);
            setCustom(saved.custom);
            setOpen(true);
          }}
        >
          <Text style={{ ...labelStyle, color: t.accent }}>{L.guardian} ›</Text>
          {!!(form.guardianRelation || form.guardianName) && (
            <Text numberOfLines={1} style={[rows.caption, { color: t.muted }]}>
              {[relationTerm(form.guardianRelation, medical), form.guardianName].filter(Boolean).join(" · ")}
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
        <KeyboardAvoidingView behavior="padding" style={[sheet.backdrop, { backgroundColor: scrim("modal", isDark) }]}>
          <Pressable accessibilityLabel="보호자 정보 취소" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <SafeAreaView edges={["bottom"]} style={[sheet.body, { backgroundColor: t.surface }]}>
            <View style={[sheet.grabber, { backgroundColor: t.border }]} />
            <View style={sheet.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="보호자 관계와 이름 지우기"
                onPress={() => {
                  setRelation("");
                  setCustom("");
                  setName("");
                }}
                style={[sheet.round, { backgroundColor: t.field }]}
              >
                <Ionicons name="trash-outline" size={18} color={t.danger} />
              </Pressable>
              <Text style={[sheet.title, { color: t.ink }]}>{medical ? "Guardian" : "보호자 정보"}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="적용"
                onPress={() => {
                  onUpdate("guardianRelation", joinRelation(relation, custom));
                  onUpdate("guardianName", name.trim());
                  setOpen(false);
                }}
                style={[sheet.round, { backgroundColor: t.accent }]}
              >
                <Ionicons name="checkmark" size={20} color={t.surface} />
              </Pressable>
            </View>
            <Text style={[labelStyle, sheet.label]}>{medical ? "Relationship" : "환자와의 관계"}</Text>
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
                      fontSize: type.sub,
                      fontFamily: relation === item ? "Pretendard-SemiBold" : "Pretendard-Regular",
                    }}
                  >
                    {relationTerm(item, medical)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {relation === OTHER && (
              <View style={sheet.custom}>
                <ClinicalInput
                  isDark={isDark}
                  value={custom}
                  onChangeText={setCustom}
                  maxLength={20}
                  autoFocus
                  placeholder={medical ? "Type relationship" : "관계 직접 입력 (예: 조카, 이웃)"}
                  accessibilityLabel="보호자 관계 직접 입력"
                  style={{ paddingRight: 48 }}
                />
                {!!custom && (
                  <Pressable accessibilityRole="button" accessibilityLabel="관계 지우기" onPress={() => setCustom("")} style={sheet.clear}>
                    <Ionicons name="close-circle" size={20} color={t.muted} />
                  </Pressable>
                )}
              </View>
            )}
            <Text style={[labelStyle, sheet.label]}>{medical ? "Name (optional)" : "이름 (선택)"}</Text>
            <View>
              <ClinicalInput
                isDark={isDark}
                value={name}
                onChangeText={setName}
                maxLength={60}
                placeholder={medical ? "Name" : "이름 입력"}
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
const useSheet = makeStyles({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  body: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingBottom: 16 },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: TYPE.body, fontFamily: "Pretendard-SemiBold" },
  label: { marginTop: 12, marginBottom: 8, marginHorizontal: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: "center" },
  custom: { marginTop: 10 },
  clear: { position: "absolute", right: 4, top: 0, bottom: 0, width: 44, alignItems: "center", justifyContent: "center" },
});
const useRows = makeStyles({
  card: { borderRadius: 12, paddingHorizontal: 14, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: 10 },
  label: { width: 92, justifyContent: "center", minHeight: 44 },
  caption: { fontSize: TYPE.caption, marginTop: 2, fontFamily: "Pretendard-Regular" },
  input: { flex: 1, paddingHorizontal: 0 },
  separator: { height: StyleSheet.hairlineWidth },
});
