import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTextSize, makeStyles, TEXT_SIZE_KEY, TextSizeContext, TYPE, useType, type TextSize } from "./src/design";
import { clinicalTheme } from "./src/clinicalTheme";
import { createMediaSaveTask, MediaSaveTask, runMediaSave } from "./src/mediaSave";
import { planPatientWorkspaceReset } from "./src/patientUpdates";
import { clearMedicineBagFiles } from "./src/medicineBagFiles";
import { addMeasurement, deleteMeasurement, selectMeasurement, snapshotMeasurements } from "./src/vitalMeasurements";
import { formatTimestamp } from "./src/dateTime";
import { Frame } from "./src/cameraCrop";
import PatientNoteScreen from "./src/PatientNoteScreen";
import SettingsScreen from "./src/SettingsScreen";
import { NAVIGATION_ITEMS, navigationItemHeight as compactNavigationItemHeight, type AppTab } from "./src/navigation";
import { loadSender } from "./src/RecordAffiliation";
import type { SenderInfo } from "./src/smsMessage";
import RecordOptionsPopover, { PopoverAnchor } from "./src/RecordOptionsPopover";
import { RecordTabs } from "./src/ClinicalControls";
import { NoteDialogHost, NoteDialogProvider, NoteModal, useNoteAlert } from "./src/NoteDialogs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { isBlankForm, migrateStoredForm, patientFileUris, type FormState } from "./src/patientWorkspace";
import { usePatientWorkspace } from "./src/usePatientWorkspace";
import { usePatientFileCleanup } from "./src/usePatientFileCleanup";
import { captureIdentityDocument } from "./src/identityCapture";
import ShutterSound from "./modules/shutter-sound";

void SplashScreen.preventAutoHideAsync();

const THEME_KEY = "ems-log.theme.v1";
// plugins/withSplashWebAsset.js가 prebuild 때 넣는 단일 HTML 스플래시
const SPLASH_URI = Platform.OS === "ios"
  ? `${FileSystem.bundleDirectory ?? ""}field24-splash.html`
  : "file:///android_asset/splash/index.html";
const WHEEL_PICKER_KEY = "ems-log.wheel-picker.v1";
const MEDICAL_TERMS_KEY = "ems-log.medical-terms.v1";
const ERASER_SIZE_KEY = "ems-log.eraser-size.v1";
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


export default function App() {
  return <TextSizeProvider><NoteDialogProvider><FieldNoteApp /></NoteDialogProvider></TextSizeProvider>;
}

function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [size, setSizeState] = useState<TextSize>("medium");
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(TEXT_SIZE_KEY).then(value => { if (active && isTextSize(value)) setSizeState(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const value = useMemo(() => ({
    size,
    setSize: (next: TextSize) => {
      setSizeState(next);
      void AsyncStorage.setItem(TEXT_SIZE_KEY, next).catch(() => undefined);
    },
  }), [size]);
  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

function FieldNoteApp() {
  const styles = useStyles();
  const type = useType();
  const Alert = { alert: useNoteAlert() };
  const [optionsVisible, setOptionsVisible] = useState(false);
  const optionsButtonRef = useRef<View>(null);
  const [optionsAnchor, setOptionsAnchor] = useState<PopoverAnchor | null>(null);
  const openOptions = () => {
    if (!optionsButtonRef.current) {
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
  const { fontScale } = useWindowDimensions();
  const navigationItemHeight = compactNavigationItemHeight(fontScale);
  const { store, status: recoveryStatus, busy: deletingPatient, form, patients, activePatientId, setForm, commitPatientUpdate } = usePatientWorkspace(() => Alert.alert("저장 안내", "입력 내용의 임시 저장에 실패했습니다. 저장 공간을 확인해 주세요."));
  const loaded = recoveryStatus !== "loading";
  const cleanupFiles = usePatientFileCleanup(uri => patientFileUris(store.getSnapshot().workspace).includes(uri));
  const deleteLocalFile = (uri: string | null) => cleanupFiles([uri]);
  const drawingSaveBusy = useRef(false);
  const drawingSaveTask = useRef<{ patientId: string; field: "chiefComplaintDrawing" | "historyDrawing"; previousUri: string | null; task: MediaSaveTask<string> } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "system",
  );
  const [activeTab, setActiveTab] = useState<AppTab>("patient");
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
    let active = true;
    void AsyncStorage.getItem(THEME_KEY).then(value => {
      if (active && (value === "light" || value === "dark" || value === "system")) setThemeMode(value);
    }).catch(() => { if (active) Alert.alert("화면 설정", "화면 설정을 불러오지 못했습니다."); });
    return () => { active = false; };
  }, []);

  const navigate = (tab: AppTab) => {
    if (mediaBusy) {
      Alert.alert("기록 진행 중", "녹취를 중지하거나 촬영을 마친 후 이동해 주세요.");
      return;
    }
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // 24-hour automatic deletion runs only while no capture, recording or drawing is in progress.
  const expiryBlocked = useRef(false);
  expiryBlocked.current = scannerBusy || mediaBusy || cameraVisible || drawingTarget !== null || drawingSaveBusy.current;
  const expirePatients = useRef<() => Promise<void>>(async () => undefined);
  expirePatients.current = async () => {
    if (expiryBlocked.current) return;
    try {
      const { removed, uris } = await store.expire(`patient-${Date.now()}`);
      if (!removed.length) return;
      await cleanupFiles(uris);
      const recorded = removed.filter(patient => !isBlankForm(patient.form)).length;
      if (recorded) Alert.alert("환자 기록 자동 삭제", `등록 후 24시간이 지난 환자 기록 ${recorded}건을 사진·녹취·필기와 함께 삭제했습니다.`);
    } catch { /* Retried on the next check. */ }
  };
  // Medicine-bag photos are never kept; remove any left by a session the app did not finish.
  useEffect(() => { void clearMedicineBagFiles(); }, []);
  useEffect(() => {
    if (recoveryStatus !== "ready") return;
    void expirePatients.current();
    const timer = setInterval(() => void expirePatients.current(), 60 * 60_000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") void expirePatients.current(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [recoveryStatus]);

  const backPress = useRef<() => boolean>(() => false);
  backPress.current = () => {
    if (mediaBusy) {
      Alert.alert("기록 진행 중", "녹취를 중지하거나 촬영을 마친 후 이동해 주세요.");
      return true;
    }
    if (activeTab === "patient") return false;
    navigate("patient");
    return true;
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => backPress.current());
    return () => subscription.remove();
  }, []);

  const selectPatient = (id?: string) => {
    if (recoveryStatus !== "ready" || scannerBusy || mediaBusy || drawingSaveBusy.current || store.getSnapshot().busy || drawingTarget || cameraVisible) return;
    store.select(id ?? `patient-${Date.now()}`, id ? undefined : migrateStoredForm({}));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const finishIntro = useCallback(() => {
    if (introFinishing.current) return;
    introFinishing.current = true;
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 250,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setShowIntro(false));
  }, [introOpacity]);

  useEffect(() => {
    if (!loaded) return;
    void SplashScreen.hideAsync();
    const fallback = setTimeout(finishIntro, 3500);
    return () => clearTimeout(fallback);
  }, [finishIntro, loaded]);

  const update = (key: keyof FormState, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const changeTheme = (dark: boolean) => changeThemeMode(dark ? "dark" : "light");
  const changeThemeMode = (nextMode: "system" | "light" | "dark") => {
    setThemeMode(nextMode);
    void AsyncStorage.setItem(THEME_KEY, nextMode).catch(() => Alert.alert("화면 설정", "화면 모드 설정을 저장하지 못했습니다. 다시 선택해 주세요."));
  };
  const deleteDocument = async () => {
    const uri = form.idDocument?.uri;
    try {
      await commitPatientUpdate(activePatientId, previous => ({ ...previous, idDocument: null }));
      await deleteLocalFile(uri ?? null);
    } catch { Alert.alert("삭제 실패", "신분증 기록을 저장하지 못했습니다. 기존 사진은 유지됩니다."); }
  };
  const requestDeletePatient = () => {
    if (recoveryStatus !== "ready" || scannerBusy || mediaBusy || store.getSnapshot().busy || cameraVisible || drawingTarget) return;
    const id = activePatientId;
    const index = patients.findIndex(patient => patient.id === id);
    const label = form.name.trim() || `환자 ${index + 1}`;
    Alert.alert(`${label} 기록 삭제`, "이 환자의 입력 내용과 촬영·필기 자료를 삭제합니다. 다른 환자 기록은 유지됩니다. 삭제 후에는 복구할 수 없습니다.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: async () => {
        if (store.getSnapshot().busy) return;
        let uris: string[] = [];
        try {
          await store.replace(current => {
            const removed = current.patients.find(patient => patient.id === id);
            if (!removed) throw new Error("Patient no longer exists");
            uris = patientFileUris({ version: 2, activeId: id, patients: [removed] });
            const remaining = current.patients.filter(patient => patient.id !== id);
            const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? { id: `patient-${Date.now()}`, form: migrateStoredForm({}) };
            return { version: 2, activeId: next.id, patients: remaining.length ? remaining : [next] };
          });
          await cleanupFiles(uris);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        } catch { Alert.alert("삭제 실패", "기록을 삭제하지 못했습니다. 기존 기록은 유지됩니다. 다시 시도해 주세요."); }
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
      const retained = store.getSnapshot().workspace.patients.some(patient => patient.form.chiefComplaintDrawing === pending.previousUri || patient.form.historyDrawing === pending.previousUri);
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
  const deleteDrawing = async (key: "chiefComplaintDrawing" | "historyDrawing") => {
    const uri = form[key];
    try {
      await commitPatientUpdate(activePatientId, previous => ({ ...previous, [key]: null }));
      await deleteLocalFile(uri);
    } catch { Alert.alert("삭제 실패", "필기 기록을 저장하지 못했습니다. 기존 필기는 유지됩니다."); }
  };
  const reset = () => Alert.alert(
    "환자 기록 전체 초기화",
    "등록된 모든 환자의 인적사항, 주증상, 활력징후, 병력·메모와 사진·녹취·필기 자료가 삭제됩니다. 삭제 후에는 복구할 수 없습니다. 전체 초기화할까요?",
    [
      { text: "취소", style: "cancel" },
      { text: "전체 초기화", style: "destructive", onPress: async () => {
        if (recoveryStatus !== "ready" || store.getSnapshot().busy) return;
        if (scannerBusy || mediaBusy || drawingSaveBusy.current || cameraVisible || drawingTarget) {
          Alert.alert("초기화 안내", "촬영이나 녹취를 마친 후 초기화해 주세요.");
          return;
        }
        let uris: string[] = [];
        try {
          await store.replace(current => {
            const plan = planPatientWorkspaceReset(current, { id: `patient-reset-${Date.now()}`, form: migrateStoredForm({}) });
            uris = plan.uris;
            return plan.next;
          });
          await cleanupFiles(uris);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        } catch { Alert.alert("초기화 실패", "저장소를 비우지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요."); }
      } },
    ],
  );
  const openIdentityCamera = async () => {
    if (scannerBusy) return;
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!permission.granted) {
      if (permission.canAskAgain) Alert.alert("카메라 권한 필요", "신분증을 촬영하려면 카메라 접근을 허용해 주세요.");
      else Alert.alert("카메라 권한 필요", "카메라 접근이 꺼져 있습니다. 설정에서 카메라를 허용해 주세요.", [
        { text: "닫기", style: "cancel" },
        { text: "설정 열기", onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    setCameraVisible(true);
  };
  const captureIdentity = async () => {
    if (scannerBusy) return;
    setScannerBusy(true);
    const patientId = activePatientId;
    const previousUri = form.idDocument?.uri;
    try {
      const viewport = { ...cameraLayout };
      const guide = { ...guideFrame, y: guideTop + guideFrame.y };
      if (!viewport.width || !viewport.height || !guide.width || !guide.height) throw new Error("촬영 가이드가 준비되지 않았습니다. 잠시 후 다시 촬영해 주세요.");
      // The phone's own shutter click plays on press; expo-camera's beep is only the fallback without the module.
      ShutterSound?.play();
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1, skipProcessing: false, shutterSound: !ShutterSound });
      if (!photo?.uri) return;
      setCameraVisible(false);
      // Recognised values fill empty fields only; values the paramedic typed are replaced after confirmation.
      let conflicts: { key: "name" | "birthDate" | "gender"; label: string; typed: string; read: string }[] = [];
      const identity = await captureIdentityDocument(photo.uri, viewport, guide, value => commitPatientUpdate(patientId, previous => {
        const fill: Partial<FormState> = {};
        conflicts = [];
        const candidates = [
          { key: "name" as const, label: "성명", read: value.document.name, same: (typed: string, read: string) => typed.trim() === read, show: (v: string) => v },
          { key: "birthDate" as const, label: "생년월일", read: value.document.birthDate, same: (typed: string, read: string) => typed.replace(/\D/g, "") === read.replace(/\D/g, ""), show: (v: string) => displayBirthDate(v) },
          { key: "gender" as const, label: "성별", read: value.gender, same: (typed: string, read: string) => typed === read, show: (v: string) => v },
        ];
        for (const { key, label, read, same, show } of candidates) {
          if (!read) continue;
          if (!previous[key].trim()) fill[key] = read;
          else if (!same(previous[key], read)) conflicts.push({ key, label, typed: show(previous[key]), read });
        }
        return { ...previous, idDocument: value.document, ...fill };
      }), cleanupFiles);
      await deleteLocalFile(previousUri ?? null);
      if (conflicts.length) {
        const changes = conflicts;
        Alert.alert(
          "입력값과 인식 결과가 다릅니다",
          changes.map(item => `${item.label}: 입력 ${item.typed} → 인식 ${item.key === "birthDate" ? displayBirthDate(item.read) : item.read}`).join("\n"),
          [
            { text: "입력값 유지", style: "cancel" },
            { text: "인식값으로 변경", onPress: () => void commitPatientUpdate(patientId, previous => ({ ...previous, ...Object.fromEntries(changes.map(item => [item.key, item.read])) })).catch(() => Alert.alert("변경 실패", "인식값을 저장하지 못했습니다. 입력값은 유지됩니다.")) },
          ],
        );
      } else if (!identity.document.name && !identity.document.birthDate) {
        Alert.alert("자료는 저장했습니다", "성명과 생년월일은 인식하지 못했습니다. 빛 반사를 피해서 다시 촬영해 주세요.");
      } else {
        Alert.alert("인식 완료", `성명: ${identity.document.name ?? "인식 안 됨"}\n생년월일: ${displayBirthDate(identity.document.birthDate) || "인식 안 됨"}`);
      }
    } catch (error) {
      Alert.alert("신분증 인식 오류", error instanceof Error ? error.message : "카메라 또는 문자 인식을 실행하지 못했습니다.");
    } finally { setScannerBusy(false); }
  };

  if (recoveryStatus === "error") return <View style={[styles.loading, { backgroundColor: clinicalTheme(isDark).page, padding: 24, gap: 16 }]}>
    <Text style={{ color: clinicalTheme(isDark).ink, fontSize: type.section, textAlign: "center" }}>기존 환자 기록을 불러오지 못했습니다.</Text>
    <Text style={{ color: clinicalTheme(isDark).muted, textAlign: "center" }}>기록 보호를 위해 입력과 저장을 중지했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.</Text>
    <Pressable accessibilityRole="button" onPress={() => void store.restore()} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 24 }}>
      <Text style={{ color: clinicalTheme(isDark).accent, fontSize: type.body }}>불러오기 재시도</Text>
    </Pressable>
  </View>;
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
              contentContainerStyle={[styles.page, styles.pageUnderFloatingNav, { paddingBottom: navigationItemHeight + 46 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.noteAppHeader}>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <View style={styles.noteBrand}><Text style={[styles.noteBrandNumber, { color: clinicalTheme(isDark).brand }]}>119</Text><Text style={[styles.noteBrandText, { color: clinicalTheme(isDark).muted }]}>FIELD NOTE</Text></View>
                  {activeTab === "settings" && <Text style={[styles.noteTitle, { color: clinicalTheme(isDark).ink }]}>설정</Text>}
                </View>
                {activeTab !== "settings" && <View style={styles.noteHeaderActions}>
                  <Pressable ref={optionsButtonRef} accessibilityRole="button" accessibilityLabel="메모 메뉴" onPress={openOptions} style={[styles.noteHeaderMenu, { borderRadius: 22, backgroundColor: clinicalTheme(isDark).surface, borderWidth: StyleSheet.hairlineWidth, borderColor: clinicalTheme(isDark).border }]}><Ionicons name="ellipsis-horizontal" size={20} color={clinicalTheme(isDark).ink} /></Pressable>
                </View>}
              </View>
              {activeTab !== "settings" ? (
                <PatientNoteScreen section={activeTab} isDark={isDark} form={form} useWheelPicker={useWheelPicker}
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
                  onDeleteDrawing={key => void deleteDrawing(key)} onAppend={attachment => commitPatientUpdate(activePatientId, previous => ({ ...previous, attachments: previous.attachments.some(item => item.id === attachment.id) ? previous.attachments : [...previous.attachments, attachment] }))} onMediaBusyChange={setMediaBusy}
                  sender={sender}
                  medicalTerms={medicalTerms}
                  onRemoveAttachment={async attachment => {
                    // Persist the shorter list first so a failed write never leaves a record pointing at a deleted file.
                    await commitPatientUpdate(activePatientId, previous => ({ ...previous, attachments: previous.attachments.filter(item => item.id !== attachment.id) }));
                    await deleteLocalFile(attachment.uri);
                  }}
                />
              ) : (
                <SettingsScreen isDark={isDark} useWheelPicker={useWheelPicker} wheelPreferenceReady={wheelPreferenceReady}
                  medicalTerms={medicalTerms} onThemeChange={changeTheme}
                  followSystemTheme={themeMode === "system"} onFollowSystemThemeChange={follow => changeThemeMode(follow ? "system" : isDark ? "dark" : "light")}
                  onWheelChange={value => void changeWheelPreference(value)}
                  onMedicalTermsChange={value => void changeMedicalTerms(value)} onAffiliationSaved={setSender} />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          <BottomNavigation
            itemHeight={navigationItemHeight}
            activeTab={activeTab}
            isDark={isDark}
            onSelect={navigate}
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
            onDelete={async () => {
              const field = drawingTarget;
              if (!field) return;
              await deleteDrawing(field);
              setDrawingTarget(null);
            }}
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
        <RecordOptionsPopover
          visible={optionsVisible}
          isDark={isDark}
          anchor={optionsAnchor}
          onReset={reset}
          onClose={() => setOptionsVisible(false)}
        />
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

function BottomNavigation({
  activeTab, isDark, onSelect, itemHeight,
}: {
  itemHeight: number;
  activeTab: AppTab;
  isDark: boolean;
  onSelect: (tab: AppTab) => void;
}) {
  const styles = useStyles();
  const tabs = NAVIGATION_ITEMS;
  // Keep the floating capsule above the home indicator / system navigation bar.
  const t = clinicalTheme(isDark);
  const insets = useSafeAreaInsets();
  const backgroundColor = isDark ? "rgba(44,45,50,0.96)" : "rgba(250,249,247,0.97)";
  return <View pointerEvents="box-none" style={[styles.floatingNavLayer, { paddingBottom: insets.bottom + 8 }]}>
      <View accessibilityRole="tablist" style={[styles.floatingNav, { backgroundColor, borderColor: t.border, height: itemHeight + 8 + StyleSheet.hairlineWidth * 2 }]}>
        <RecordTabs
          isDark={isDark}
          options={tabs}
          selectedId={activeTab}
          label="하단 네비게이션"
          trackColor={backgroundColor}
          itemHeight={itemHeight}
          itemStyle={{ paddingHorizontal: 4, paddingVertical: 4 }}
          thumbInset={2}
          style={{ flex: 1 }}
          onSelect={id => {
            const tab = tabs.find(item => item.id === id);
            if (tab) onSelect(tab.id);
          }}
          renderOption={(option, color, active) => {
            const tab = tabs.find(item => item.id === option.id);
            if (!tab) return null;
            return <View style={styles.floatingNavContent}>
              <Ionicons name={active ? tab.selectedIcon : tab.icon} size={20} color={color} allowFontScaling={false} style={styles.floatingNavIcon} />
              <Text numberOfLines={1} style={[styles.floatingNavText, { color }]}>{tab.label}</Text>
            </View>;
          }}
        />
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
  onDelete,
}: {
  visible: boolean;
  isDark: boolean;
  title: string;
  initialUri: string | null;
  onClose: () => void;
  onSave: (uri: string) => Promise<void>;
  /** Saving after "모두 지우기" removed the saved drawing and nothing new was drawn. */
  onDelete: () => Promise<void>;
}) {
  const styles = useStyles();
  const Alert = { alert: useNoteAlert() };
  const [paths, setPaths] = useState<InkStroke[]>([]);
  // The stroke being drawn lives in a ref and reaches the screen at most once per frame,
  // so finished strokes are not re-rendered on every touch move.
  const strokeRef = useRef<InkStroke | null>(null);
  const strokeFrame = useRef<number | null>(null);
  const [stroke, setStroke] = useState<InkStroke | null>(null);
  const [baseCleared, setBaseCleared] = useState(false);
  const showBase = !!initialUri && !baseCleared;
  const hasInk = paths.length > 0 || stroke !== null;
  const canSave = hasInk || !!initialUri;
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
  useEffect(() => {
    if (visible) {
      captureUri.current = null;
      setSaveFailed(false);
      setPaths([]);
      strokeRef.current = null;
      setStroke(null);
      setBaseCleared(false);
      setEraserEnabled(false);
      eraserEnabledRef.current = false;
      setEraserCursor({ x: 0, y: 0, visible: false });
      void AsyncStorage.getItem(ERASER_SIZE_KEY).then((saved) => {
        const parsed = Number(saved);
        if (!Number.isFinite(parsed)) return;
        const restored = Math.max(16, Math.min(200, parsed));
        setEraserWidth(restored);
        eraserWidthRef.current = restored;
      }).catch(() => undefined);
    }
  }, [visible]);
  const publishStroke = () => {
    if (strokeFrame.current !== null) return;
    strokeFrame.current = requestAnimationFrame(() => {
      strokeFrame.current = null;
      setStroke(strokeRef.current && { ...strokeRef.current });
    });
  };
  const finishStroke = () => {
    if (strokeFrame.current !== null) cancelAnimationFrame(strokeFrame.current);
    strokeFrame.current = null;
    const done = strokeRef.current;
    strokeRef.current = null;
    setStroke(null);
    if (done) setPaths((previous) => [...previous, done]);
  };
  const finishStrokeRef = useRef(finishStroke);
  finishStrokeRef.current = finishStroke;
  const publishStrokeRef = useRef(publishStroke);
  publishStrokeRef.current = publishStroke;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        if (eraserEnabledRef.current)
          setEraserCursor({ x: locationX, y: locationY, visible: true });
        strokeRef.current = {
          d: `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`,
          color: eraserEnabledRef.current
            ? canvasColorRef.current
            : inkColorRef.current,
          width: eraserEnabledRef.current ? eraserWidthRef.current : 3.2,
        };
        publishStrokeRef.current();
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        if (eraserEnabledRef.current)
          setEraserCursor({ x: locationX, y: locationY, visible: true });
        if (!strokeRef.current) return;
        strokeRef.current.d += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        publishStrokeRef.current();
      },
      onPanResponderRelease: () => {
        finishStrokeRef.current();
        setEraserCursor((previous) => ({ ...previous, visible: false }));
      },
      onPanResponderTerminate: () => {
        finishStrokeRef.current();
        setEraserCursor((previous) => ({ ...previous, visible: false }));
      },
    }),
  ).current;
  const save = async () => {
    if (savingRef.current || !canSave || !canvasRef.current) return;
    savingRef.current = true;
    try {
      setSaving(true);
      if (!hasInk && !showBase) {
        await onDelete();
        return;
      }
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
            disabled={!canSave || saving}
            onPress={() => void save()}
            style={[
              saveFailed ? styles.handwritingRetry : styles.handwritingRound,
              { backgroundColor: saveFailed ? clinicalTheme(isDark).danger : clinicalTheme(isDark).accent },
              !canSave || saving ? styles.disabledButton : undefined,
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
        {/* The frame stays outside the captured view so saved handwriting carries no border of its own. */}
        <View style={[styles.handwritingCanvas, { borderColor: clinicalTheme(isDark).border }]}>
          <View
            ref={canvasRef}
            pointerEvents={saving || saveFailed ? "none" : "auto"}
            collapsable={false}
            style={[styles.handwritingInk, { backgroundColor: clinicalTheme(isDark).surface }]}
            {...panResponder.panHandlers}
          >
            {showBase && (
              <Image
                source={{ uri: initialUri }}
                resizeMode="stretch"
                style={StyleSheet.absoluteFill}
              />
            )}
            <Svg width="100%" height="100%">
              <InkPaths paths={paths} />
              {stroke && <InkPath path={stroke} />}
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
            accessibilityHint={showBase ? "저장하면 기존 필기도 삭제됩니다" : undefined}
            disabled={saving || saveFailed || (paths.length === 0 && !showBase)}
            onPress={() => { setPaths([]); setBaseCleared(true); }}
            style={[styles.handwritingRound, { backgroundColor: clinicalTheme(isDark).field }, paths.length === 0 && !showBase && styles.disabledButton]}
          >
            <Ionicons name="trash-outline" size={19} color={clinicalTheme(isDark).danger} />
          </Pressable>
        </View>
      </SafeAreaView>
    </NoteModal>
  );
}

type InkStroke = { d: string; color: string; width: number };
function InkPath({ path }: { path: InkStroke }) {
  return <Path d={path.d} fill="none" stroke={path.color} strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" />;
}
const InkPaths = React.memo(function InkPaths({ paths }: { paths: InkStroke[] }) {
  return <>{paths.map((path, index) => <InkPath key={index} path={path} />)}</>;
});

function EraserSizeSlider({
  value,
  isDark,
  onChange,
}: {
  value: number;
  isDark: boolean;
  onChange: (value: number) => void;
}) {
  const styles = useStyles();
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

const useStyles = makeStyles({
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
    handwritingRetryText: { fontSize: TYPE.sub, fontFamily: "Pretendard-Medium" },
    handwritingMode: { flex: 1, minWidth: 0 },
    handwritingTitle: { fontSize: TYPE.section, fontFamily: "Pretendard-Medium" },
    handwritingCanvas: {
      flex: 1,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#D4DEDB",
    },
    handwritingInk: { flex: 1 },
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
      fontSize: TYPE.caption,
      fontFamily: "Pretendard-Medium",
    },
    eraserSizeValue: { color: clinicalTheme(false).accent, fontSize: TYPE.caption, fontFamily: "Pretendard-Medium" },
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
    flex: { flex: 1 },
    noteAppHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingTop: 8, paddingBottom: 10 },
    noteBrand: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
    noteBrandNumber: { fontSize: TYPE.sub, fontFamily: "Pretendard-Bold", letterSpacing: -.4 },
    noteBrandText: { fontSize: TYPE.caption, fontFamily: "Pretendard-Medium", letterSpacing: 1.2 },
    noteTitle: { fontSize: TYPE.display, fontFamily: "Pretendard-SemiBold", letterSpacing: -1.2 },
    noteHeaderMenu: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    noteHeaderActions: { flexDirection: "row", gap: 8 },
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
    page: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 38, gap: 16 },
    pageUnderFloatingNav: { paddingBottom: 110 },
    floatingNavLayer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 6 },
    floatingNav: { flexDirection: "row", width: "86%", maxWidth: 380, minHeight: 58, borderRadius: 999, padding: 4, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000000", shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    floatingNavContent: { alignItems: "center", justifyContent: "center", gap: 2 },
    floatingNavIcon: { width: 20, height: 20, lineHeight: 20, includeFontPadding: false, textAlign: "center" },
    floatingNavText: { fontSize: TYPE.caption, fontFamily: "Pretendard-Medium", includeFontPadding: false, textAlign: "center" },
    disabledButton: { opacity: 0.62 },
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
      fontSize: TYPE.section,
      fontFamily: "Pretendard-Medium",
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
      fontSize: TYPE.sub,
      fontFamily: "Pretendard-Medium",
      marginTop: 16,
      textShadowColor: "rgba(0,0,0,0.8)",
      textShadowRadius: 4,
    },
    guideSub: {
      color: "#E5E5EA",
      fontSize: TYPE.sub,
      fontFamily: "Pretendard-Regular",
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
});
const darkStyles = StyleSheet.create({
  appBackground: { backgroundColor: clinicalTheme(true).page },
  eraserSizeBar: { backgroundColor: clinicalTheme(true).surface },
  eraserSizeLabel: { color: clinicalTheme(true).muted },
  eraserSliderTrack: { backgroundColor: clinicalTheme(true).border },
});
