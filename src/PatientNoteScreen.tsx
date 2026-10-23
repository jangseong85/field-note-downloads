import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClinicalInput, RecordTabs } from "./ClinicalControls";
import DateTimeFields from "./DateTimeFields";
import DateTimeWheelPicker from "./DateTimeWheelPicker";
import ResizableMemoInput from "./ResizableMemoInput";
import MemoAttachments, { MemoAttachment } from "./MemoAttachments";
import { clinicalTheme, vitalTint } from "./clinicalTheme";
import { NoteModal, useNoteAlert } from "./NoteDialogs";
import { calculateAge } from "./idDate";
import PatientContacts, { ContactKey } from "./PatientContacts";
import { dateDigits, formatDate } from "./dateTime";
import { VitalKey, VitalMeasurement, VitalValues } from "./vitalMeasurements";
import HistorySheet from "./HistorySheet";
import { historySummary, orderedHistory } from "./historyOptions";
import ReviewChecklist from "./ReviewChecklistCard";
import { VITAL_TERMS, historyTerm, terms } from "./terms";
import type { SenderInfo } from "./smsMessage";

export type NoteTextKey =
  | ContactKey
  | "name"
  | "birthDate"
  | "gender"
  | "chiefComplaint"
  | "onsetDate"
  | "onsetTime"
  | "historyMemo";
export type NoteForm = VitalValues &
  Record<NoteTextKey, string> & {
    history: string[];
    attachments: MemoAttachment[];
    activeMeasurementId: string;
    idDocument: {
      uri: string;
      name?: string | null;
      birthDate?: string | null;
      capturedAt?: string;
    } | null;
    chiefComplaintDrawing: string | null;
    historyDrawing: string | null;
  };
type Props = {
  isDark: boolean;
  useWheelPicker?: boolean;
  form: NoteForm;
  patients: { id: string; label: string }[];
  activePatientId: string;
  measurements: VitalMeasurement[];
  busy: boolean;
  mediaBusy: boolean;
  onSelectPatient: (id: string) => void;
  onAddPatient: () => void;
  onDeletePatient: () => void;
  onUpdate: (key: NoteTextKey, value: string) => void;
  onScan: () => void;
  onDeleteDocument: () => void;
  onSelectMeasurement: (id: string) => void;
  onAddMeasurement: () => void;
  onDeleteMeasurement: () => void;
  onMeasuredChange: (date: string, time: string) => void;
  onVitalChange: (key: VitalKey, value: string) => void;
  onHistoryChange: (history: string[]) => void;
  onDraw: (field: "chiefComplaintDrawing" | "historyDrawing") => void;
  onDeleteDrawing: (field: "chiefComplaintDrawing" | "historyDrawing") => void;
  onAppend: (attachment: MemoAttachment) => Promise<void>;
  onRemoveAttachment: (attachment: MemoAttachment) => Promise<void>;
  sender: SenderInfo;
  medicalTerms?: boolean;
  onMediaBusyChange: (busy: boolean) => void;
};
const vitals: { key: VitalKey; label: string; unit: string }[] = [
  { key: "bp", label: "혈압", unit: "mmHg" },
  { key: "pr", label: "맥박", unit: "회/분" },
  { key: "rr", label: "호흡", unit: "회/분" },
  { key: "spo2", label: "산소포화도", unit: "%" },
  { key: "bt", label: "체온", unit: "°C" },
  { key: "bst", label: "혈당", unit: "mg/dL" },
];

export default function PatientNoteScreen(p: Props) {
  const Alert = { alert: useNoteAlert() };
  const { isDark, form } = p;
  const t = clinicalTheme(isDark);
  const medical = p.medicalTerms ?? false;
  const L = terms(medical);
  const term = (item: string) => historyTerm(item, medical);
  const { width, fontScale } = useWindowDimensions();
  const narrow = width < 390 || fontScale > 1.15;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // iOS cannot present the camera while the preview is still fading out; open it from onDismiss.
  const rescanAfterPreview = useRef(false);
  const previewingId = preview !== null && preview === form.idDocument?.uri;
  const [focusedVital, setFocusedVital] = useState<VitalKey | null>(null);
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  useEffect(() => {
    setHistoryOpen(false);
    setPreview(null);
    setFocusedVital(null);
    setBirthPickerOpen(false);
  }, [p.activePatientId]);
  const age = calculateAge(form.birthDate);
  const mapParts = form.bp.match(/^(\d{2,3})\/(\d{2,3})$/);
  const map =
    mapParts && +mapParts[1]! > 0 && +mapParts[2]! > 0
      ? Math.round((+mapParts[1]! + 2 * +mapParts[2]!) / 3)
      : null;
  const ink = { color: t.ink },
    muted = { color: t.muted };
  function tool(
    icon: React.ComponentProps<typeof Ionicons>["name"],
    label: string,
    action: () => void,
    disabled = false,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={action}
        style={({ pressed }) => [
          s.tool,
          { opacity: disabled ? 0.35 : pressed ? 0.5 : 1 },
        ]}
      >
        <Ionicons name={icon} size={20} color={t.muted} />
      </Pressable>
    );
  }
  function roundTool(
    icon: React.ComponentProps<typeof Ionicons>["name"],
    label: string,
    action: () => void,
    disabled = false,
    size = 44,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={action}
        hitSlop={size < 44 ? (44 - size) / 2 : 0}
        style={({ pressed }) => [
          s.round,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.field,
          },
          { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons
          name={icon}
          size={size < 44 ? 16 : 19}
          color={size < 44 ? t.accent : t.ink}
        />
      </Pressable>
    );
  }
  function drawButton(
    field: "chiefComplaintDrawing" | "historyDrawing",
    label: string,
  ) {
    return (
      <View style={s.drawRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={p.mediaBusy}
          onPress={() => p.onDraw(field)}
          hitSlop={4}
          style={({ pressed }) => [
            s.drawButton,
            {
              backgroundColor: t.accentSoft,
              opacity: p.mediaBusy ? 0.35 : pressed ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons name="create" size={18} color={t.accent} />
          <Text style={[s.drawText, { color: t.accent }]}>
            {medical ? "Draw" : "손글씨"}
          </Text>
        </Pressable>
      </View>
    );
  }
  function heading(title: string, actions?: React.ReactNode) {
    return (
      <View style={s.sectionHeader}>
        <View style={s.sectionHeading}>
          <Text style={[s.sectionTitle, ink]}>{title}</Text>
        </View>
        {actions}
      </View>
    );
  }
  function drawing(
    uri: string | null,
    field: "chiefComplaintDrawing" | "historyDrawing",
  ) {
    if (!uri) return null;
    return (
      <View style={[s.savedDrawing, { backgroundColor: t.field }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장한 필기 보기"
          onPress={() => setPreview(uri)}
          style={s.savedDrawingOpen}
        >
          <Ionicons name="document-text-outline" size={20} color={t.muted} />
          <Text style={[s.savedDrawingText, ink]}>손글씨 기록</Text>
          <Ionicons name="chevron-forward" size={16} color={t.muted} />
        </Pressable>
        {tool("trash-outline", "필기 삭제", () =>
          Alert.alert("필기 삭제", "이 필기만 삭제할까요?", [
            { text: "취소", style: "cancel" },
            {
              text: "삭제",
              style: "destructive",
              onPress: () => p.onDeleteDrawing(field),
            },
          ]),
        )}
      </View>
    );
  }
  return (
    <>
      <View style={[s.record, { backgroundColor: t.surface }]}>
        {/* Title, +/trash and the patient rail stay mounted across patient switches so the tab motion is kept. */}
        <View style={s.patientTop}>
          {heading(
            L.patient,
            <View style={[s.tools, { gap: 8 }]}>
              {roundTool(
                "add",
                "환자 추가",
                p.onAddPatient,
                p.busy || p.mediaBusy,
                36,
              )}
              {roundTool(
                "trash-outline",
                "선택한 환자 삭제",
                p.onDeletePatient,
                p.busy || p.mediaBusy,
                36,
              )}
            </View>,
          )}
          <RecordTabs
            isDark={isDark}
            label="환자 선택"
            options={p.patients}
            selectedId={p.activePatientId}
            onSelect={p.onSelectPatient}
            disabled={p.busy || p.mediaBusy}
          />
        </View>
        <View key={p.activePatientId} style={s.body}>
          <View style={s.section}>
            <View style={s.idActions}>
              {form.idDocument && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="촬영한 신분증 보기"
                  onPress={() => setPreview(form.idDocument!.uri)}
                  hitSlop={4}
                  style={({ pressed }) => [
                    s.pill,
                    { backgroundColor: t.field, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="card-outline" size={16} color={t.ink} />
                  <Text style={[s.pillText, { color: t.ink }]}>
                    {medical ? "View" : "보기"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="신분증 촬영"
                disabled={p.busy || p.mediaBusy}
                onPress={p.onScan}
                hitSlop={4}
                style={({ pressed }) => [
                  s.pill,
                  {
                    backgroundColor: t.field,
                    opacity: p.busy || p.mediaBusy ? 0.35 : pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="scan-outline" size={16} color={t.accent} />
                <Text style={[s.pillText, { color: t.accent }]}>
                  {medical ? "ID" : "신분증"}
                </Text>
              </Pressable>
            </View>
            <View style={[s.identityBoard, { backgroundColor: t.field }]}>
              <View style={[s.nameRow, narrow && s.stack]}>
                <View style={s.nameCell}>
                  <Text style={[s.fieldLabel, muted]}>{L.name}</Text>
                  <ClinicalInput
                    isDark={isDark}
                    embedded
                    value={form.name}
                    onChangeText={(value) => p.onUpdate("name", value)}
                    placeholder={L.namePlaceholder}
                    accessibilityLabel="환자 이름 입력"
                    style={s.nameInput}
                  />
                </View>
                <View style={[s.sex, narrow && { alignSelf: "flex-end" }]}>
                  <RecordTabs
                    isDark={isDark}
                    label="성별 선택"
                    selectionRole="radio"
                    trackColor={t.surface}
                    options={[
                      { id: "남성", label: L.male },
                      { id: "여성", label: L.female },
                    ]}
                    selectedId={form.gender}
                    onSelect={(gender) =>
                      p.onUpdate("gender", form.gender === gender ? "" : gender)
                    }
                  />
                </View>
              </View>
              <View
                style={[s.identityDivider, { backgroundColor: t.separator }]}
              />
              <View style={s.birthRow}>
                <Text style={[s.fieldLabel, muted]}>{L.birthDate}</Text>
                <View style={s.birthEntry}>
                  {p.useWheelPicker === false ? (
                    <ClinicalInput
                      isDark={isDark}
                      embedded
                      value={formatDate(form.birthDate).replace(/ /g, "")}
                      onChangeText={(value) =>
                        p.onUpdate("birthDate", dateDigits(value))
                      }
                      placeholder="YYYY.MM.DD"
                      accessibilityLabel="환자 생년월일 직접 입력"
                      keyboardType="number-pad"
                      style={[s.birthInput, s.birthValue]}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="환자 생년월일 선택"
                      onPress={() => setBirthPickerOpen(true)}
                      style={s.birthInput}
                    >
                      <Text
                        style={[
                          s.birthValue,
                          { color: form.birthDate ? t.ink : t.placeholder },
                        ]}
                      >
                        {form.birthDate
                          ? formatDate(form.birthDate).replace(/ /g, "")
                          : "YYYY.MM.DD"}
                      </Text>
                    </Pressable>
                  )}
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[s.age, ink, { borderLeftColor: t.border }]}
                  >
                    {age === null ? L.ageEmpty : L.age(age)}
                  </Text>
                </View>
              </View>
            </View>
            <PatientContacts
              key={p.activePatientId}
              isDark={isDark}
              medical={medical}
              form={form}
              onUpdate={p.onUpdate}
            />
          </View>
          <View style={s.section}>
            {heading(L.complaint)}
            <DateTimeFields
              title="Onset"
              showElapsed
              medical={medical}
              useWheelPicker={p.useWheelPicker}
              date={form.onsetDate}
              time={form.onsetTime}
              isDark={isDark}
              onChange={(date, time) => {
                p.onUpdate("onsetDate", date);
                p.onUpdate("onsetTime", time);
              }}
            />
            <ResizableMemoInput
              isDark={isDark}
              accessibilityLabel="주증상과 증상 경과"
              value={form.chiefComplaint}
              onChangeText={(value) => p.onUpdate("chiefComplaint", value)}
              placeholder={L.complaintPlaceholder}
            />
            {drawButton("chiefComplaintDrawing", "주증상 손글씨 입력")}
            {drawing(form.chiefComplaintDrawing, "chiefComplaintDrawing")}
          </View>
          <View style={s.section}>
            {heading(
              L.vitals,
              <View style={[s.tools, { gap: 8 }]}>
                {roundTool(
                  "add",
                  "활력징후 측정 추가",
                  p.onAddMeasurement,
                  false,
                  36,
                )}
                {roundTool(
                  "trash-outline",
                  "선택한 측정 삭제",
                  p.onDeleteMeasurement,
                  false,
                  36,
                )}
              </View>,
            )}
            <View style={s.measureRail}>
              <RecordTabs
                isDark={isDark}
                label="활력징후 측정 회차"
                selectedId={form.activeMeasurementId}
                options={p.measurements.map((m, i) => ({
                  id: m.id,
                  label: L.round(i + 1),
                }))}
                onSelect={p.onSelectMeasurement}
              />
            </View>
            <DateTimeFields
              title={L.measuredAt}
              useWheelPicker={p.useWheelPicker}
              date={form.measuredDate}
              time={form.measuredTime}
              isDark={isDark}
              onChange={p.onMeasuredChange}
            />
            <View style={s.vitalsBoard}>
              {vitals.map((vital) => (
                <View
                  key={vital.key}
                  style={[
                    s.vitalCell,
                    narrow && { width: "48%" },
                    fontScale > 1.7 && { width: "100%" },
                    {
                      backgroundColor: vitalTint(vital.key, isDark).background,
                      borderColor:
                        focusedVital === vital.key ? t.accent : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.vitalLabel,
                      { color: vitalTint(vital.key, isDark).label },
                    ]}
                  >
                    {medical ? VITAL_TERMS[vital.key].en : vital.label}
                  </Text>
                  <ClinicalInput
                    isDark={isDark}
                    embedded
                    accessibilityLabel={`${vital.label} ${vital.unit}`}
                    value={form[vital.key]}
                    placeholder={L.vitalInput}
                    onChangeText={(value) => p.onVitalChange(vital.key, value)}
                    onFocus={() => setFocusedVital(vital.key)}
                    onBlur={() => setFocusedVital(null)}
                    keyboardType={
                      vital.key === "bt" ? "decimal-pad" : "number-pad"
                    }
                    maxLength={
                      vital.key === "bp"
                        ? 7
                        : vital.key === "bt"
                          ? 4
                          : undefined
                    }
                    style={[
                      s.vitalInput,
                      vital.key === "bp" && s.bloodPressureInput,
                      !form[vital.key] && s.vitalPlaceholder,
                    ]}
                  />
                  <Text style={[s.unit, muted]}>
                    {medical ? VITAL_TERMS[vital.key].unitEn : vital.unit}
                  </Text>
                </View>
              ))}
            </View>
            {map !== null && <Text style={[s.map, muted]}>{L.map(map)}</Text>}
          </View>
          <View style={s.section}>
            {heading(L.history)}
            <View style={s.chips}>
              {orderedHistory(form.history).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`${item}, 병력 선택 열기`}
                  onPress={() => setHistoryOpen(true)}
                  style={({ pressed }) => [
                    s.chip,
                    { backgroundColor: t.ink, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[s.chipText, { color: t.surface }]}>
                    {term(item)}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="병력 선택"
                onPress={() => setHistoryOpen(true)}
                style={({ pressed }) => [
                  s.moreHistory,
                  { borderColor: t.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="add" size={15} color={t.muted} />
                <Text style={[s.chipText, muted]}>
                  {form.history.length ? L.historyAdd : L.historyPick}
                </Text>
              </Pressable>
            </View>
            {form.history.length > 0 && (
              <Text style={[s.historySummary, muted]}>
                {historySummary(form.history, term, L.historyPrefix)}
              </Text>
            )}
            <ReviewChecklist
              isDark={isDark}
              medical={medical}
              history={orderedHistory(form.history)}
              memo={form.historyMemo}
              label={term}
              onMemoChange={(value) => p.onUpdate("historyMemo", value)}
            />
            <ResizableMemoInput
              isDark={isDark}
              accessibilityLabel="병력 추가 메모"
              value={form.historyMemo}
              onChangeText={(value) => p.onUpdate("historyMemo", value)}
              placeholder={L.historyMemoPlaceholder}
            />
            {drawButton("historyDrawing", "병력 손글씨 입력")}
            {drawing(form.historyDrawing, "historyDrawing")}
          </View>
        </View>
      </View>
      <View style={[s.attachmentsSection, { backgroundColor: t.surface }]}>
        <MemoAttachments
          key={p.activePatientId}
          isDark={isDark}
          attachments={form.attachments}
          onAppend={p.onAppend}
          onRemove={p.onRemoveAttachment}
          onBusyChange={p.onMediaBusyChange}
          smsSource={{
            sender: p.sender,
            name: form.name,
            birthDate: form.birthDate,
            chiefComplaint: form.chiefComplaint,
            onsetDate: form.onsetDate,
            onsetTime: form.onsetTime,
            measurements: p.measurements,
            historySummary: historySummary(form.history, term, L.historyPrefix),
            medical,
          }}
          contacts={[
            { label: "환자", phone: form.patientPhone },
            {
              label: form.guardianRelation
                ? `보호자(${form.guardianRelation})`
                : "보호자",
              phone: form.guardianPhone,
            },
          ].filter((contact) => contact.phone.replace(/\D/g, "").length >= 9)}
        />
      </View>
      <DateTimeWheelPicker
        key={p.activePatientId}
        visible={birthPickerOpen}
        title="생년월일"
        date={form.birthDate}
        dateOnly
        isDark={isDark}
        onCancel={() => setBirthPickerOpen(false)}
        onApply={(date) => {
          p.onUpdate("birthDate", date);
          setBirthPickerOpen(false);
        }}
      />
      <HistorySheet
        visible={historyOpen}
        isDark={isDark}
        history={form.history}
        title={L.historyPick}
        label={term}
        onCancel={() => setHistoryOpen(false)}
        onApply={(history) => {
          p.onHistoryChange(history);
          setHistoryOpen(false);
        }}
      />
      <NoteModal
        visible={preview !== null}
        animationType="fade"
        onRequestClose={() => setPreview(null)}
        onDismiss={() => {
          if (!rescanAfterPreview.current) return;
          rescanAfterPreview.current = false;
          p.onScan();
        }}
      >
        <SafeAreaView style={s.preview}>
          <View style={s.previewHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="자료 미리보기 닫기"
              onPress={() => setPreview(null)}
              style={s.glass}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={s.previewTitleBlock}>
              <Text style={s.previewTitle}>
                {previewingId
                  ? medical
                    ? "ID"
                    : "신분증"
                  : medical
                    ? "Drawing"
                    : "손글씨 기록"}
              </Text>
              {previewingId && !!form.idDocument?.capturedAt && (
                <Text style={s.previewSubtitle}>
                  {form.idDocument.capturedAt} 촬영
                </Text>
              )}
            </View>
            {previewingId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="신분증 사진 삭제"
                onPress={() =>
                  Alert.alert(
                    "신분증 사진 삭제",
                    "저장한 신분증 사진을 삭제할까요? 입력한 이름과 생년월일은 그대로 둡니다.",
                    [
                      { text: "취소", style: "cancel" },
                      {
                        text: "삭제",
                        style: "destructive",
                        onPress: () => {
                          setPreview(null);
                          p.onDeleteDocument();
                        },
                      },
                    ],
                  )
                }
                style={s.glass}
              >
                <Ionicons name="trash-outline" size={19} color="#FF6B6B" />
              </Pressable>
            ) : (
              <View style={s.glassSpace} />
            )}
          </View>
          {preview && (
            <ScrollView
              style={s.previewZoom}
              contentContainerStyle={s.previewZoomContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: preview }}
                resizeMode="contain"
                style={previewingId ? s.previewImage : s.previewDrawing}
              />
            </ScrollView>
          )}
          {previewingId && (
            <View style={s.previewCard}>
              <View style={s.previewRow}>
                <Text style={s.previewLabel}>
                  {medical ? "Read name" : "인식한 이름"}
                </Text>
                <Text style={s.previewValue}>
                  {form.idDocument?.name ||
                    (medical ? "Not read" : "인식 안 됨")}
                </Text>
              </View>
              <View style={s.previewDivider} />
              <View style={s.previewRow}>
                <Text style={s.previewLabel}>
                  {medical ? "Read DOB" : "인식한 생년월일"}
                </Text>
                <Text style={s.previewValue}>
                  {form.idDocument?.birthDate
                    ? formatDate(form.idDocument.birthDate).replace(/ /g, "")
                    : medical
                      ? "Not read"
                      : "인식 안 됨"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="신분증 다시 촬영"
                disabled={p.busy || p.mediaBusy}
                onPress={() => {
                  if (Platform.OS === "ios") rescanAfterPreview.current = true;
                  setPreview(null);
                  if (Platform.OS !== "ios") p.onScan();
                }}
                style={({ pressed }) => [
                  s.rescan,
                  { opacity: p.busy || p.mediaBusy ? 0.35 : pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="scan-outline" size={17} color="#101113" />
                <Text style={s.rescanText}>
                  {medical ? "Rescan" : "다시 촬영"}
                </Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </NoteModal>
    </>
  );
}
const s = StyleSheet.create({
  record: { borderRadius: 28, overflow: "hidden" },
  attachmentsSection: { borderRadius: 26, marginTop: 16, padding: 20 },
  tools: { flexDirection: "row", alignItems: "center" },
  tool: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  patientTop: { paddingHorizontal: 16, paddingTop: 16 },
  round: { alignItems: "center", justifyContent: "center" },
  pill: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  pillText: { fontSize: 14, fontFamily: "Pretendard-SemiBold" },
  drawRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  drawButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  drawText: { fontSize: 14, fontFamily: "Pretendard-SemiBold" },
  body: { paddingHorizontal: 16, paddingTop: 14 },
  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    minHeight: 44,
  },
  sectionHeading: { flex: 1, gap: 5 },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Pretendard-Bold",
    letterSpacing: -0.4,
  },
  identityBoard: { borderRadius: 12, paddingHorizontal: 14 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  stack: { flexDirection: "column", alignItems: "stretch" },
  nameCell: { flex: 1, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontFamily: "Pretendard-Regular" },
  nameInput: { paddingHorizontal: 0, paddingVertical: 8, minHeight: 42 },
  sex: { width: 148, flexShrink: 0 },
  identityDivider: { height: StyleSheet.hairlineWidth },
  birthRow: {
    paddingVertical: 12,
  },
  birthEntry: { flexDirection: "row", alignItems: "center", gap: 10 },
  birthInput: {
    flex: 1,
    paddingHorizontal: 0,
    minHeight: 52,
    justifyContent: "center",
  },
  birthValue: {
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  age: {
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
  },
  measureRail: { marginBottom: 14 },
  vitalsBoard: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  vitalCell: {
    width: "31%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 4,
  },
  vitalLabel: {
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
    textAlign: "center",
  },
  unit: { fontSize: 12, textAlign: "center" },
  vitalInput: {
    width: "100%",
    paddingHorizontal: 0,
    paddingVertical: 4,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 36,
    fontFamily: "Pretendard-SemiBold",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.6,
  },
  bloodPressureInput: { fontSize: 24, letterSpacing: -0.8 },
  vitalPlaceholder: {
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
    letterSpacing: 0,
  },
  map: { fontSize: 12, marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  chipText: { fontSize: 13, fontFamily: "Pretendard-Medium" },
  moreHistory: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  historySummary: { fontSize: 13, lineHeight: 21, marginBottom: 14 },
  savedDrawing: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginTop: 10,
    paddingLeft: 12,
  },
  savedDrawingOpen: {
    minHeight: 48,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  savedDrawingText: { fontSize: 14, flex: 1 },
  idActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },
  preview: { flex: 1, backgroundColor: "#000000" },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  glass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
  },
  glassSpace: { width: 44, height: 44 },
  previewTitleBlock: { alignItems: "center", gap: 2 },
  previewTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Pretendard-SemiBold",
  },
  previewSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontFamily: "Pretendard-Regular",
  },
  previewZoom: { flex: 1 },
  previewZoomContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  previewImage: { width: "100%", aspectRatio: 1.58, borderRadius: 16 },
  // Handwriting is drawn on a portrait canvas: keep it full height (Android ScrollView cannot zoom).
  previewDrawing: { flex: 1, width: "100%" },
  previewCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "rgba(44,45,50,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  previewRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  previewLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
  },
  previewValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    fontVariant: ["tabular-nums"],
  },
  rescan: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F2F0EA",
  },
  rescanText: {
    color: "#101113",
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
});
