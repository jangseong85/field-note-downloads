import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeDesign } from "./src/design";
import { clinicalTheme } from "./src/clinicalTheme";
import { MemoAttachment } from "./src/MemoAttachments";
import { createMediaSaveTask, MediaSaveTask, runMediaSave } from "./src/mediaSave";
import { planPatientWorkspaceReset, updatePatientById } from "./src/patientUpdates";
import { addMeasurement, blankMeasurement, deleteMeasurement, normalizeMeasurements, selectMeasurement, snapshotMeasurements, VitalMeasurement } from "./src/vitalMeasurements";
import { formatTimestamp, parseTimestamp } from "./src/dateTime";
import { Frame, expandGuide, guideToPhotoCrop } from "./src/cameraCrop";
import PatientNoteScreen from "./src/PatientNoteScreen";
import SquishThemeSwitch from "./src/SquishThemeSwitch";
import RecordAffiliation, { loadSender } from "./src/RecordAffiliation";
import type { SenderInfo } from "./src/smsMessage";
import RecordOptionsPopover, { PopoverAnchor } from "./src/RecordOptionsPopover";
import { RecordTabs } from "./src/ClinicalControls";
import { CenteredDialog, NoteDialogHost, NoteDialogProvider, NoteModal, useNoteAlert } from "./src/NoteDialogs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  NativeModules,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import {
  calculateAge,
  extractIdentityFromOcr,
  findIdentityRegion,
  findNameLineFrame,
  nameFromLineCrop,
  voteName,
} from "./src/idDate";

void SplashScreen.preventAutoHideAsync();

type IdDocument = {
  uri: string;
  name: string | null;
  birthDate: string | null;
  capturedAt: string;
};
type FormState = {
  attachments: MemoAttachment[];
  vitalMeasurements: VitalMeasurement[];
  activeMeasurementId: string;
  patientId: string;
  chiefComplaint: string;
  onsetDate: string;
  onsetTime: string;
  measuredAt: string;
  measuredDate: string;
  measuredTime: string;
  bp: string;
  pr: string;
  rr: string;
  spo2: string;
  bt: string;
  bst: string;
  historyMemo: string;
  name: string;
  birthDate: string;
  gender: string;
  patientPhone: string;
  guardianPhone: string;
  guardianName: string;
  guardianRelation: string;
  history: string[];
  idDocument: IdDocument | null;
  chiefComplaintDrawing: string | null;
  historyDrawing: string | null;
};
type LegacyFormState = Partial<FormState> & {
  complaintTags?: string[];
  vitalRecords?: unknown;
  dialysisStatus?: string;
  cancerHistory?: string;
  mentalHistory?: string;
  memo?: string;
};

const STORAGE_KEY = "ems-log.current-patient.v1";
type PatientRecord = { id: string; form: FormState };
type PatientWorkspace = { version: 2; activeId: string; patients: PatientRecord[] };
const THEME_KEY = "ems-log.theme.v1";
// plugins/withSplashWebAsset.js가 prebuild 때 넣는 단일 HTML 스플래시
const SPLASH_URI = Platform.OS === "ios"
  ? `${FileSystem.bundleDirectory ?? ""}field24-splash.html`
  : "file:///android_asset/splash/index.html";
const WHEEL_PICKER_KEY = "ems-log.wheel-picker.v1";
const MEDICAL_TERMS_KEY = "ems-log.medical-terms.v1";
const ERASER_SIZE_KEY = "ems-log.eraser-size.v1";
const EMPTY: FormState = {
  attachments: [],
  vitalMeasurements: [blankMeasurement("first")],
  activeMeasurementId: "first",
  patientId: "",
  chiefComplaint: "",
  onsetDate: "",
  onsetTime: "",
  measuredAt: "",
  measuredDate: "",
  measuredTime: "",
  bp: "",
  pr: "",
  rr: "",
  spo2: "",
  bt: "",
  bst: "",
  historyMemo: "",
  name: "",
  birthDate: "",
  gender: "",
  patientPhone: "",
  guardianPhone: "",
  guardianName: "",
  guardianRelation: "",
  history: [],
  idDocument: null,
  chiefComplaintDrawing: null,
  historyDrawing: null,
};

function koreanNow(): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}. ${get("month")}. ${get("day")}. ${get("hour")}:${get("minute")}`;
}

function displayBirthDate(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits.length === 4 ? `${digits}. ` : digits;
  if (digits.length <= 6)
    return `${digits.slice(0, 4)}. ${digits.slice(4)}${digits.length === 6 ? ". " : ""}`;
  return `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6)}${digits.length === 8 ? "." : ""}`;
}

function formatBloodPressure(previousValue: string, value: string): string {
  if (previousValue.endsWith("/") && value === previousValue.slice(0, -1))
    return value;
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (!digits) return "";
  const systolicLength = digits[0] === "1" || digits[0] === "2" ? 3 : 2;
  if (digits.length < systolicLength) return digits;
  return `${digits.slice(0, systolicLength)}/${digits.slice(systolicLength)}`;
}

function formatBodyTemperature(previousValue: string, value: string): string {
  if (previousValue.endsWith(".") && value === previousValue.slice(0, -1))
    return value;
  const digits = value.replace(/\D/g, "").slice(0, 3);
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2)}`;
}


function migrateStoredForm(stored: LegacyFormState): FormState {
  const storedWithoutVitalRecords = { ...stored };
  delete storedWithoutVitalRecords.vitalRecords;
  const patientId =
    stored.patientId ||
    [
      stored.name && `성함: ${stored.name}`,
      stored.birthDate && `생년월일: ${stored.birthDate}`,
      stored.gender && `성별: ${stored.gender}`,
    ]
      .filter(Boolean)
      .join(" · ");
  const chiefComplaint = [
    (stored.complaintTags ?? []).join(", "),
    stored.chiefComplaint,
  ]
    .filter(Boolean)
    .join("\n");
  const historyLines = [
    (stored.history ?? []).length > 0 &&
      `과거력: ${(stored.history ?? []).join(", ")}`,
    stored.dialysisStatus &&
      stored.dialysisStatus !== "해당 없음" &&
      `투석: ${stored.dialysisStatus}`,
    stored.cancerHistory && `암: ${stored.cancerHistory}`,
    stored.mentalHistory && `정신질환: ${stored.mentalHistory}`,
    stored.memo,
  ].filter(Boolean);
  return {
    ...EMPTY,
    ...storedWithoutVitalRecords,
    attachments: Array.isArray(stored.attachments) ? stored.attachments.filter(item => item && typeof item.id === "string" && typeof item.uri === "string" && (item.kind === "photo" || item.kind === "audio")) : [],
    ...normalizeMeasurements(stored.vitalMeasurements, stored.activeMeasurementId),
    measuredDate: stored.measuredDate ?? parseTimestamp(stored.measuredAt ?? "").date,
    measuredTime: stored.measuredTime ?? parseTimestamp(stored.measuredAt ?? "").time,
    patientId,
    chiefComplaint,
    historyMemo: typeof stored.historyMemo === "string" ? stored.historyMemo : historyLines.join("\n"),
    history: stored.history ?? [],
    idDocument: stored.idDocument ?? null,
  };
}

export default function App() {
  return <NoteDialogProvider><FieldNoteApp /></NoteDialogProvider>;
}

function FieldNoteApp() {
  const Alert = { alert: useNoteAlert() };
  const [optionsVisible, setOptionsVisible] = useState(false);
  const optionsButtonRef = useRef<View>(null);
  const [optionsAnchor, setOptionsAnchor] = useState<PopoverAnchor | null>(null);
  const openOptions = () => {
    if (Platform.OS !== "ios" || !optionsButtonRef.current) {
      setOptionsVisible(true);
      return;
    }
    optionsButtonRef.current.measureInWindow((x, y, width, height) => {
      setOptionsAnchor({ x, y, width, height });
      setOptionsVisible(true);
    });
  };
  const [fontsLoaded, fontError] = useFonts({
    "Pretendard-Regular": require("pretendard/dist/public/static/Pretendard-Regular.otf"),
    "Pretendard-Medium": require("pretendard/dist/public/static/Pretendard-Medium.otf"),
    "Pretendard-SemiBold": require("pretendard/dist/public/static/Pretendard-SemiBold.otf"),
    "Pretendard-Bold": require("pretendard/dist/public/static/Pretendard-Bold.otf"),
  });
  const systemColorScheme = useColorScheme();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [patients, setPatients] = useState<PatientRecord[]>([{ id: "initial", form: EMPTY }]);
  const [activePatientId, setActivePatientId] = useState("initial");
  const workspaceRef = useRef<PatientWorkspace>({ version: 2, activeId: activePatientId, patients });
  workspaceRef.current = { version: 2, activeId: activePatientId, patients: patients.map(patient => patient.id === activePatientId ? { ...patient, form } : patient) };
  const drawingSaveBusy = useRef(false);
  const drawingSaveTask = useRef<{ patientId: string; field: "chiefComplaintDrawing" | "historyDrawing"; previousUri: string | null; task: MediaSaveTask<string> } | null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "system",
  );
  const skipInitialSave = useRef(true);
  const patientSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const patientSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resettingPatient = useRef(false);
  const [activeTab, setActiveTab] = useState<
    "memo" | "mci" | "settings"
  >("memo");
  const [scannerBusy, setScannerBusy] = useState(false);
  const [sender, setSender] = useState<SenderInfo>({ affiliation: "", rank: "", name: "" });
  const affiliation = sender.affiliation;
  const [useWheelPicker, setUseWheelPicker] = useState(true);
  const [wheelPreferenceReady, setWheelPreferenceReady] = useState(false);
  const wheelPreferenceSaving = useRef(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(WHEEL_PICKER_KEY).then(value => {
      if (active) { setUseWheelPicker(value !== "false"); setWheelPreferenceReady(true); }
    }).catch(() => { if (active) setWheelPreferenceReady(true); });
    return () => { active = false; };
  }, []);
  const changeWheelPreference = async (enabled: boolean) => {
    if (!wheelPreferenceReady || wheelPreferenceSaving.current) return;
    wheelPreferenceSaving.current = true;
    try { await AsyncStorage.setItem(WHEEL_PICKER_KEY, String(enabled)); setUseWheelPicker(enabled); }
    catch { Alert.alert("입력 방식", "설정 저장에 실패했습니다. 다시 시도해 주세요."); }
    finally { wheelPreferenceSaving.current = false; }
  };
  const [medicalTerms, setMedicalTerms] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(MEDICAL_TERMS_KEY).then(value => { if (active) setMedicalTerms(value === "true"); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const changeMedicalTerms = async (enabled: boolean) => {
    setMedicalTerms(enabled);
    try { await AsyncStorage.setItem(MEDICAL_TERMS_KEY, String(enabled)); }
    catch { setMedicalTerms(!enabled); Alert.alert("용어 표시", "설정 저장에 실패했습니다. 다시 시도해 주세요."); }
  };
  useEffect(() => {
    let active = true;
    void loadSender().then(value => { if (active) setSender(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [guideTop, setGuideTop] = useState(0);
  const [guideFrame, setGuideFrame] = useState<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  const [cameraVisible, setCameraVisible] = useState(false);
  const [drawingTarget, setDrawingTarget] = useState<
    "chiefComplaintDrawing" | "historyDrawing" | null
  >(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [showIntro, setShowIntro] = useState(true);
  const introOpacity = useRef(new Animated.Value(1)).current;
  const introFinishing = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const isDark =
    themeMode === "system"
      ? systemColorScheme === "dark"
      : themeMode === "dark";

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(THEME_KEY),
    ])
      .then(async ([saved, savedTheme]) => {
        if (
          savedTheme === "light" ||
          savedTheme === "dark" ||
          savedTheme === "system"
        )
          setThemeMode(savedTheme);
        if (saved) {
          const stored = JSON.parse(saved) as PatientWorkspace & LegacyFormState;
          if (stored.version === 2 && Array.isArray(stored.patients) && stored.patients.length > 0) {
            const restored = stored.patients.map((patient) => ({ id: patient.id, form: migrateStoredForm(patient.form) }));
            const active = restored.find((patient) => patient.id === stored.activeId) ?? restored[0];
            if (!active) throw new Error("No saved patient");
            setPatients(restored);
            setActivePatientId(active.id);
            setForm(active.form);
          } else {
            const restored = migrateStoredForm(stored);
            setPatients([{ id: "initial", form: restored }]);
            setForm(restored);
          }
        }
        await AsyncStorage.multiRemove([
          "ems-log.input-mode.v1",
          "ems-log.auto-delete-hours.v1",
          "ems-log.updated-at.v1",
        ]);
      })
      .catch(() =>
        Alert.alert("안내", "이전에 작성한 내용을 불러오지 못했습니다."),
      )
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || (!fontsLoaded && !fontError) || resettingPatient.current)
      return;
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      patientSaveTimer.current = null;
      patientSaveQueue.current = patientSaveQueue.current
        .catch(() => undefined)
        .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceRef.current)));
      void patientSaveQueue.current.catch(() =>
        Alert.alert("저장 안내", "입력 내용의 임시 저장에 실패했습니다."),
      );
    }, 250);
    patientSaveTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (patientSaveTimer.current === timer) patientSaveTimer.current = null;
    };
  }, [form, patients, activePatientId, loaded, fontsLoaded, fontError]);

  const commitPatientUpdate = async (patientId: string, updateForm: (previous: FormState) => FormState) => {
    const task = patientSaveQueue.current.catch(() => undefined).then(async () => {
      const snapshot = updatePatientById(workspaceRef.current, patientId, updateForm);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      // Preserve any typing that happened during the storage write.
      const latest = updatePatientById(workspaceRef.current, patientId, updateForm);
      workspaceRef.current = latest;
      setPatients(latest.patients);
      if (latest.activeId === patientId) setForm(previous => updateForm(previous));
    });
    patientSaveQueue.current = task;
    await task;
  };

  const selectPatient = (id?: string) => {
    if (!loaded || scannerBusy || mediaBusy || drawingSaveBusy.current || resettingPatient.current || drawingTarget || cameraVisible) return;
    const current = patients.map((patient) => patient.id === activePatientId ? { ...patient, form } : patient);
    const target = id ? current.find((patient) => patient.id === id) : { id: `patient-${Date.now()}`, form: { ...EMPTY, history: [] } };
    if (!target) return;
    setPatients(id ? current : [...current, target]);
    setActivePatientId(target.id);
    setForm(target.form);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const finishIntro = useCallback(() => {
    if (introFinishing.current) return;
    introFinishing.current = true;
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 360,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setShowIntro(false));
  }, [introOpacity]);

  useEffect(() => {
    if (!loaded) return;
    void SplashScreen.hideAsync();
    const fallback = setTimeout(finishIntro, 5700);
    return () => clearTimeout(fallback);
  }, [finishIntro, loaded]);

  const update = (key: keyof FormState, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const changeTheme = (dark: boolean) => {
    const nextMode = dark ? "dark" : "light";
    setThemeMode(nextMode);
    void AsyncStorage.setItem(THEME_KEY, nextMode).catch(() => Alert.alert("화면 설정", "화면 모드 설정을 저장하지 못했습니다. 다시 선택해 주세요."));
  };
  const deleteDocument = async () => {
    const uri = form.idDocument?.uri;
    setForm((previous) => ({ ...previous, idDocument: null }));
    if (uri)
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
        () => undefined,
      );
  };
  const deleteLocalFile = (uri: string | null) =>
    uri
      ? FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
      : Promise.resolve();
  const requestDeletePatient = () => {
    if (!loaded || scannerBusy || mediaBusy || resettingPatient.current || cameraVisible || drawingTarget) return;
    const index = patients.findIndex((patient) => patient.id === activePatientId);
    const label = form.name.trim() || `환자 ${index + 1}`;
    Alert.alert(`${label} 기록 삭제`, "이 환자의 입력 내용과 촬영·필기 자료를 삭제합니다. 다른 환자 기록은 유지됩니다. 삭제 후에는 복구할 수 없습니다.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: async () => {
        if (resettingPatient.current) return;
        resettingPatient.current = true;
        setDeletingPatient(true);
        if (patientSaveTimer.current) clearTimeout(patientSaveTimer.current);
        patientSaveTimer.current = null;
        const remaining = patients.filter((patient) => patient.id !== activePatientId);
        const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? { id: `patient-${Date.now()}`, form: { ...EMPTY, history: [] } };
        const nextPatients = remaining.length ? remaining : [next];
        try {
          patientSaveQueue.current = patientSaveQueue.current.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeId: next.id, patients: nextPatients })));
          await patientSaveQueue.current;
          setPatients(nextPatients);
          setActivePatientId(next.id);
          setForm(next.form);
          const retainedUris = new Set(nextPatients.flatMap((patient) => [patient.form.idDocument?.uri, patient.form.chiefComplaintDrawing, patient.form.historyDrawing, ...patient.form.attachments.map(item => item.uri)]));
          await Promise.all([form.idDocument?.uri, form.chiefComplaintDrawing, form.historyDrawing, ...form.attachments.map(item => item.uri)].filter((uri): uri is string => !!uri && !retainedUris.has(uri)).map(deleteLocalFile));
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        } catch {
          Alert.alert("삭제 실패", "기록을 삭제하지 못했습니다. 기존 기록은 유지됩니다. 다시 시도해 주세요.");
        } finally {
          resettingPatient.current = false;
          setDeletingPatient(false);
        }
      } },
    ]);
  };
  const saveDrawing = async (temporaryUri: string) => {
    if (drawingSaveBusy.current) throw new Error("Drawing save already in progress");
    if (!drawingTarget || !FileSystem.documentDirectory) throw new Error("Drawing target unavailable");
    drawingSaveBusy.current = true;
    try {
      if (!drawingSaveTask.current) {
        const field = drawingTarget;
        drawingSaveTask.current = {
          patientId: activePatientId, field, previousUri: form[field],
          task: createMediaSaveTask(temporaryUri, `${FileSystem.documentDirectory}handwritten-notes/`, `${field}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`, uri => uri),
        };
      }
      const pending = drawingSaveTask.current;
      await runMediaSave(pending.task, FileSystem, savedUri => commitPatientUpdate(pending.patientId, previous => ({ ...previous, [pending.field]: savedUri })));
      drawingSaveTask.current = null;
      setDrawingTarget(null);
      const retained = workspaceRef.current.patients.some(patient => patient.form.chiefComplaintDrawing === pending.previousUri || patient.form.historyDrawing === pending.previousUri);
      if (!retained) await deleteLocalFile(pending.previousUri);
    } finally {
      drawingSaveBusy.current = false;
    }
  };
  const closeDrawing = async () => {
    if (drawingSaveBusy.current) return;
    const pending = drawingSaveTask.current;
    if (pending && !pending.task.committed) {
      try { await FileSystem.deleteAsync(pending.task.moved ? pending.task.savedUri : pending.task.sourceUri, { idempotent: true }); }
      catch { Alert.alert("임시 파일 정리 실패", "다시 닫기를 눌러 주세요. 저장된 기존 필기는 유지됩니다."); return; }
    }
    drawingSaveTask.current = null;
    setDrawingTarget(null);
  };
  const deleteDrawing = (key: "chiefComplaintDrawing" | "historyDrawing") => {
    const uri = form[key];
    setForm((previous) => ({ ...previous, [key]: null }));
    void deleteLocalFile(uri);
  };
  const reset = () =>
    Alert.alert(
      "환자 기록 전체 초기화",
      "등록된 모든 환자의 인적사항, 주증상, 활력징후, 병력·메모와 사진·녹취·필기 자료가 삭제됩니다. 삭제 후에는 복구할 수 없습니다. 전체 초기화할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "전체 초기화",
          style: "destructive",
          onPress: async () => {
            if (resettingPatient.current) return;
            if (scannerBusy || mediaBusy || drawingSaveBusy.current || cameraVisible || drawingTarget) {
              Alert.alert(
                "초기화 안내",
                "촬영이나 녹취를 마친 후 초기화해 주세요.",
              );
              return;
            }
            resettingPatient.current = true;
            setDeletingPatient(true);
            if (patientSaveTimer.current)
              clearTimeout(patientSaveTimer.current);
            patientSaveTimer.current = null;
            const blank = { id: `patient-reset-${Date.now()}`, form: { ...EMPTY, history: [], attachments: [], vitalMeasurements: [blankMeasurement("first")] } };
            const { next, uris } = planPatientWorkspaceReset(workspaceRef.current, blank);
            try {
              // Queue behind older writes so they cannot restore pre-reset data.
              patientSaveQueue.current = patientSaveQueue.current
                .catch(() => undefined)
                .then(() =>
                  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)),
                );
              await patientSaveQueue.current;
              workspaceRef.current = next;
              setPatients(next.patients);
              setActivePatientId(next.activeId);
              setForm(blank.form);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
              await Promise.all(uris.map(deleteLocalFile));
            } catch {
              Alert.alert(
                "초기화 실패",
                "저장소를 비우지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.",
              );
            } finally {
              resettingPatient.current = false;
              setDeletingPatient(false);
            }
          },
        },
      ],
    );
  const openIdentityCamera = async () => {
    if (scannerBusy) return;
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!permission.granted) {
      Alert.alert(
        "카메라 권한 필요",
        "신분증을 촬영하려면 카메라 접근을 허용해 주세요.",
      );
      return;
    }
    setCameraVisible(true);
  };
  const captureIdentity = async () => {
    if (scannerBusy) return;
    setScannerBusy(true);
    const pendingFiles = new Set<string>();
    try {
      // Freeze the measured preview/guide before the camera closes or layouts change.
      const viewport = { ...cameraLayout };
      const guide = { ...guideFrame, y: guideTop + guideFrame.y };
      if (!viewport.width || !viewport.height || !guide.width || !guide.height) throw new Error("촬영 가이드가 준비되지 않았습니다. 잠시 후 다시 촬영해 주세요.");
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        shutterSound: false,
      });
      if (!photo?.uri) return;
      pendingFiles.add(photo.uri);
      NativeModules.SoftShutter?.play();
      setCameraVisible(false);
      // CameraView는 세로 화면을 채우기 위해 센서 사진의 좌우를 잘라 보여 줍니다.
      // 화면의 카드 가이드와 같은 중앙 영역만 먼저 잘라 OCR에 전달하면 글자가 훨씬 크게 들어옵니다.
      const capturedSource = await ImageManipulator.ImageManipulator.manipulate(
        photo.uri,
      ).renderAsync();
      const crop = guideToPhotoCrop(capturedSource, viewport, expandGuide(guide, viewport));
      const preparedContext = ImageManipulator.ImageManipulator.manipulate(photo.uri);
      preparedContext.crop(crop);
      if (crop.width < 1800)
        preparedContext.resize({ width: 1800, height: null });
      const preparedRef = await preparedContext.renderAsync();
      const preparedImage = await preparedRef.saveAsync({
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const imageUri = preparedImage.uri;
      pendingFiles.add(imageUri);
      const documentsDirectory = `${FileSystem.documentDirectory}identity-documents/`;
      await FileSystem.makeDirectoryAsync(documentsDirectory, {
        intermediates: true,
      });
      const savedUri = `${documentsDirectory}id-${Date.now()}.jpg`;
      pendingFiles.add(savedUri);
      await FileSystem.copyAsync({ from: imageUri, to: savedUri });
      void FileSystem.deleteAsync(imageUri, { idempotent: true }).catch(
        () => undefined,
      );
      const { recognizeText } =
        await import("@infinitered/react-native-mlkit-text-recognition");
      const result = await recognizeText(savedUri);
      let identity = extractIdentityFromOcr(result);
      const fullName = identity.name;
      let focusedName: string | null = null;
      const region = findIdentityRegion(result);
      if (region) {
        const source =
          await ImageManipulator.ImageManipulator.manipulate(
            savedUri,
          ).renderAsync();
        const originX = Math.max(0, Math.floor(region.left));
        const originY = Math.max(0, Math.floor(region.top));
        const width = Math.max(
          1,
          Math.min(
            source.width - originX,
            Math.ceil(region.right - region.left),
          ),
        );
        const height = Math.max(
          1,
          Math.min(
            source.height - originY,
            Math.ceil(region.bottom - region.top),
          ),
        );
        const context = ImageManipulator.ImageManipulator.manipulate(savedUri);
        context.crop({ originX, originY, width, height });
        if (width < 1500) context.resize({ width: 1500, height: null });
        const croppedRef = await context.renderAsync();
        const croppedImage = await croppedRef.saveAsync({
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        try {
          const focusedResult = await recognizeText(croppedImage.uri);
          const focusedIdentity = extractIdentityFromOcr(focusedResult);
          focusedName = focusedIdentity.name;
          identity = {
            name: focusedIdentity.name ?? identity.name,
            birthDate: focusedIdentity.birthDate ?? identity.birthDate,
            gender: focusedIdentity.gender ?? identity.gender,
          };
        } finally {
          void FileSystem.deleteAsync(croppedImage.uri, {
            idempotent: true,
          }).catch(() => undefined);
        }
      }
      // Small licence print is often misread glyph by glyph: re-read only the name line, enlarged,
      // then take the majority of the three independent reads (enlarged line first on ties).
      const nameFrame = findNameLineFrame(result);
      if (nameFrame) {
        const source = await ImageManipulator.ImageManipulator.manipulate(savedUri).renderAsync();
        const lineHeight = Math.max(1, nameFrame.bottom - nameFrame.top);
        const originX = Math.max(0, Math.floor(nameFrame.left - lineHeight * 1.2));
        const originY = Math.max(0, Math.floor(nameFrame.top - lineHeight * 0.6));
        const width = Math.max(1, Math.min(source.width - originX, Math.ceil(nameFrame.right - nameFrame.left + lineHeight * 2.4)));
        const height = Math.max(1, Math.min(source.height - originY, Math.ceil(lineHeight * 2.2)));
        // Two enlargements: ML Kit drops different syllables at different scales.
        const lineReads: (string | null)[] = [];
        for (const target of [400, 240]) {
          const context = ImageManipulator.ImageManipulator.manipulate(savedUri);
          context.crop({ originX, originY, width, height });
          if (height < target) context.resize({ width: null, height: target });
          const lineRef = await context.renderAsync();
          const lineImage = await lineRef.saveAsync({ compress: 1, format: ImageManipulator.SaveFormat.JPEG });
          try {
            lineReads.push(nameFromLineCrop(await recognizeText(lineImage.uri)));
          } finally {
            void FileSystem.deleteAsync(lineImage.uri, { idempotent: true }).catch(() => undefined);
          }
        }
        const voted = voteName([...lineReads, focusedName, fullName]);
        identity = { ...identity, name: voted ?? identity.name };
      }
      const previousUri = form.idDocument?.uri;
      setForm((previous) => ({
        ...previous,
        idDocument: {
          uri: savedUri,
          name: identity.name,
          birthDate: identity.birthDate,
          capturedAt: koreanNow(),
        },
        ...(identity.name ? { name: identity.name } : {}),
        ...(identity.birthDate ? { birthDate: identity.birthDate } : {}),
        ...(identity.gender ? { gender: identity.gender } : {}),
      }));
      pendingFiles.delete(savedUri);
      if (previousUri && previousUri !== savedUri)
        void FileSystem.deleteAsync(previousUri, { idempotent: true }).catch(
          () => undefined,
        );
      if (!identity.name && !identity.birthDate) {
        Alert.alert(
          "자료는 저장했습니다",
          "성명과 생년월일은 인식하지 못했습니다. 빛 반사를 피해서 다시 촬영해 주세요.",
        );
        return;
      }
      Alert.alert(
        "인식 완료",
        `성명: ${identity.name ?? "인식 안 됨"}\n생년월일: ${displayBirthDate(identity.birthDate) || "인식 안 됨"}`,
        [{ text: "확인" }],
      );
    } catch (error) {
      Alert.alert(
        "신분증 인식 오류",
        error instanceof Error
          ? error.message
          : "카메라 또는 문자 인식을 실행하지 못했습니다.",
      );
    } finally {
      await Promise.all([...pendingFiles].map((uri) => deleteLocalFile(uri)));
      setScannerBusy(false);
    }
  };

  if (!loaded || (!fontsLoaded && !fontError))
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#C9232D" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <View style={[styles.flex, isDark && darkStyles.appBackground]}>
        <SafeAreaView
          style={[styles.safe, { backgroundColor: clinicalTheme(isDark).page }]}
          edges={["top", "bottom"]}
        >
          <StatusBar style={isDark ? "light" : "dark"} />
          <KeyboardAvoidingView
            style={styles.flex}
            pointerEvents={deletingPatient ? "none" : "auto"}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 12}
          >
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={[styles.page, styles.pageUnderFloatingNav]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.noteAppHeader}>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}><View style={styles.noteBrand}><Text style={[styles.noteBrandNumber, { color: clinicalTheme(isDark).brand }]}>119</Text><Text style={[styles.noteBrandText, { color: clinicalTheme(isDark).muted }, { fontSize: 12, letterSpacing: 1.2 }]}>FIELD NOTE</Text></View>{!!affiliation && <Text style={{ color: clinicalTheme(isDark).ink, fontSize: 30, fontFamily: "Pretendard-Bold", letterSpacing: -0.6 }}>{affiliation}</Text>}{activeTab !== "memo" && <Text style={[styles.noteTitle, { color: clinicalTheme(isDark).ink }]}>{activeTab === "settings" ? "설정" : "다수사상자"}</Text>}</View>
                <Pressable ref={optionsButtonRef} accessibilityRole="button" accessibilityLabel="화면 및 기록 옵션" onPress={openOptions} style={[styles.noteHeaderMenu, { borderRadius: 22, backgroundColor: clinicalTheme(isDark).surface, borderWidth: StyleSheet.hairlineWidth, borderColor: clinicalTheme(isDark).border }]}><Ionicons name="ellipsis-horizontal" size={20} color={clinicalTheme(isDark).ink} /></Pressable>
              </View>
              {activeTab === "memo" ? (
                <PatientNoteScreen isDark={isDark} form={form} useWheelPicker={useWheelPicker}
                  patients={patients.map((patient, index) => ({ id: patient.id, label: (patient.id === activePatientId ? form.name : patient.form.name).trim() || `환자 ${index + 1}` }))} activePatientId={activePatientId}
                  measurements={snapshotMeasurements(form)}
                  busy={scannerBusy || deletingPatient} mediaBusy={mediaBusy} onSelectPatient={selectPatient} onAddPatient={() => selectPatient()} onDeletePatient={requestDeletePatient} onUpdate={update}
                  onScan={() => void openIdentityCamera()} onDeleteDocument={() => void deleteDocument()}
                  onSelectMeasurement={id => setForm(previous => selectMeasurement(previous, id))} onAddMeasurement={() => setForm(previous => addMeasurement(previous, `measurement-${Date.now()}`))}
                  onDeleteMeasurement={() => { const index = form.vitalMeasurements.findIndex(record => record.id === form.activeMeasurementId); Alert.alert("측정 삭제", `${index + 1}차 측정값과 측정 시각을 삭제할까요?`, [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: () => setForm(previous => deleteMeasurement(previous)) }]); }}
                  onMeasuredChange={(date, time) => setForm(previous => ({ ...previous, measuredDate: date, measuredTime: time, measuredAt: formatTimestamp(date, time) }))}
                  onVitalChange={(key, value) => setForm(previous => ({ ...previous, [key]: key === "bp" ? formatBloodPressure(previous.bp, value) : key === "bt" ? formatBodyTemperature(previous.bt, value) : value }))}
                  onHistoryChange={history => setForm(previous => ({ ...previous, history }))}
                  onDraw={field => { if (mediaBusy) { Alert.alert("녹취 진행 중", "녹취를 중지한 후 손글씨를 열어 주세요."); return; } setDrawingTarget(field); }}
                  onDeleteDrawing={deleteDrawing} onAppend={attachment => commitPatientUpdate(activePatientId, previous => ({ ...previous, attachments: previous.attachments.some(item => item.id === attachment.id) ? previous.attachments : [...previous.attachments, attachment] }))} onMediaBusyChange={setMediaBusy}
                  sender={sender}
                  medicalTerms={medicalTerms}
                  onRemoveAttachment={async attachment => {
                    // Persist the shorter list first so a failed write never leaves a record pointing at a deleted file.
                    await commitPatientUpdate(activePatientId, previous => ({ ...previous, attachments: previous.attachments.filter(item => item.id !== attachment.id) }));
                    await deleteLocalFile(attachment.uri);
                  }}
                />
              ) : activeTab === "settings" ? (
                <SettingsPage isDark={isDark} onThemeChange={changeTheme} />
              ) : activeTab === "mci" ? (
                <FuturePage isDark={isDark} />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
          <BottomNavigation
            activeTab={activeTab}
            isDark={isDark}
            onSelect={tab => { if (mediaBusy) { Alert.alert("기록 진행 중", "녹취를 중지하거나 촬영을 마친 후 이동해 주세요."); return; } setActiveTab(tab); }}
          />
          <HandwritingModal
            visible={drawingTarget !== null}
            isDark={isDark}
            title={
              drawingTarget === "historyDrawing" ? (medicalTerms ? "PHx" : "병력 손글씨") : medicalTerms ? "C/C" : "주증상 손글씨"
            }
            initialUri={drawingTarget ? form[drawingTarget] : null}
            onClose={() => void closeDrawing()}
            onSave={saveDrawing}
          />
        </SafeAreaView>
        <NoteModal
          visible={cameraVisible}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => !scannerBusy && setCameraVisible(false)}
        >
          <View style={styles.cameraPage}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              autofocus="on"
            />
            <View style={styles.cameraOverlay} onLayout={({ nativeEvent: { layout } }) => setCameraLayout({ width: layout.width, height: layout.height })}>
              <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={cameraLayout.width} height={cameraLayout.height}>
                <Path fill="rgba(0,0,0,0.65)" fillRule="evenodd" d={`M0 0H${cameraLayout.width}V${cameraLayout.height}H0Z M${guideFrame.x} ${guideTop + guideFrame.y}h${guideFrame.width}v${guideFrame.height}h-${guideFrame.width}Z`} />
              </Svg>
              <View style={styles.cameraHeader}>
                <Pressable
                  disabled={scannerBusy}
                  onPress={() => setCameraVisible(false)}
                  style={styles.cameraClose}
                >
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.cameraTitle}>신분증 촬영</Text>
                <View style={styles.cameraHeaderSpace} />
              </View>
              <View style={styles.guideWrap} onLayout={({ nativeEvent: { layout } }) => setGuideTop(layout.y)}>
                <View style={styles.guide} onLayout={({ nativeEvent: { layout } }) => setGuideFrame({ x: layout.x, y: layout.y, width: layout.width, height: layout.height })} />
                <Text style={styles.guideText}>
                  신분증이 테두리를 가득 채우게 가까이 촬영하세요
                </Text>
                <Text style={styles.guideSub}>
                  빛 반사를 피하고 글자가 선명할 때 촬영하세요
                </Text>
              </View>
              <Pressable
                disabled={scannerBusy}
                onPress={() => void captureIdentity()}
                style={[
                  styles.shutterOuter,
                  scannerBusy && styles.disabledButton,
                ]}
              >
                <View style={styles.shutterInner}>
                  {scannerBusy && <ActivityIndicator color="#C9232D" />}
                </View>
              </Pressable>
            </View>
          </View>
        </NoteModal>
        {Platform.OS === "ios" ? (
          <RecordOptionsPopover
            visible={optionsVisible}
            isDark={isDark}
            anchor={optionsAnchor}
            affiliation={affiliation}
            senderRank={sender.rank}
            senderName={sender.name}
            useWheelPicker={useWheelPicker}
            wheelPreferenceReady={wheelPreferenceReady}
            showReset={activeTab === "memo"}
            onThemeChange={changeTheme}
            onWheelChange={value => void changeWheelPreference(value)}
            medicalTerms={medicalTerms}
            onMedicalTermsChange={value => void changeMedicalTerms(value)}
            onAffiliationSaved={setSender}
            onReset={reset}
            onClose={() => setOptionsVisible(false)}
          />
        ) : <CenteredDialog visible={optionsVisible} isDark={isDark} title="기록 옵션" onClose={() => setOptionsVisible(false)}>
          {optionsVisible && <RecordAffiliation isDark={isDark} onSaved={setSender} />}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: clinicalTheme(isDark).field, borderRadius: 14, paddingLeft: 16, minHeight: 60 }}>
            <Text style={{ fontSize: 16, fontFamily: "Pretendard-Medium", color: clinicalTheme(isDark).ink }}>다크 모드</Text>
            <SquishThemeSwitch isDark={isDark} checked={isDark} onChange={changeTheme} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: clinicalTheme(isDark).field, borderRadius: 14, paddingLeft: 16, minHeight: 60 }}>
            <View style={{ flex: 1, gap: 4, paddingVertical: 10 }}>
              <Text style={{ fontSize: 16, fontFamily: "Pretendard-Medium", color: clinicalTheme(isDark).ink }}>휠 피커 사용</Text>
              <Text style={{ fontSize: 13, color: clinicalTheme(isDark).muted }}>{useWheelPicker ? "사용한다" : "사용하지 않는다 · 숫자 직접 입력"}</Text>
            </View>
            <SquishThemeSwitch isDark={isDark} accessibilityLabel="휠 피커 사용" checked={useWheelPicker} disabled={!wheelPreferenceReady} onChange={value => void changeWheelPreference(value)} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: clinicalTheme(isDark).field, borderRadius: 14, paddingLeft: 16, minHeight: 60 }}>
            <View style={{ flex: 1, gap: 4, paddingVertical: 10 }}>
              <Text style={{ fontSize: 16, fontFamily: "Pretendard-Medium", color: clinicalTheme(isDark).ink }}>의학용어로 표시</Text>
              <Text style={{ fontSize: 13, color: clinicalTheme(isDark).muted }}>병력·검토사항을 HTN, DM처럼</Text>
            </View>
            <SquishThemeSwitch isDark={isDark} accessibilityLabel="의학용어로 표시" checked={medicalTerms} onChange={value => void changeMedicalTerms(value)} />
          </View>
          {activeTab === "memo" && <Pressable accessibilityRole="button" onPress={() => { setOptionsVisible(false); reset(); }} style={({ pressed }) => ({ minHeight: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 16, fontFamily: "Pretendard-Medium", color: clinicalTheme(isDark).danger }}>환자 기록 전체 초기화</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" onPress={() => setOptionsVisible(false)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 16, color: clinicalTheme(isDark).muted }}>닫기</Text></Pressable>
        </CenteredDialog>}
        <NoteDialogHost isDark={isDark} />
        {showIntro && (
          <Animated.View
            style={[styles.intro, { opacity: introOpacity }]}
          >
            <WebView
              source={{ uri: SPLASH_URI }}
              allowingReadAccessToURL={FileSystem.bundleDirectory ?? undefined}
              style={styles.introWebView}
              containerStyle={styles.introWebView}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
              scrollEnabled={false}
              overScrollMode="never"
              setSupportMultipleWindows={false}
              onMessage={({ nativeEvent }) => {
                if (nativeEvent.data === "complete") finishIntro();
              }}
              onError={finishIntro}
            />
          </Animated.View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

function SettingsPage({
  isDark,
  onThemeChange,
}: {
  isDark: boolean;
  onThemeChange: (dark: boolean) => void;
}) {
  return (
    <View style={[styles.card, isDark && darkStyles.card]}>
      <View style={styles.pageHeading}>
        <Ionicons
          name="settings-outline"
          size={22}
          color={isDark ? "#FF6972" : "#C9232D"}
        />
        <Text style={[styles.settingsTitle, isDark && darkStyles.primaryText]}>
          설정
        </Text>
      </View>
      <Text style={[styles.settingsLabel, isDark && darkStyles.secondaryText]}>
        화면
      </Text>
      <View style={[styles.modeOption, { backgroundColor: clinicalTheme(isDark).field }]}>
        <View style={styles.modeText}>
          <Text style={[styles.modeTitle, isDark && darkStyles.primaryText]}>
            다크 모드
          </Text>
          <Text
            style={[styles.modeCaption, isDark && darkStyles.secondaryText]}
          >
            {isDark ? "켜짐" : "꺼짐"}
          </Text>
        </View>
        <SquishThemeSwitch isDark={isDark} checked={isDark} onChange={onThemeChange} />
      </View>
    </View>
  );
}
function FuturePage({ isDark }: { isDark: boolean }) {
  return (
    <View style={[styles.card, styles.futureCard, isDark && darkStyles.card]}>
      <View style={styles.futureIcon}>
        <Ionicons name="people-outline" size={32} color="#C9232D" />
      </View>
      <Text style={[styles.futureTitle, isDark && darkStyles.primaryText]}>
        다수사상자
      </Text>
      <Text style={[styles.futureCaption, isDark && darkStyles.secondaryText]}>
        환자 분류·번호·이송 현황을 관리할 수 있도록 준비된 화면입니다.
      </Text>
      <View style={[styles.futureBadge, isDark && darkStyles.softButton]}>
        <Text style={[styles.futureBadgeText, isDark && darkStyles.accentText]}>
          개발 예정
        </Text>
      </View>
    </View>
  );
}
function BottomNavigation({
  activeTab, isDark, onSelect,
}: {
  activeTab: "memo" | "mci" | "settings";
  isDark: boolean;
  onSelect: (tab: "memo" | "mci" | "settings") => void;
}) {
  const tabs = [
    { key: "memo" as const, label: "메모", icon: "document-text-outline" as const, selectedIcon: "document-text" as const },
    { key: "mci" as const, label: "다수사상자", icon: "people-outline" as const, selectedIcon: "people" as const },
    { key: "settings" as const, label: "설정", icon: "settings-outline" as const, selectedIcon: "settings" as const },
  ];
  // A capsule tab bar floating above the content, which scrolls underneath it (both platforms).
  // Absolute children ignore the SafeAreaView padding, so lift it above the home indicator / system nav bar.
  const t = clinicalTheme(isDark);
  const insets = useSafeAreaInsets();
  return <View pointerEvents="box-none" style={[styles.floatingNavLayer, { paddingBottom: insets.bottom + 8 }]}>
      <View accessibilityRole="tablist" style={[styles.floatingNav, { backgroundColor: isDark ? "rgba(44,45,50,0.96)" : "rgba(250,249,247,0.97)", borderColor: t.border }]}>
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          const color = selected ? t.accent : t.ink;
          return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} onPress={() => onSelect(tab.key)} style={[styles.floatingNavItem, selected && { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)" }]}>
            <Ionicons name={selected ? tab.selectedIcon : tab.icon} size={22} color={color} />
            <Text style={[styles.floatingNavText, { color }]}>{tab.label}</Text>
          </Pressable>;
        })}
      </View>
    </View>;
}
function HandwritingModal({
  visible,
  isDark,
  title,
  initialUri,
  onClose,
  onSave,
}: {
  visible: boolean;
  isDark: boolean;
  title: string;
  initialUri: string | null;
  onClose: () => void;
  onSave: (uri: string) => Promise<void>;
}) {
  const Alert = { alert: useNoteAlert() };
  const [paths, setPaths] = useState<
    { d: string; color: string; width: number }[]
  >([]);
  const [eraserEnabled, setEraserEnabled] = useState(false);
  const eraserEnabledRef = useRef(false);
  const [eraserWidth, setEraserWidth] = useState(44);
  const eraserWidthRef = useRef(44);
  const [eraserCursor, setEraserCursor] = useState({
    x: 0,
    y: 0,
    visible: false,
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const captureUri = useRef<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const canvasRef = useRef<View>(null);
  const inkColorRef = useRef(isDark ? "#FFFFFF" : "#132622");
  const canvasColorRef = useRef(clinicalTheme(isDark).surface);
  inkColorRef.current = isDark ? "#FFFFFF" : "#132622";
  canvasColorRef.current = clinicalTheme(isDark).surface;
  const activePath = useRef(-1);
  useEffect(() => {
    if (visible) {
      captureUri.current = null;
      setSaveFailed(false);
      setPaths([]);
      setEraserEnabled(false);
      eraserEnabledRef.current = false;
      setEraserCursor({ x: 0, y: 0, visible: false });
      void AsyncStorage.getItem(ERASER_SIZE_KEY).then((saved) => {
        const parsed = Number(saved);
        if (!Number.isFinite(parsed)) return;
        const restored = Math.max(16, Math.min(200, parsed));
        setEraserWidth(restored);
        eraserWidthRef.current = restored;
      });
    }
  }, [visible]);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        if (eraserEnabledRef.current)
          setEraserCursor({ x: locationX, y: locationY, visible: true });
        setPaths((previous) => {
          activePath.current = previous.length;
          return [
            ...previous,
            {
              d: `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`,
              color: eraserEnabledRef.current
                ? canvasColorRef.current
                : inkColorRef.current,
              width: eraserEnabledRef.current ? eraserWidthRef.current : 3.2,
            },
          ];
        });
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        if (eraserEnabledRef.current)
          setEraserCursor({ x: locationX, y: locationY, visible: true });
        setPaths((previous) =>
          previous.map((path, index) =>
            index === activePath.current
              ? {
                  ...path,
                  d: `${path.d} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`,
                }
              : path,
          ),
        );
      },
      onPanResponderRelease: () => {
        activePath.current = -1;
        setEraserCursor((previous) => ({ ...previous, visible: false }));
      },
      onPanResponderTerminate: () => {
        activePath.current = -1;
        setEraserCursor((previous) => ({ ...previous, visible: false }));
      },
    }),
  ).current;
  const save = async () => {
    if (savingRef.current || (paths.length === 0 && !initialUri) || !canvasRef.current) return;
    savingRef.current = true;
    try {
      setSaving(true);
      const uri = captureUri.current ?? await captureRef(canvasRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      captureUri.current = uri;
      await onSave(uri);
      captureUri.current = null;
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
      Alert.alert("저장 오류", "필기는 유지됩니다. 저장 공간을 확인한 뒤 저장 재시도를 눌러 주세요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <NoteModal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => { if (!savingRef.current) onClose(); }}
    >
      <SafeAreaView
        style={[styles.handwritingPage, { backgroundColor: clinicalTheme(isDark).page }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.handwritingHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="손글씨 닫기"
            disabled={saving}
            onPress={() => { if (!savingRef.current) onClose(); }}
            style={[styles.handwritingRound, { backgroundColor: clinicalTheme(isDark).field }]}
          >
            <Ionicons name="close" size={20} color={clinicalTheme(isDark).ink} />
          </Pressable>
          <Text style={[styles.handwritingTitle, { color: clinicalTheme(isDark).ink }]}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saveFailed ? "손글씨 저장 재시도" : "손글씨 저장"}
            disabled={(paths.length === 0 && !initialUri) || saving}
            onPress={() => void save()}
            style={[
              saveFailed ? styles.handwritingRetry : styles.handwritingRound,
              { backgroundColor: saveFailed ? clinicalTheme(isDark).danger : clinicalTheme(isDark).accent },
              (paths.length === 0 && !initialUri) || saving ? styles.disabledButton : undefined,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={clinicalTheme(isDark).surface} />
            ) : saveFailed ? (
              <Text style={[styles.handwritingRetryText, { color: clinicalTheme(isDark).surface }]}>재시도</Text>
            ) : (
              <Ionicons name="checkmark" size={21} color={clinicalTheme(isDark).surface} />
            )}
          </Pressable>
        </View>
        <View
          ref={canvasRef}
          pointerEvents={saving || saveFailed ? "none" : "auto"}
          collapsable={false}
          style={[
            styles.handwritingCanvas,
            { backgroundColor: clinicalTheme(isDark).surface, borderColor: clinicalTheme(isDark).border },
          ]}
          {...panResponder.panHandlers}
        >
          {initialUri && (
            <Image
              source={{ uri: initialUri }}
              resizeMode="stretch"
              style={StyleSheet.absoluteFill}
            />
          )}
          <Svg width="100%" height="100%">
            {paths.map((path, index) => (
              <Path
                key={`${index}-${path.d.length}`}
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth={path.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {eraserEnabled && eraserCursor.visible && (
              <Circle
                cx={eraserCursor.x}
                cy={eraserCursor.y}
                r={eraserWidth / 2}
                fill={
                  isDark ? "rgba(103,210,188,0.12)" : "rgba(8,127,109,0.08)"
                }
                stroke={isDark ? "#FF6972" : "#C9232D"}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}
          </Svg>
        </View>
        {eraserEnabled && (
          <EraserSizeSlider
            value={eraserWidth}
            isDark={isDark}
            onChange={(value) => {
              setEraserWidth(value);
              eraserWidthRef.current = value;
              void AsyncStorage.setItem(ERASER_SIZE_KEY, String(value));
            }}
          />
        )}
        <View style={[styles.handwritingTools, { backgroundColor: clinicalTheme(isDark).surface, borderColor: clinicalTheme(isDark).border }]}>
          <View style={styles.handwritingMode}>
            <RecordTabs
              isDark={isDark}
              label="펜과 지우개 선택"
              selectionRole="radio"
              options={[{ id: "pen", label: "펜" }, { id: "eraser", label: "지우개" }]}
              selectedId={eraserEnabled ? "eraser" : "pen"}
              disabled={saving || saveFailed}
              onSelect={(id) => {
                eraserEnabledRef.current = id === "eraser";
                setEraserEnabled(id === "eraser");
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="실행 취소"
            disabled={saving || saveFailed || paths.length === 0}
            onPress={() => setPaths((previous) => previous.slice(0, -1))}
            style={[styles.handwritingRound, { backgroundColor: clinicalTheme(isDark).field }, paths.length === 0 && styles.disabledButton]}
          >
            <Ionicons name="arrow-undo" size={19} color={clinicalTheme(isDark).ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="손글씨 모두 지우기"
            disabled={paths.length === 0}
            onPress={() => setPaths([])}
            style={[styles.handwritingRound, { backgroundColor: clinicalTheme(isDark).field }, paths.length === 0 && styles.disabledButton]}
          >
            <Ionicons name="trash-outline" size={19} color={clinicalTheme(isDark).danger} />
          </Pressable>
        </View>
      </SafeAreaView>
    </NoteModal>
  );
}

function EraserSizeSlider({
  value,
  isDark,
  onChange,
}: {
  value: number;
  isDark: boolean;
  onChange: (value: number) => void;
}) {
  const min = 16;
  const max = 200;
  const trackWidth = useRef(1);
  const gestureStartValue = useRef(value);
  const [dragValue, setDragValue] = useState(value);
  const dragValueRef = useRef(value);
  useEffect(() => {
    setDragValue(value);
    dragValueRef.current = value;
  }, [value]);
  const updateFromPosition = (position: number) => {
    const ratio = Math.max(0, Math.min(1, position / trackWidth.current));
    const nextValue = min + ratio * (max - min);
    dragValueRef.current = nextValue;
    setDragValue(nextValue);
  };
  const updateFromDistance = (distance: number) => {
    const valuePerPixel = (max - min) / trackWidth.current;
    const nextValue = Math.max(
      min,
      Math.min(max, gestureStartValue.current + distance * valuePerPixel),
    );
    dragValueRef.current = nextValue;
    setDragValue(nextValue);
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        updateFromPosition(event.nativeEvent.locationX);
        gestureStartValue.current = dragValueRef.current;
      },
      onPanResponderMove: (_, gesture) => updateFromDistance(gesture.dx),
      onPanResponderRelease: () => onChange(Math.round(dragValueRef.current)),
      onPanResponderTerminate: () => onChange(Math.round(dragValueRef.current)),
    }),
  ).current;
  const progress = (dragValue - min) / (max - min);
  return (
    <View style={[styles.eraserSizeBar, isDark && darkStyles.eraserSizeBar]}>
      <View style={styles.eraserSizePreviewFrame}>
        <MaterialCommunityIcons
          name="eraser"
          size={25}
          color={isDark ? "#FF6972" : "#C9232D"}
        />
      </View>
      <View style={styles.eraserSliderBody}>
        <View style={styles.eraserSizeLabelRow}>
          <Text
            style={[
              styles.eraserSizeLabel,
              isDark && darkStyles.eraserSizeLabel,
            ]}
          >
            지우개 크기
          </Text>
          <Text style={styles.eraserSizeValue}>{Math.round(dragValue)}px</Text>
        </View>
        <View
          {...panResponder.panHandlers}
          onLayout={(event) => {
            trackWidth.current = event.nativeEvent.layout.width;
          }}
          style={styles.eraserSliderTouch}
        >
          <View
            style={[
              styles.eraserSliderTrack,
              isDark && darkStyles.eraserSliderTrack,
            ]}
          >
            <View
              style={[styles.eraserSliderFill, { width: `${progress * 100}%` }]}
            />
            <View
              style={[styles.eraserSliderThumb, { left: `${progress * 100}%` }]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const PRETENDARD_BY_WEIGHT = {
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  semiBold: "Pretendard-SemiBold",
  bold: "Pretendard-Bold",
} as const;

function withPretendard<T extends StyleSheet.NamedStyles<T>>(source: T): T {
  return Object.fromEntries(
    Object.entries(normalizeDesign(source)).map(([name, style]) => {
      const typedStyle = style as Record<string, unknown>;
      if (!("fontSize" in typedStyle)) return [name, style];
      const numericWeight = Number(typedStyle.fontWeight ?? 400);
      const fontFamily =
        numericWeight >= 700
          ? PRETENDARD_BY_WEIGHT.bold
          : numericWeight >= 600
            ? PRETENDARD_BY_WEIGHT.semiBold
            : numericWeight >= 500
              ? PRETENDARD_BY_WEIGHT.medium
              : PRETENDARD_BY_WEIGHT.regular;
      return [name, { ...typedStyle, fontFamily, fontWeight: undefined }];
    }),
  ) as T;
}

const styles = StyleSheet.create(
  withPretendard({
    birthInputRow: { flexDirection: "row", gap: 8 },
    birthInput: { flex: 1 },
    ageDisplay: {
      width: 82,
      height: 46,
      borderRadius: 11,
      backgroundColor: "#F2F2F7",
      alignItems: "center",
      justifyContent: "center",
    },
    agePlaceholder: { color: "#8E8E93", fontSize: 12, fontWeight: "600" },
    documentEqualWidth: { flex: 1, width: "auto" },
    documentCardEqualWidth: { width: "100%" },
    memoHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    drawButton: {
      minHeight: 44,
      borderRadius: 9,
      backgroundColor: "transparent",
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    drawButtonText: { color: clinicalTheme(false).accent, fontSize: 13, fontWeight: "500" },
    drawingAttachment: {
      width: "100%",
      marginTop: 9,
      borderRadius: 12,
    },
    drawingAttachmentContent: {
      flex: 1,
      width: "100%",
      borderRadius: 12,
      backgroundColor: "#F9F9FB",
      overflow: "hidden",
    },
    drawingPreview: { flex: 1 },
    drawingThumbnail: {
      width: "100%",
      height: "100%",
      backgroundColor: "#FFFFFF",
    },
    drawingLabel: {
      position: "absolute",
      right: 9,
      top: 9,
      minHeight: 27,
      borderRadius: 8,
      paddingHorizontal: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      opacity: 0.62,
      backgroundColor: "rgba(15,34,30,0.62)",
    },
    drawingLabelText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
    drawingDelete: {
      width: 46,
      alignItems: "center",
      justifyContent: "center",
      borderLeftWidth: 1,
      borderLeftColor: "#D1D1D6",
      backgroundColor: "#FFFFFF",
    },
    handwritingPage: {
      flex: 1,
      paddingHorizontal: 16,
    },
    handwritingHeader: {
      height: 62,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    handwritingRound: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    handwritingRetry: { minWidth: 72, height: 44, borderRadius: 22, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
    handwritingRetryText: { fontSize: 15, fontFamily: "Pretendard-SemiBold" },
    handwritingMode: { flex: 1, minWidth: 0 },
    handwritingTitle: { fontSize: 17, fontFamily: "Pretendard-SemiBold" },
    handwritingCanvas: {
      flex: 1,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#D4DEDB",
    },
    handwritingTools: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginVertical: 10,
      padding: 6,
      borderRadius: 30,
      borderWidth: StyleSheet.hairlineWidth,
    },
    eraserSizeBar: {
      height: 72,
      marginTop: 10,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    eraserSizePreviewFrame: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    eraserSliderBody: { flex: 1 },
    eraserSizeLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    eraserSizeLabel: {
      color: "#636366",
      fontSize: 11,
      fontWeight: "800",
    },
    eraserSizeValue: { color: clinicalTheme(false).accent, fontSize: 11, fontWeight: "900" },
    eraserSliderTouch: { height: 30, justifyContent: "center" },
    eraserSliderTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: "#DCE7E4",
    },
    eraserSliderFill: {
      height: 5,
      borderRadius: 3,
      backgroundColor: "#C9232D",
    },
    eraserSliderThumb: {
      position: "absolute",
      top: -6,
      width: 17,
      height: 17,
      marginLeft: -8.5,
      borderRadius: 9,
      borderWidth: 3,
      borderColor: "#FFFFFF",
      backgroundColor: "#C9232D",
      shadowColor: "#000000",
      shadowOpacity: 0.22,
      shadowRadius: 3,
      elevation: 2,
    },
    swipeContainer: {
      overflow: "hidden",
      backgroundColor: "#C62828",
    },
    swipeContent: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },
    swipeDeleteAction: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "flex-end",
      justifyContent: "center",
      paddingRight: 18,
    },
    swipeDeleteText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
      marginTop: 3,
      textAlign: "center",
    },
    flex: { flex: 1 },
    noteAppHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingTop: 8, paddingBottom: 10 },
    noteBrand: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
    noteBrandNumber: { fontSize: 13, fontWeight: "700", letterSpacing: -.4 },
    noteBrandText: { fontSize: 11, fontWeight: "500", letterSpacing: 1.6 },
    noteTitle: { fontSize: 30, fontWeight: "600", letterSpacing: -1.2 },
    noteHeaderMenu: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    memoPageHeading: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 12, marginBottom: 2, paddingHorizontal: 4 },
    memoPageTitle: { fontSize: 30, fontWeight: "700", color: "#1C1C1E", letterSpacing: -1 },
    memoPageCount: { fontSize: 14, color: "#8E8E93" },
    patientSheet: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
    patientContent: { padding: 10, gap: 12 },
    patientTabHeader: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    patientTabCaption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 2 },
    patientCaptionText: { fontSize: 12, color: "#636366" },
    patientNavigation: { flexDirection: "row", alignItems: "center", gap: 8 },
    patientUtilities: { flexDirection: "row", borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 4 },
    measurementActions: { flexDirection: "row", alignItems: "center" },
    measurementAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 3 },
    measurementActionText: { fontSize: 12, fontWeight: "500" },
    measurementSheet: { overflow: "hidden" },
    measurementTabHeader: { marginBottom: 14 },
    measurementContent: { padding: 0 },
    vitalRow: { width: "48.6%", flexDirection: "row", alignItems: "center", minHeight: 76, paddingLeft: 10 },
    vitalCaption: { width: 38, gap: 3 },
    vitalRowInput: { flex: 1, paddingHorizontal: 6, textAlign: "right" },
    mapSummary: { marginTop: 10, fontSize: 13 },
    identityRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
    identityName: { flex: 1, minWidth: 0 },
    identityGender: { width: 116 },
    genderControl: { flexDirection: "row", padding: 3 },
    genderOption: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 7 },
    genderText: { fontSize: 16 },
    birthEntry: { flexDirection: "row", alignItems: "center" },
    birthEntryInput: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, color: "#1C1C1E", fontVariant: ["tabular-nums"] },
    birthEntryAge: { borderLeftWidth: 1, paddingHorizontal: 10, fontSize: 16 },
    historySummary: { paddingVertical: 12, marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    historySummaryText: { fontSize: 14, lineHeight: 21 },
    patientAddButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 22 },
    patientDeleteButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
    patientDeleteText: { color: "#FF453A", fontSize: 14, fontWeight: "500" },
    safe: { flex: 1, backgroundColor: clinicalTheme(false).page },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    intro: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      backgroundColor: "#0A0A0A",
    },
    introWebView: {
      flex: 1,
      backgroundColor: "#0A0A0A",
    },
    page: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 38, gap: 16 },
    pageUnderFloatingNav: { paddingBottom: 110 },
    floatingNavLayer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 6 },
    floatingNav: { flexDirection: "row", width: "86%", maxWidth: 380, height: 64, borderRadius: 32, padding: 4, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    floatingNavItem: { flex: 1, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 2 },
    floatingNavText: { fontSize: 11, fontFamily: "Pretendard-Medium" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 1,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
    title: {
      flexShrink: 1,
      color: "#1C1C1E",
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.7,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#E5E5EA",
      alignItems: "center",
      justifyContent: "center",
    },
    resetButton: {
      backgroundColor: "#E5E5EA",
      borderRadius: 22,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    resetText: { color: "#48484A", fontWeight: "700", fontSize: 13 },
    card: {
      backgroundColor: clinicalTheme(false).surface,
      borderRadius: 14,
      borderWidth: 0,
      borderColor: "#E8EEEC",
      padding: 14,
      shadowColor: "#000000",
      shadowOpacity: 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 0,
    },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 13,
    },
    step: {
      width: 36,
      height: 36,
      backgroundColor: "#E8F4F2",
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },
    stepText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
    sectionSubtitle: { color: "#74838A", fontSize: 11, marginLeft: 8, flexShrink: 1 },
    patientName: { fontSize: 16, fontWeight: "400", minHeight: 52, marginBottom: 0 },
    sectionTitle: {
      color: "#1C1C1E",
      fontSize: 17,
      lineHeight: 23,
      fontWeight: "600",
      includeFontPadding: false,
    },
    memoInput: {
      minHeight: 96,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: "#D1D1D6",
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingTop: 11,
      paddingBottom: 11,
      color: "#1C1C1E",
      fontSize: 17,
      lineHeight: 25,
      fontWeight: "400",
      includeFontPadding: false,
    },
    memoInputTall: { minHeight: 88 },
    onsetSection: { marginBottom: 13 },
    onsetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    onsetDayRow: { flexDirection: "row", gap: 5 },
    onsetDayButton: {
      height: 42,
      minWidth: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 9,
    },
    onsetDayText: { color: "#636366", fontSize: 12, fontWeight: "800" },
    onsetInput: {
      flex: 0.66,
      height: 46,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      color: "#1C1C1E",
      fontSize: 16,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      textAlign: "left",
      textAlignVertical: "center",
      includeFontPadding: false,
      paddingHorizontal: 12,
      paddingVertical: 0,
    },
    onsetDateBox: {
      flex: 1.56,
      height: 46,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 4,
      paddingHorizontal: 12,
    },
    onsetDateField: {
      width: 104,
      height: 44,
      color: "#1C1C1E",
      fontSize: 16,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      textAlign: "left",
      textAlignVertical: "center",
      includeFontPadding: false,
      paddingLeft: 0,
      paddingRight: 0,
      paddingVertical: 0,
    },
    onsetDateFieldEmpty: { flex: 1, width: "auto" },
    onsetWeekdayInline: {
      color: "#1C1C1E",
      fontSize: 16,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      lineHeight: 20,
      includeFontPadding: false,
    },
    onsetNowButton: {
      width: 60,
      height: 46,
      borderRadius: 11,
      backgroundColor: "#C9232D",
      alignItems: "center",
      justifyContent: "center",
    },
    onsetElapsedBadge: {
      alignSelf: "flex-end",
      minHeight: 29,
      borderRadius: 9,
      backgroundColor: "#F2F2F7",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      marginTop: 8,
    },
    onsetElapsed: {
      color: clinicalTheme(false).accent,
      fontSize: 12,
      fontWeight: "700",
    },
    memoQuickOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 13,
    },
    historyOptions: {
      gap: 8,
      marginTop: 10,
      marginBottom: 13,
    },
    historyChipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    historyChip: {
      minHeight: 36,
      borderRadius: 18,
      paddingHorizontal: 13,
    },
    historyChipText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },
    historyChildChip: {
      backgroundColor: "#FCEDEF",
      borderColor: "#C9232D",
      borderWidth: 1.5,
    },
    historyChildChipText: { color: "#9E1623" },
    historyParentExpanded: {
      backgroundColor: "#E5E5EA",
      borderColor: "#C7C7CC",
    },
    historyParentExpandedText: { color: "#8E8E93" },
    singleInput: {
      height: 46,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      paddingHorizontal: 12,
      paddingVertical: 0,
      color: "#1C1C1E",
      fontSize: 16,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      textAlignVertical: "center",
      includeFontPadding: false,
      marginBottom: 10,
    },
    birthLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    birthLabel: { marginBottom: 5 },
    ageBadge: {
      minHeight: 24,
      borderRadius: 8,
      backgroundColor: "#F2F2F7",
      paddingHorizontal: 9,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 5,
    },
    ageText: { color: clinicalTheme(false).accent, fontSize: 12, fontWeight: "700" },
    segmentRow: { flexDirection: "row", gap: 8 },
    segmentButton: {
      flex: 1,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      alignItems: "center",
      justifyContent: "center",
    },
    documentRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    scanButton: {
      minHeight: 51,
      borderRadius: 11,
      backgroundColor: "#F0F8F6",
      marginTop: 10,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    scanButtonCompact: { flex: 1, marginTop: 0 },
    disabledButton: { opacity: 0.62 },
    scanTitle: { color: "#3A3A3C", fontSize: 12, fontWeight: "700" },
    scanCaption: { color: "#8E8E93", fontSize: 10, marginTop: 2 },
    documentSwipe: {
      width: 108,
      height: 64,
      borderRadius: 11,
      overflow: "hidden",
      backgroundColor: "#C62828",
    },
    documentDelete: {
      ...StyleSheet.absoluteFillObject,
      paddingRight: 10,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    documentDeleteText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "800",
      marginTop: 1,
    },
    documentCard: {
      width: 108,
      height: 64,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      overflow: "hidden",
    },
    documentPreviewButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    documentViewText: { color: "#1C1C1E", fontSize: 13, fontWeight: "900" },
    previewBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.94)",
      alignItems: "center",
      justifyContent: "center",
    },
    previewImage: { width: "96%", height: "90%" },
    previewClose: {
      position: "absolute",
      top: 52,
      right: 20,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(0,0,0,0.62)",
      alignItems: "center",
      justifyContent: "center",
    },
    swipeHint: {
      color: "#8E8E93",
      fontSize: 9,
      textAlign: "right",
      marginTop: 5,
    },
    chip: {
      minHeight: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    chipText: {
      color: "#636366",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      includeFontPadding: false,
    },
    selectedButton: { backgroundColor: "#C9232D", borderColor: "#C9232D" },
    selectedText: { color: "#FFFFFF" },
    detailLabel: { marginTop: 14 },
    label: {
      color: "#636366",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      includeFontPadding: false,
      marginBottom: 7,
    },
    timeRow: { flexDirection: "row", gap: 7 },
    timeDisplay: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      backgroundColor: "#F9F9FB",
      borderWidth: 1,
      borderColor: "#D1D1D6",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    timeValue: {
      color: "#1C1C1E",
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      includeFontPadding: false,
    },
    placeholder: {
      color: "#A0AAA8",
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      includeFontPadding: false,
    },
    nowButton: {
      width: 70,
      height: 46,
      borderRadius: 12,
      backgroundColor: "#C9232D",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    nowText: {
      color: "#FFFFFF",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      includeFontPadding: false,
    },
    divider: { height: 1, backgroundColor: "#E5E5EA", marginVertical: 12 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 7,
    },
    vitalBox: {
      width: "31.8%",
      borderWidth: 0,
      borderTopWidth: 0,
      borderColor: "#D1D1D6",
      backgroundColor: "#F2F2F7",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingTop: 11,
      paddingBottom: 10,
      minHeight: 112,
    },
    vitalBoxFocused: { backgroundColor: "#FCEDEF", borderTopColor: "#C9232D" },
    vitalTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 20,
    },
    vitalLabel: {
      color: "#636366",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "500",
      includeFontPadding: false,
    },
    unit: {
      color: "#8E8E93",
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "500",
      includeFontPadding: false,
    },
    vitalValueRow: {
      height: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    vitalInput: {
      flex: 1,
      minWidth: 0,
      color: "#1C1C1E",
      fontSize: 16,
      fontWeight: "400",
      height: 44,
      paddingHorizontal: 0,
      paddingVertical: 0,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    mapBadge: {
      minHeight: 23,
      borderRadius: 7,
      backgroundColor: "#F2F2F7",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 3,
      flexWrap: "wrap",
      marginBottom: 1,
    },
    mapBadgeEmpty: { backgroundColor: "#F2F2F7" },
    mapBadgeDanger: {
      backgroundColor: "#FDE8E7",
      borderWidth: 1,
      borderColor: "#F4B4B0",
    },
    mapLabel: {
      color: clinicalTheme(false).accent,
      fontSize: 10,
      fontWeight: "800",
      marginRight: 6,
    },
    mapValue: { color: "#3A3A3C", fontSize: 14, fontWeight: "700" },
    mapEmpty: { color: "#9AA6A3" },
    mapUnit: { color: "#8E8E93", fontSize: 9, marginLeft: 3 },
    dangerText: { color: "#C62828" },
    dangerSubText: { color: "#A94343" },
    settingsTitle: { color: "#1C1C1E", fontSize: 21, fontWeight: "900" },
    settingsLabel: {
      color: "#636366",
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 1,
    },
    pageHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 12,
    },
    modeOption: {
      minHeight: 66,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: "#D1D1D6",
      backgroundColor: "#F9F9FB",
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    modeText: { flex: 1 },
    modeTitle: { color: "#1C1C1E", fontSize: 15, fontWeight: "900" },
    modeCaption: { color: "#8E8E93", fontSize: 11, marginTop: 3 },
    bottomNav: {
      height: 60,
      paddingBottom: 2,
      flexDirection: "row",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#D1D1D6",
      backgroundColor: "#FFFFFF",
    },
    bottomNavItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    bottomNavText: { color: "#8E8E93", fontSize: 10, fontWeight: "700" },
    bottomNavTextActive: { color: clinicalTheme(false).accent, fontWeight: "900" },
    futureCard: {
      minHeight: 360,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 30,
    },
    futureIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
      backgroundColor: "#F2F2F7",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    futureTitle: { color: "#1C1C1E", fontSize: 24, fontWeight: "900" },
    futureCaption: {
      color: "#8E8E93",
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 8,
    },
    futureBadge: {
      backgroundColor: "#E5E5EA",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginTop: 18,
    },
    futureBadgeText: { color: clinicalTheme(false).accent, fontSize: 12, fontWeight: "900" },
    cprElapsedTime: {
      color: "#D23B58",
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 0.4,
      fontVariant: ["tabular-nums"],
    },
    compressionCountdown: {
      color: clinicalTheme(false).accent,
      fontSize: 10,
      fontWeight: "900",
      marginTop: 3,
      fontVariant: ["tabular-nums"],
    },
    compressionCountdownDone: { color: "#D23B58" },
    cameraPage: { flex: 1, backgroundColor: "#07110F" },
    cameraOverlay: {
      flex: 1,
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 34,
    },
    cameraHeader: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 52,
    },
    cameraClose: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    cameraTitle: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "900",
      textShadowColor: "rgba(0,0,0,0.7)",
      textShadowRadius: 4,
    },
    cameraHeaderSpace: { width: 42 },
    guideWrap: { width: "100%", alignItems: "center" },
    guide: {
      width: "88%",
      aspectRatio: 1.58,
      borderWidth: 2,
      borderColor: "#FF6972",
      borderRadius: 0,
    },
    guideText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
      marginTop: 16,
      textShadowColor: "rgba(0,0,0,0.8)",
      textShadowRadius: 4,
    },
    guideSub: {
      color: "#E5E5EA",
      fontSize: 12,
      marginTop: 6,
      textShadowColor: "rgba(0,0,0,0.8)",
      textShadowRadius: 4,
    },
    shutterOuter: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 4,
      borderColor: "#FFFFFF",
      padding: 5,
    },
    shutterInner: {
      flex: 1,
      borderRadius: 31,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
const darkStyles = StyleSheet.create({
  appBackground: { backgroundColor: clinicalTheme(true).page },
  safe: { backgroundColor: clinicalTheme(true).page },
  card: {
    backgroundColor: clinicalTheme(true).surface,
    borderColor: clinicalTheme(true).border,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryText: { color: clinicalTheme(true).ink },
  secondaryText: { color: clinicalTheme(true).muted },
  tertiaryText: { color: clinicalTheme(true).muted },
  placeholderText: { color: clinicalTheme(true).placeholder },
  emptyText: { color: clinicalTheme(true).placeholder },
  accentText: { color: clinicalTheme(true).accent },
  onsetElapsedBadge: { backgroundColor: "#242426" },
  softButton: { backgroundColor: "#2C2C2E" },
  softButtonText: { color: "#E5E5EA" },
  drawButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  drawButtonText: { color: clinicalTheme(true).accent },
  eraserSizeBar: { backgroundColor: clinicalTheme(true).surface },
  eraserSizeLabel: { color: clinicalTheme(true).muted },
  eraserSliderTrack: { backgroundColor: clinicalTheme(true).border },
  input: {
    backgroundColor: clinicalTheme(true).field,
    borderColor: clinicalTheme(true).border,
    color: clinicalTheme(true).ink,
  },
  vitalBox: { backgroundColor: clinicalTheme(true).field, borderColor: clinicalTheme(true).border },
  vitalBoxFocused: { backgroundColor: "#382126", borderTopColor: "#FF6972" },
  selectedButton: { backgroundColor: "#9E1623", borderColor: "#FF6972" },
  historyChildChip: {
    backgroundColor: "#242426",
    borderColor: "#FF6972",
    borderWidth: 1.5,
  },
  historyChildChipText: { color: clinicalTheme(true).accent },
  historyParentExpanded: {
    backgroundColor: "#2C2C2E",
    borderColor: clinicalTheme(true).border,
  },
  historyParentExpandedText: { color: clinicalTheme(true).muted },
  divider: { backgroundColor: clinicalTheme(true).border },
  mapBadge: { backgroundColor: "#242426" },
  mapBadgeDanger: { backgroundColor: "#451F21", borderColor: "#A65459" },
  dangerText: { color: "#FF8A80" },
  dangerSubText: { color: "#FFB4AE" },
  bottomNav: { backgroundColor: clinicalTheme(true).page, borderTopColor: clinicalTheme(true).border },
  bottomNavTextActive: { color: clinicalTheme(true).accent },
});
