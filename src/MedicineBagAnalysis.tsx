import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  Share,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import ChatGptShare from "../modules/chatgpt-share";
import type { Frame, Size } from "./cameraCrop";
import { clinicalTheme } from "./clinicalTheme";
import { TYPE, makeStyles } from "./design";
import {
  capLongEdge,
  displayToImageCrop,
  dragCrop,
  fitContain,
  initialCrop,
  strokePath,
  type CropHandle,
  type Point,
} from "./medicineBagCrop";
import { clearMedicineBagFiles, keepMedicineBagFile } from "./medicineBagFiles";
import { CHATGPT_PACKAGE, MEDICINE_BAG_PROMPT } from "./medicineBagPrompt";
import { NoteModal, useNoteAlert } from "./NoteDialogs";

type Picture = Size & { uri: string };
type Step = "camera" | "crop" | "review";
/** Corner touch target, in screen points. */
const HANDLE_REACH = 36;
/** Mask pen width on screen; converted to photo pixels when drawn. */
const PEN_WIDTH = 26;

/** Re-encodes to an upright JPEG without EXIF (location, device) and returns its real size. */
async function normalize(uri: string, crop?: ReturnType<typeof displayToImageCrop>, maxEdge = 2048): Promise<Picture> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  if (crop) context.crop(crop);
  const resize = capLongEdge(crop ?? (await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync()), maxEdge);
  if (resize) context.resize(resize);
  const image = await (await context.renderAsync()).saveAsync({ compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: await keepMedicineBagFile(image.uri), width: image.width, height: image.height };
}

export default function MedicineBagAnalysis({
  visible,
  isDark,
  onClose,
}: {
  visible: boolean;
  isDark: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const t = clinicalTheme(isDark);
  const alert = useNoteAlert();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [step, setStep] = useState<Step>("camera");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<Picture | null>(null);
  const [cropBox, setCropBox] = useState<Size>({ width: 0, height: 0 });
  const [crop, setCrop] = useState<Frame | null>(null);
  const [cropped, setCropped] = useState<Picture | null>(null);
  const [reviewBox, setReviewBox] = useState<Size>({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [pen, setPen] = useState(false);
  const previewRef = useRef<View>(null);
  const shared = useRef(false);
  const working = useRef(false);

  const display = useMemo(() => (photo ? fitContain(photo, cropBox) : null), [photo, cropBox]);
  const fit = useMemo(() => (cropped ? fitContain(cropped, reviewBox) : null), [cropped, reviewBox]);
  const pixelsPerPoint = cropped && fit && fit.width > 0 ? cropped.width / fit.width : 1;

  function reset() {
    setStep("camera");
    setPhoto(null);
    setCrop(null);
    setCropped(null);
    setStrokes([]);
    setPen(false);
    setCameraReady(false);
  }
  function close() {
    if (working.current) return;
    shared.current = false;
    reset();
    void clearMedicineBagFiles();
    onClose();
  }
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!visible) return;
    reset();
    // Leftovers from an interrupted session are removed before a new photo is taken.
    void clearMedicineBagFiles();
    void (async () => {
      const current = permission?.granted ? permission : await requestPermission();
      if (current.granted) return;
      alert(
        "카메라 권한 필요",
        "설정에서 카메라 접근을 허용해 주세요.",
        current.canAskAgain ? undefined : [
          { text: "닫기", style: "cancel" },
          { text: "설정 열기", onPress: () => void Linking.openSettings() },
        ],
      );
      closeRef.current();
    })();
    // Runs once per opening; the permission object only seeds the first check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ChatGPT has read the image by the time the medic comes back; the copies are deleted then.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && shared.current) closeRef.current();
    });
    return () => subscription.remove();
  }, []);

  async function run(task: () => Promise<void>, failure: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await task();
    } catch {
      alert("약 봉투 분석", failure);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const takePhoto = () =>
    run(async () => {
      if (!cameraReady || !camera.current) return;
      const shot = await camera.current.takePictureAsync({ quality: 0.9 });
      if (!shot?.uri) throw new Error("No photo");
      const raw = await keepMedicineBagFile(shot.uri);
      const upright = await normalize(raw, undefined, 3000);
      await FileSystem.deleteAsync(raw, { idempotent: true });
      setPhoto(upright);
      setCrop(null);
      setStep("crop");
    }, "사진을 처리하지 못했습니다. 다시 촬영해 주세요.");

  const confirmCrop = () =>
    run(async () => {
      if (!photo || !display || !crop) return;
      const next = await normalize(photo.uri, displayToImageCrop(crop, display, photo));
      if (cropped) await FileSystem.deleteAsync(cropped.uri, { idempotent: true });
      setCropped(next);
      setStrokes([]);
      setPen(false);
      setStep("review");
    }, "영역을 자르지 못했습니다. 다시 지정해 주세요.");

  const send = () =>
    run(async () => {
      if (!cropped) return;
      if (Platform.OS === "android" && !ChatGptShare) {
        alert("약 봉투 분석", "이 버전의 앱에서는 ChatGPT로 보낼 수 없습니다. 앱을 업데이트해 주세요.");
        return;
      }
      if (ChatGptShare && !ChatGptShare.isInstalled()) {
        alert("ChatGPT 앱 필요", "ChatGPT 앱을 설치하고 로그인한 뒤 다시 시도해 주세요.", [
          { text: "닫기", style: "cancel" },
          {
            text: "설치하기",
            onPress: () =>
              void Linking.openURL(`market://details?id=${CHATGPT_PACKAGE}`).catch(() =>
                Linking.openURL(`https://play.google.com/store/apps/details?id=${CHATGPT_PACKAGE}`),
              ),
          },
        ]);
        return;
      }
      // With marks, the copy is the preview itself, so exactly what is on screen is sent.
      const fileUri = strokes.length
        ? await keepMedicineBagFile(await captureRef(previewRef, { format: "jpg", quality: 0.9, result: "tmpfile" }))
        : cropped.uri;
      if (ChatGptShare) {
        await ChatGptShare.share(await FileSystem.getContentUriAsync(fileUri), MEDICINE_BAG_PROMPT);
      } else {
        await Share.share({ url: fileUri, message: MEDICINE_BAG_PROMPT });
      }
      shared.current = true;
    }, "ChatGPT를 열지 못했습니다. ChatGPT 앱이 설치되어 있는지 확인해 주세요.");

  // One responder over the photo: a corner resizes, inside the frame moves it. Child views ignore
  // touches so locationX/Y are always relative to the photo area.
  const cropDrag = useRef<{ handle: CropHandle; start: Frame } | null>(null);
  const cropState = useRef({ crop, display });
  cropState.current = { crop, display };
  const cropResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: ({ nativeEvent }) => {
          const { crop: frame } = cropState.current;
          if (!frame) return;
          const { locationX: x, locationY: y } = nativeEvent;
          const near = (cx: number, cy: number) => Math.abs(x - cx) <= HANDLE_REACH && Math.abs(y - cy) <= HANDLE_REACH;
          const right = frame.x + frame.width, bottom = frame.y + frame.height;
          const handle: CropHandle | null = near(frame.x, frame.y)
            ? "tl"
            : near(right, frame.y)
              ? "tr"
              : near(frame.x, bottom)
                ? "bl"
                : near(right, bottom)
                  ? "br"
                  : x >= frame.x && x <= right && y >= frame.y && y <= bottom
                    ? "move"
                    : null;
          cropDrag.current = handle ? { handle, start: frame } : null;
        },
        onPanResponderMove: (_, gesture) => {
          const drag = cropDrag.current, bounds = cropState.current.display;
          if (drag && bounds) setCrop(dragCrop(drag.start, drag.handle, gesture.dx, gesture.dy, bounds));
        },
        onPanResponderRelease: () => {
          cropDrag.current = null;
        },
        onPanResponderTerminate: () => {
          cropDrag.current = null;
        },
      }),
    [],
  );
  useEffect(() => {
    if (step === "crop" && display && display.width > 0 && !crop) setCrop(initialCrop(display));
  }, [step, display, crop]);

  // Mask pen: points are stored in cropped-photo pixels so the marks stay put at any screen size.
  const penState = useRef({ fit, pixelsPerPoint, pen });
  penState.current = { fit, pixelsPerPoint, pen };
  const toPixel = (x: number, y: number): Point => {
    const { fit: frame, pixelsPerPoint: ratio } = penState.current;
    return { x: (x - (frame?.x ?? 0)) * ratio, y: (y - (frame?.y ?? 0)) * ratio };
  };
  const penResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => penState.current.pen,
        onMoveShouldSetPanResponder: () => penState.current.pen,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: ({ nativeEvent }) =>
          setStrokes((current) => [...current, [toPixel(nativeEvent.locationX, nativeEvent.locationY)]]),
        onPanResponderMove: ({ nativeEvent }) =>
          setStrokes((current) => {
            const last = current[current.length - 1];
            if (!last) return current;
            return [...current.slice(0, -1), [...last, toPixel(nativeEvent.locationX, nativeEvent.locationY)]];
          }),
      }),
    // toPixel reads refs only.
    [],
  );

  const measure = (setter: (size: Size) => void) => (event: LayoutChangeEvent) =>
    setter({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });

  const title = step === "camera" ? "약 봉투 촬영" : step === "crop" ? "보낼 영역 지정" : "보낼 사진 확인";
  return (
    <NoteModal visible={visible} animationType="slide" onRequestClose={() => (step === "camera" ? close() : setStep(step === "review" ? "crop" : "camera"))}>
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="약 봉투 분석 닫기" onPress={close} disabled={busy} style={styles.iconButton}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.iconButton} />
        </View>

        {step === "camera" && (
          <>
            <Text style={styles.hint}>약 이름이 적힌 부분을 가깝게 찍어 주세요.</Text>
            {visible && permission?.granted && (
              <CameraView
                ref={camera}
                style={styles.stage}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
                onMountError={() => alert("카메라 오류", "다른 앱에서 카메라를 사용 중인지 확인해 주세요.")}
              />
            )}
            <View style={styles.shutterRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="약 봉투 촬영"
                disabled={!cameraReady || busy}
                onPress={() => void takePhoto()}
                style={styles.shutter}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.shutterInner} />}
              </Pressable>
            </View>
          </>
        )}

        {step === "crop" && photo && (
          <>
            <Text style={styles.hint}>모서리를 끌어 약 이름 목록만 감싸 주세요. 틀 바깥은 보내지 않습니다.</Text>
            <View style={styles.stage} onLayout={measure(setCropBox)} {...cropResponder.panHandlers}>
              {display && (
                <View pointerEvents="none" style={{ position: "absolute", left: display.x, top: display.y, width: display.width, height: display.height }}>
                  <Image source={{ uri: photo.uri }} style={styles.fill} />
                </View>
              )}
              {crop && (
                <View pointerEvents="none" style={styles.fill}>
                  <View style={[styles.shade, { left: 0, right: 0, top: 0, height: crop.y }]} />
                  <View style={[styles.shade, { left: 0, right: 0, top: crop.y + crop.height, bottom: 0 }]} />
                  <View style={[styles.shade, { left: 0, width: crop.x, top: crop.y, height: crop.height }]} />
                  <View style={[styles.shade, { left: crop.x + crop.width, right: 0, top: crop.y, height: crop.height }]} />
                  <View style={[styles.frame, { left: crop.x, top: crop.y, width: crop.width, height: crop.height }]} />
                  {([
                    [crop.x, crop.y],
                    [crop.x + crop.width, crop.y],
                    [crop.x, crop.y + crop.height],
                    [crop.x + crop.width, crop.y + crop.height],
                  ] as const).map(([x, y]) => (
                    <View key={`${x === crop.x}-${y === crop.y}`} style={[styles.corner, { left: x - 11, top: y - 11 }]} />
                  ))}
                </View>
              )}
            </View>
            <View style={styles.footer}>
              <Pressable accessibilityRole="button" onPress={() => setStep("camera")} disabled={busy} style={[styles.secondary, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
                <Text style={styles.secondaryText}>다시 촬영</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void confirmCrop()} disabled={busy || !crop} style={[styles.primary, { backgroundColor: t.accent }]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>이 영역 사용</Text>}
              </Pressable>
            </View>
          </>
        )}

        {step === "review" && cropped && (
          <>
            <Text style={styles.hint}>
              이 사진만 ChatGPT로 보내집니다. 이름·병원명이 보이면 &quot;가리기&quot;로 칠해 주세요.
            </Text>
            <View style={styles.stage} onLayout={measure(setReviewBox)} {...penResponder.panHandlers}>
              {fit && fit.width > 0 && (
                <View
                  ref={previewRef}
                  collapsable={false}
                  pointerEvents="none"
                  style={{ position: "absolute", left: fit.x, top: fit.y, width: fit.width, height: fit.height }}
                >
                  <Image source={{ uri: cropped.uri }} style={styles.fill} />
                  <Svg style={styles.fill} viewBox={`0 0 ${cropped.width} ${cropped.height}`}>
                    {strokes.map((points, index) => (
                      <Path
                        key={index}
                        d={strokePath(points)}
                        stroke="#000000"
                        strokeWidth={PEN_WIDTH * pixelsPerPoint}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    ))}
                  </Svg>
                </View>
              )}
            </View>
            <View style={styles.tools}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: pen }}
                onPress={() => setPen((on) => !on)}
                style={[styles.tool, { backgroundColor: pen ? "#FFFFFF" : "rgba(255,255,255,0.14)" }]}
              >
                <Ionicons name="brush-outline" size={18} color={pen ? "#000000" : "#FFFFFF"} />
                <Text style={[styles.toolText, { color: pen ? "#000000" : "#FFFFFF" }]}>가리기</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="마지막 가리기 취소"
                disabled={!strokes.length}
                onPress={() => setStrokes((current) => current.slice(0, -1))}
                style={[styles.tool, { backgroundColor: "rgba(255,255,255,0.14)" }, !strokes.length && styles.disabled]}
              >
                <Ionicons name="arrow-undo-outline" size={18} color="#FFFFFF" />
                <Text style={styles.toolText}>되돌리기</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!strokes.length}
                onPress={() => setStrokes([])}
                style={[styles.tool, { backgroundColor: "rgba(255,255,255,0.14)" }, !strokes.length && styles.disabled]}
              >
                <Text style={styles.toolText}>모두 지우기</Text>
              </Pressable>
            </View>
            <Text style={styles.note}>
              프롬프트는 자동으로 붙고 클립보드에도 복사됩니다. 입력칸이 비어 있으면 길게 눌러 붙여넣은 뒤 보내 주세요. ChatGPT의 임시 채팅을 쓰면 대화가 기록에 남지 않습니다.
            </Text>
            <View style={styles.footer}>
              <Pressable accessibilityRole="button" onPress={() => setStep("crop")} disabled={busy} style={[styles.secondary, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
                <Text style={styles.secondaryText}>다시 지정</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void send()} disabled={busy} style={[styles.primary, { backgroundColor: t.accent }]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ChatGPT로 보내기</Text>}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </NoteModal>
  );
}

const useStyles = makeStyles({
  page: { flex: 1, backgroundColor: "#000000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: TYPE.body, color: "#FFFFFF", fontFamily: "Pretendard-Medium" },
  hint: { fontSize: TYPE.sub, color: "rgba(255,255,255,0.8)", fontFamily: "Pretendard-Regular", textAlign: "center", paddingHorizontal: 20, paddingBottom: 10 },
  stage: { flex: 1, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  shade: { position: "absolute", backgroundColor: "rgba(0,0,0,0.6)" },
  frame: { position: "absolute", borderWidth: 2, borderColor: "#FFFFFF" },
  corner: { position: "absolute", width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF" },
  shutterRow: { padding: 24, alignItems: "center" },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#FFFFFF" },
  tools: { flexDirection: "row", justifyContent: "center", gap: 8, paddingTop: 12, paddingHorizontal: 16 },
  tool: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22 },
  toolText: { fontSize: TYPE.sub, color: "#FFFFFF", fontFamily: "Pretendard-Medium" },
  disabled: { opacity: 0.4 },
  note: { fontSize: TYPE.caption, color: "rgba(255,255,255,0.65)", fontFamily: "Pretendard-Regular", textAlign: "center", paddingHorizontal: 20, paddingTop: 10 },
  footer: { flexDirection: "row", gap: 8, padding: 16 },
  secondary: { flex: 1, minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: TYPE.body, color: "#FFFFFF", fontFamily: "Pretendard-Medium" },
  primary: { flex: 2, minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: TYPE.body, color: "#FFFFFF", fontFamily: "Pretendard-SemiBold" },
});
