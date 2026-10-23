import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as SMS from "expo-sms";
import { clinicalTheme } from "./clinicalTheme";
import { koreanNowParts } from "./dateTime";
import type { MemoAttachment } from "./MemoAttachments";
import { NoteModal, useNoteAlert } from "./NoteDialogs";
import { formatPhoneNumber } from "./phoneNumber";
import { SMS_SECTIONS, SmsSection, SmsSource, buildSmsMessage, smsLines } from "./smsMessage";

export const MAX_SMS_PHOTOS = 10;
const SECTION_LABELS: Record<SmsSection, { title: string; detail: string }> = {
  affiliation: { title: "소속", detail: "소속, 계급, 성명" },
  identity: { title: "인적사항", detail: "이름, 생년월일" },
  complaint: { title: "주증상", detail: "Onset 포함" },
  vitals: { title: "활력징후", detail: "최근 측정 회차" },
  history: { title: "병력", detail: "선택한 병력" },
};
type Props = {
  visible: boolean;
  isDark: boolean;
  photos: MemoAttachment[];
  source: Omit<SmsSource, "photoCount">;
  contacts: { label: string; phone: string }[];
  onClose: () => void;
};

/** Shrinks a photo for MMS and returns a URI the messaging app can read. */
async function prepareForMms(uri: string): Promise<{ shareUri: string; tempUri: string }> {
  const source = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  // Long edge 1280px keeps several photos inside carrier MMS limits; smaller photos stay as they are.
  if (Math.max(source.width, source.height) > 1280)
    context.resize(source.width >= source.height ? { width: 1280, height: null } : { width: null, height: 1280 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const shareUri = Platform.OS === "android" ? await FileSystem.getContentUriAsync(saved.uri) : saved.uri;
  return { shareUri, tempUri: saved.uri };
}

export default function SendPhotosSheet(p: Props) {
  const t = clinicalTheme(p.isDark);
  const alert = useNoteAlert();
  const [recipient, setRecipient] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sections, setSections] = useState<SmsSection[]>([]);
  const [sending, setSending] = useState(false);
  const today = koreanNowParts().date;
  const lines = useMemo(() => smsLines({ ...p.source, photoCount: 0 }, today), [p.source, today]);
  const available = SMS_SECTIONS.filter((section) => lines[section] !== null);
  useEffect(() => {
    if (!p.visible) return;
    setSelected(p.photos.slice(-MAX_SMS_PHOTOS).map((photo) => photo.id));
    setSections(SMS_SECTIONS.filter((section) => lines[section] !== null));
    setRecipient((current) => current || p.contacts[0]?.phone || "");
    // Reopening starts from the current record; edits made while open are kept.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visible]);
  const picked = p.photos.filter((photo) => selected.includes(photo.id));
  const body = buildSmsMessage({ ...p.source, photoCount: picked.length }, sections, today);
  // Keep a leading + for international numbers; drop only the formatting separators.
  const address = recipient.trim().replace(/(?!^\+)[^\d]/g, "");
  const digits = address.replace(/\D/g, "");
  const canSend = digits.length >= 9 && (picked.length > 0 || body.length > 0) && !sending;
  const allOn = available.length > 0 && available.every((section) => sections.includes(section));
  const togglePhoto = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_SMS_PHOTOS
          ? current
          : [...current, id],
    );
  const toggleSection = (section: SmsSection) =>
    setSections((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section],
    );
  async function send() {
    if (!canSend) return;
    setSending(true);
    const temps: string[] = [];
    try {
      if (!(await SMS.isAvailableAsync())) {
        alert("문자 보내기", "이 기기에서는 문자를 보낼 수 없습니다.");
        return;
      }
      const attachments = [];
      for (const photo of picked) {
        const prepared = await prepareForMms(photo.uri);
        temps.push(prepared.tempUri);
        attachments.push({ uri: prepared.shareUri, mimeType: "image/jpeg", filename: `photo-${attachments.length + 1}.jpg` });
      }
      await SMS.sendSMSAsync([address], body, attachments.length ? { attachments } : undefined);
      p.onClose();
    } catch {
      alert("문자 보내기", "문자 앱을 열지 못했습니다. 사진이 기기에 있는지 확인하고 다시 시도해 주세요.");
    } finally {
      setSending(false);
      // The messaging app keeps its own copy once the composer has opened.
      await Promise.all(temps.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)));
    }
  }
  const circle = (on: boolean) => (
    <View style={[s.check, { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accent : "transparent" }]}>
      {on && <Ionicons name="checkmark" size={14} color={t.surface} />}
    </View>
  );
  return (
    <NoteModal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.backdrop}>
        <Pressable accessibilityLabel="문자 보내기 닫기" style={StyleSheet.absoluteFill} onPress={p.onClose} />
        <SafeAreaView edges={["bottom"]} style={[s.sheet, { backgroundColor: t.surface }]}>
          <View style={[s.grabber, { backgroundColor: t.border }]} />
          <View style={s.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={p.onClose} style={[s.round, { backgroundColor: t.field }]}>
              <Ionicons name="close" size={18} color={t.ink} />
            </Pressable>
            <Text style={[s.title, { color: t.ink }]}>문자로 보내기</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="문자 앱에서 열기"
              accessibilityState={{ disabled: !canSend }}
              onPress={() => void send()}
              style={[s.round, { backgroundColor: canSend ? t.accent : t.field }]}
            >
              {sending ? (
                <ActivityIndicator color={t.surface} />
              ) : (
                <Ionicons name="send" size={17} color={canSend ? t.surface : t.muted} />
              )}
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
            <Text style={[s.label, { color: t.muted }]}>받는 번호</Text>
            <TextInput
              value={formatPhoneNumber(recipient)}
              onChangeText={(value) => setRecipient(formatPhoneNumber(value))}
              keyboardType="phone-pad"
              autoComplete="off"
              placeholder="번호 입력"
              placeholderTextColor={t.placeholder}
              accessibilityLabel="받는 번호 입력"
              style={[s.input, { backgroundColor: t.field, color: t.ink }]}
            />
            {p.contacts.length > 0 && (
              <View style={s.chips}>
                {p.contacts.map((contact) => (
                  <Pressable
                    key={contact.label}
                    accessibilityRole="button"
                    accessibilityLabel={`${contact.label} 번호 사용`}
                    onPress={() => setRecipient(contact.phone)}
                    style={[s.chip, { backgroundColor: t.field }]}
                  >
                    <Text style={[s.chipText, { color: t.ink }]}>{contact.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={[s.label, { color: t.muted }]}>
              사진 {picked.length} / {MAX_SMS_PHOTOS}
            </Text>
            {p.photos.length === 0 ? (
              <Text style={[s.empty, { color: t.muted }]}>첨부한 사진이 없습니다. 내용만 보냅니다.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photos}>
                {p.photos.map((photo, index) => {
                  const on = selected.includes(photo.id);
                  return (
                    <Pressable
                      key={photo.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`사진 ${index + 1} 보내기`}
                      onPress={() => togglePhoto(photo.id)}
                    >
                      <Image source={{ uri: photo.uri }} style={[s.thumb, !on && { opacity: 0.35 }]} />
                      <View style={s.thumbCheck}>{circle(on)}</View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={s.labelRow}>
              <Text style={[s.label, { color: t.muted }]}>함께 보낼 내용</Text>
              {available.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSections(allOn ? [] : available)}
                  style={[s.allButton, { backgroundColor: t.field }]}
                >
                  <Text style={[s.allText, { color: t.ink }]}>{allOn ? "모두 해제" : "모두 선택"}</Text>
                </Pressable>
              )}
            </View>
            <View style={[s.group, { backgroundColor: t.field }]}>
              {SMS_SECTIONS.map((section, index) => {
                const enabled = lines[section] !== null;
                const on = enabled && sections.includes(section);
                return (
                  <Pressable
                    key={section}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !enabled }}
                    disabled={!enabled}
                    onPress={() => toggleSection(section)}
                    style={[s.option, index > 0 && { borderTopColor: t.separator, borderTopWidth: StyleSheet.hairlineWidth }]}
                  >
                    <View style={s.optionText}>
                      <Text style={[s.optionTitle, { color: enabled ? t.ink : t.muted }]}>{SECTION_LABELS[section].title}</Text>
                      <Text style={[s.optionDetail, { color: t.muted }]}>
                        {enabled ? SECTION_LABELS[section].detail : "미기입"}
                      </Text>
                    </View>
                    {enabled && circle(on)}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[s.label, { color: t.muted }]}>미리보기</Text>
            <View style={[s.preview, { backgroundColor: t.field }]}>
              <Text selectable style={[s.previewText, { color: body ? t.ink : t.muted }]}>
                {body || "보낼 내용이 없습니다."}
              </Text>
            </View>
            <Text style={[s.note, { color: t.muted }]}>
              문자 앱이 열리면 내용을 확인한 뒤 직접 전송하세요. 보낸 사진과 내용은 문자 앱과 통신사에 남습니다.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </NoteModal>
  );
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "92%", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16 },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: "Pretendard-SemiBold" },
  content: { paddingBottom: 24, gap: 8 },
  label: { fontSize: 13, fontFamily: "Pretendard-Medium", marginTop: 8, marginHorizontal: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, fontSize: 17, fontFamily: "Pretendard-Regular" },
  chips: { flexDirection: "row", gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center" },
  chipText: { fontSize: 14, fontFamily: "Pretendard-Medium" },
  empty: { fontSize: 13, marginHorizontal: 4 },
  photos: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  thumbCheck: { position: "absolute", right: -4, top: -4 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  allButton: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", marginTop: 8 },
  allText: { fontSize: 13, fontFamily: "Pretendard-Medium" },
  group: { borderRadius: 18, paddingHorizontal: 14 },
  option: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12 },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontFamily: "Pretendard-Regular" },
  optionDetail: { fontSize: 12, fontFamily: "Pretendard-Regular" },
  preview: { borderRadius: 16, padding: 14 },
  previewText: { fontSize: 14, lineHeight: 22, fontFamily: "Pretendard-Regular" },
  note: { fontSize: 12, lineHeight: 18, marginHorizontal: 4 },
});
