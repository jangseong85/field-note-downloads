import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { createMediaSaveTask, MediaSaveTask, runMediaSave } from "./mediaSave";
import { clinicalTheme } from "./clinicalTheme";
import { RecordTabs } from "./ClinicalControls";
import { NoteModal, useNoteAlert } from "./NoteDialogs";
import SendPhotosSheet from "./SendPhotosSheet";
import type { SmsSource } from "./smsMessage";

export type MemoAttachment = {
  id: string;
  kind: "photo" | "audio";
  uri: string;
  createdAt: string;
  duration?: number;
};
const durationText = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const clockFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
/** Korea-time HH:MM of when the attachment was saved. */
export const attachmentClock = (iso: string) => {
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? "" : clockFormat.format(time);
};
type PendingMedia = {
  task: MediaSaveTask<MemoAttachment>;
  commit: (attachment: MemoAttachment) => Promise<void>;
};

export default function MemoAttachments({
  attachments,
  isDark,
  onAppend,
  onRemove,
  onBusyChange,
  smsSource,
  contacts,
}: {
  attachments: MemoAttachment[];
  isDark: boolean;
  onAppend: (attachment: MemoAttachment) => Promise<void>;
  /** Removes the attachment from the saved record, then deletes its file. */
  onRemove: (attachment: MemoAttachment) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  smsSource: Omit<SmsSource, "photoCount">;
  contacts: { label: string; phone: string }[];
}) {
  const Alert = { alert: useNoteAlert() };
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioNeedsRetry, setAudioNeedsRetry] = useState(false);
  const [photoNeedsRetry, setPhotoNeedsRetry] = useState(false);
  const [working, setWorking] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerScroll = useRef<ScrollView>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const photos = attachments.filter((item) => item.kind === "photo");
  const recordings = attachments.filter((item) => item.kind === "audio");
  const [listMode, setListMode] = useState<"photo" | "audio">("photo");
  const showPhotos = photos.length > 0 && (listMode === "photo" || recordings.length === 0);
  const showRecordings = recordings.length > 0 && (listMode === "audio" || photos.length === 0);
  const [permission, requestCameraPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const operation = useRef(false);
  const recordingRef = useRef(false);
  const pendingAudio = useRef<PendingMedia | null>(null);
  const pendingPhoto = useRef<PendingMedia | null>(null);
  const recordingOwner = useRef(onAppend);
  const appendRef = useRef(onAppend);
  appendRef.current = onAppend;
  const t = clinicalTheme(isDark);
  const muted = t.muted,
    accent = t.accent;
  function prepareFile(
    uri: string,
    kind: "photo" | "audio",
    seconds?: number,
    commit = appendRef.current,
  ): PendingMedia {
    if (!FileSystem.documentDirectory) throw new Error("Storage unavailable");
    const directory = `${FileSystem.documentDirectory}patient-attachments/`;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      commit,
      task: createMediaSaveTask(
        uri,
        directory,
        `${id}.${kind === "photo" ? "jpg" : "m4a"}`,
        (saved) => ({
          id,
          kind,
          uri: saved,
          createdAt: new Date().toISOString(),
          ...(seconds !== undefined ? { duration: seconds } : {}),
        }),
      ),
    };
  }
  async function stopRecording() {
    if (operation.current || (!recordingRef.current && !pendingAudio.current))
      return;
    operation.current = true;
    setWorking(true);
    try {
      if (!pendingAudio.current) {
        const seconds = recorder.getStatus().durationMillis / 1000;
        await recorder.stop();
        recordingRef.current = false;
        setRecording(false);
        if (!recorder.uri) throw new Error("No recording");
        pendingAudio.current = prepareFile(
          recorder.uri,
          "audio",
          seconds,
          recordingOwner.current,
        );
        setAudioNeedsRetry(true);
      }
      const pending = pendingAudio.current;
      await runMediaSave(pending.task, FileSystem, pending.commit);
      pendingAudio.current = null;
      setAudioNeedsRetry(false);
    } catch {
      recordingRef.current = recorder.getStatus().isRecording;
      setRecording(recordingRef.current);
      Alert.alert(
        "녹취 확인",
        pendingAudio.current
          ? "미저장 녹취를 유지하고 있습니다. 저장 공간을 확인한 뒤 저장 재시도를 눌러 주세요."
          : "녹취를 중지하지 못했습니다. 마이크 상태를 확인한 뒤 다시 중지를 눌러 주세요.",
      );
    } finally {
      if (!recordingRef.current) {
        await setAudioModeAsync({ allowsRecording: false }).catch(
          () => undefined,
        );
        onBusyChange(pendingAudio.current !== null);
      }
      operation.current = false;
      setWorking(false);
    }
  }
  const stopRef = useRef(stopRecording);
  stopRef.current = stopRecording;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && recordingRef.current) void stopRef.current();
    });
    return () => subscription.remove();
  }, []);
  async function beginRecording() {
    if (operation.current || recordingRef.current || pendingAudio.current)
      return;
    operation.current = true;
    setWorking(true);
    onBusyChange(true);
    recordingOwner.current = appendRef.current;
    try {
      const result = await requestRecordingPermissionsAsync();
      if (!result.granted) {
        Alert.alert(
          "마이크 권한 필요",
          "설정에서 마이크 접근을 허용해 주세요.",
        );
        return;
      }
      if (AppState.currentState !== "active") return;
      player.pause();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      if (AppState.currentState !== "active") return;
      recorder.record();
      recordingRef.current = true;
      setRecording(true);
    } catch {
      Alert.alert(
        "녹취 시작 실패",
        "마이크가 다른 앱에서 사용 중인지 확인해 주세요.",
      );
    } finally {
      if (!recordingRef.current) {
        await setAudioModeAsync({ allowsRecording: false }).catch(
          () => undefined,
        );
        onBusyChange(false);
      }
      operation.current = false;
      setWorking(false);
    }
  }
  function requestRecording() {
    if (recordingRef.current || pendingAudio.current) {
      void stopRecording();
      return;
    }
    Alert.alert(
      "현장 녹취",
      "환자·보호자에게 녹취 목적을 알리고 동의를 받은 후 시작하세요. 녹취는 이 기기에만 저장됩니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "동의 확인 · 시작", onPress: () => void beginRecording() },
      ],
    );
  }
  async function openCamera() {
    if (operation.current || recordingRef.current || pendingAudio.current)
      return;
    operation.current = true;
    onBusyChange(true);
    try {
      const granted =
        permission?.granted || (await requestCameraPermission()).granted;
      if (!granted) {
        Alert.alert(
          "카메라 권한 필요",
          "설정에서 카메라 접근을 허용해 주세요.",
        );
        onBusyChange(false);
        return;
      }
      player.pause();
      setCameraReady(false);
      setCameraVisible(true);
    } catch {
      onBusyChange(false);
      Alert.alert("카메라 확인", "카메라를 열지 못했습니다.");
    } finally {
      operation.current = false;
    }
  }
  async function closeCamera() {
    if (operation.current) return;
    operation.current = true;
    setWorking(true);
    try {
      const pending = pendingPhoto.current;
      if (pending && !pending.task.committed)
        await FileSystem.deleteAsync(
          pending.task.moved ? pending.task.savedUri : pending.task.sourceUri,
          { idempotent: true },
        );
      pendingPhoto.current = null;
      setPhotoNeedsRetry(false);
      setCameraVisible(false);
      onBusyChange(false);
    } catch {
      Alert.alert(
        "임시 사진 정리 실패",
        "기존 환자 사진은 유지됩니다. 다시 닫기를 눌러 주세요.",
      );
    } finally {
      operation.current = false;
      setWorking(false);
    }
  }
  async function takePhoto() {
    if (
      operation.current ||
      (!pendingPhoto.current && (!cameraReady || !camera.current))
    )
      return;
    operation.current = true;
    setWorking(true);
    try {
      if (!pendingPhoto.current) {
        const photo = await camera.current!.takePictureAsync({ quality: 0.7 });
        if (!photo?.uri) throw new Error("No photo");
        pendingPhoto.current = prepareFile(photo.uri, "photo");
        setPhotoNeedsRetry(true);
      }
      const pending = pendingPhoto.current;
      await runMediaSave(pending.task, FileSystem, pending.commit);
      pendingPhoto.current = null;
      setPhotoNeedsRetry(false);
      setCameraVisible(false);
      onBusyChange(false);
    } catch {
      Alert.alert(
        "사진 저장 실패",
        pendingPhoto.current
          ? "촬영한 사진을 유지하고 있습니다. 촬영 버튼을 눌러 저장을 재시도하세요."
          : "저장 공간을 확인한 뒤 다시 촬영해 주세요.",
      );
    } finally {
      operation.current = false;
      setWorking(false);
    }
  }
  async function play(item: MemoAttachment) {
    if (recording || working) return;
    if (playingId === item.id && playback.playing) {
      player.pause();
      return;
    }
    try {
      // 같은 녹취는 멈춘 자리에서 이어 재생하고, 끝까지 들었으면 처음부터 다시 재생한다.
      if (playingId === item.id && playback.isLoaded) {
        if (playback.duration > 0 && playback.currentTime >= playback.duration - 0.25) {
          await player.seekTo(0);
        }
        player.play();
        return;
      }
      // 파일 오류는 replace()에서 바로 드러나지 않으므로 재생 전에 확인한다.
      const info = await FileSystem.getInfoAsync(item.uri);
      if (!info.exists || info.size === 0) throw new Error("missing recording");
      player.replace(item.uri);
      setPlayingId(item.id);
      player.play();
    } catch {
      Alert.alert("녹취 재생 실패", "이 기기에서 파일을 찾을 수 없습니다.");
    }
  }
  function confirmRemove(item: MemoAttachment) {
    if (recording || working) return;
    const clock = attachmentClock(item.createdAt);
    const photo = item.kind === "photo";
    Alert.alert(
      photo ? "사진 삭제" : "녹취 삭제",
      `${clock ? `${clock}에 ${photo ? "촬영한 사진" : "녹음한 녹취"}을` : photo ? "이 사진을" : "이 녹취를"} 이 기기에서 삭제합니다.${photo ? "" : " 법적 근거로 쓰일 수 있는 녹취입니다."} 삭제 후에는 복구할 수 없습니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            if (playingId === item.id) {
              player.pause();
              setPlayingId(null);
            }
            if (photo) setViewerIndex(null);
            await onRemove(item);
          },
        },
      ],
    );
  }
  const viewerPhoto = viewerIndex === null ? null : photos[viewerIndex] ?? null;
  return (
    <View>
      <View style={styles.toolsHeading}>
        <Text style={[styles.toolsTitle, { color: t.muted }]}>첨부</Text>
        {attachments.length > 0 && (
          <Text style={[styles.caption, { color: t.muted }]}>
            {attachments.length}개
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            audioNeedsRetry
              ? "녹취 저장 재시도"
              : recording
                ? "녹취 중지 및 저장"
                : "현장 녹취 시작"
          }
          disabled={working}
          onPress={requestRecording}
          style={[
            styles.action,
            { backgroundColor: recording || audioNeedsRetry ? t.dangerSoft : t.field },
            working && { opacity: 0.5 },
          ]}
        >
          <View style={[styles.toolIcon, { backgroundColor: t.surface }]}>
            {working ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Ionicons
                name={recording ? "stop" : "mic-outline"}
                size={21}
                color={recording || audioNeedsRetry ? t.danger : t.ink}
              />
            )}
          </View>
          <View style={styles.toolCopy}>
            <Text
              numberOfLines={1}
              style={[
                styles.actionText,
                { color: recording || audioNeedsRetry ? t.danger : t.ink },
              ]}
            >
              {audioNeedsRetry
                ? "저장 재시도"
                : recording
                  ? "녹취 중지"
                  : "녹취"}
            </Text>
            {recording && (
              <Text
                numberOfLines={1}
                style={[styles.toolDetail, { color: t.muted }]}
              >
                {durationText(recordingState.durationMillis / 1000)}
              </Text>
            )}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="환자 환부 사진 촬영"
          disabled={recording || working || audioNeedsRetry}
          onPress={() => void openCamera()}
          style={[
            styles.action,
            { backgroundColor: t.field },
            (recording || working || audioNeedsRetry) && { opacity: 0.4 },
          ]}
        >
          <View style={[styles.toolIcon, { backgroundColor: t.surface }]}>
            <Ionicons name="camera-outline" size={21} color={t.ink} />
          </View>
          <View style={styles.toolCopy}>
            <Text style={[styles.actionText, { color: t.ink }]}>사진</Text>
          </View>
        </Pressable>
      </View>
      {audioNeedsRetry && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.caption, { color: t.accent }]}
        >
          미저장 녹취가 있습니다. 저장 재시도를 마친 후 환자를 전환할 수
          있습니다.
        </Text>
      )}
      {photos.length > 0 && recordings.length > 0 && (
        <View style={styles.segment}>
          <RecordTabs
            isDark={isDark}
            label="첨부 보기 전환"
            options={[
              { id: "photo", label: `사진 ${photos.length}` },
              { id: "audio", label: `녹취 ${recordings.length}` },
            ]}
            selectedId={listMode}
            onSelect={(id) => setListMode(id === "audio" ? "audio" : "photo")}
          />
        </View>
      )}
      {showPhotos && (
        <>
          <Text style={[styles.groupLabel, { color: t.muted }]}>사진 {photos.length}</Text>
          <View style={styles.photoGrid}>
            {photos.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`사진 ${index + 1} 보기, ${attachmentClock(item.createdAt)} 촬영`}
                onPress={() => setViewerIndex(index)}
                style={[styles.photoCell, { backgroundColor: t.field }]}
              >
                <Image source={{ uri: item.uri }} style={styles.photo} />
                {!!attachmentClock(item.createdAt) && (
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>{attachmentClock(item.createdAt)}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}
      {showRecordings && (
        <>
          <Text style={[styles.groupLabel, { color: t.muted }]}>녹취 {recordings.length}</Text>
          {recordings.map((item, index) => {
            const active = playingId === item.id;
            const total = active && playback.duration > 0 ? playback.duration : item.duration ?? 0;
            const current = active ? Math.min(playback.currentTime, total) : 0;
            return (
              <View key={item.id} style={[styles.recording, { backgroundColor: t.field }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`녹취 ${index + 1} ${active && playback.playing ? "일시정지" : "재생"}`}
                  onPress={() => void play(item)}
                  style={styles.recordingPlay}
                >
                  <Ionicons
                    name={active && playback.playing ? "pause" : "play"}
                    size={20}
                    color={accent}
                  />
                </Pressable>
                <View style={styles.recordingBody}>
                  <View style={styles.recordingMeta}>
                    <Text style={[styles.recordingTime, { color: t.ink }]}>
                      {attachmentClock(item.createdAt) || `녹취 ${index + 1}`}
                    </Text>
                    <Text style={[styles.caption, { color: muted, marginTop: 0 }]}>
                      {active ? `${durationText(current)} / ` : ""}
                      {durationText(total)}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: accent, width: `${total > 0 ? (current / total) * 100 : 0}%` },
                      ]}
                    />
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`녹취 ${index + 1} 삭제`}
                  disabled={recording || working}
                  onPress={() => confirmRemove(item)}
                  style={[styles.recordingPlay, (recording || working) && { opacity: 0.35 }]}
                >
                  <Ionicons name="trash-outline" size={19} color={t.muted} />
                </Pressable>
              </View>
            );
          })}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="사진과 기록을 문자로 보내기"
        disabled={recording || working}
        onPress={() => setSmsOpen(true)}
        style={({ pressed }) => [
          styles.smsButton,
          { backgroundColor: t.field, opacity: recording || working ? 0.4 : pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={accent} />
        <Text style={[styles.smsText, { color: accent }]}>문자로 보내기</Text>
      </Pressable>
      <SendPhotosSheet
        visible={smsOpen}
        isDark={isDark}
        photos={photos}
        source={smsSource}
        contacts={contacts}
        onClose={() => setSmsOpen(false)}
      />
      <NoteModal
        visible={cameraVisible}
        onRequestClose={() => void closeCamera()}
        animationType="slide"
      >
        <SafeAreaView style={styles.cameraPage}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 촬영 취소"
              onPress={() => void closeCamera()}
              disabled={working}
              style={styles.close}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.modalTitle}>환자 사진</Text>
            <View style={styles.close} />
          </View>
          {cameraVisible && (
            <CameraView
              ref={camera}
              style={styles.camera}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => {
                if (!pendingPhoto.current) {
                  setCameraVisible(false);
                  onBusyChange(false);
                }
                Alert.alert(
                  "카메라 오류",
                  "다른 앱에서 카메라를 사용 중인지 확인해 주세요.",
                );
              }}
            />
          )}
          <View style={styles.shutterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 촬영 및 저장"
              disabled={(!cameraReady && !photoNeedsRetry) || working}
              onPress={() => void takePhoto()}
              style={styles.shutter}
            >
              {working ? (
                <ActivityIndicator color={accent} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </NoteModal>
      <NoteModal
        visible={viewerPhoto !== null}
        onRequestClose={() => setViewerIndex(null)}
        animationType="fade"
      >
        <SafeAreaView style={styles.cameraPage}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 보기 닫기"
              onPress={() => setViewerIndex(null)}
              style={styles.close}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.modalTitle}>
              {viewerIndex !== null ? `${viewerIndex + 1} / ${photos.length}` : ""}
              {viewerPhoto && attachmentClock(viewerPhoto.createdAt)
                ? ` · ${attachmentClock(viewerPhoto.createdAt)} 촬영`
                : ""}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이 사진 삭제"
              onPress={() => viewerPhoto && confirmRemove(viewerPhoto)}
              style={styles.close}
            >
              <Ionicons name="trash-outline" size={23} color="#FF6B6B" />
            </Pressable>
          </View>
          {viewerIndex !== null && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              ref={viewerScroll}
              // contentOffset is iOS-only; jump to the tapped photo once laid out on both platforms.
              onLayout={() => viewerScroll.current?.scrollTo({ x: viewerIndex * screenWidth, animated: false })}
              onMomentumScrollEnd={({ nativeEvent }) =>
                setViewerIndex(
                  Math.max(0, Math.min(photos.length - 1, Math.round(nativeEvent.contentOffset.x / screenWidth))),
                )
              }
              style={styles.camera}
            >
              {photos.map((item) => (
                <ScrollView
                  key={item.id}
                  style={{ width: screenWidth }}
                  contentContainerStyle={styles.zoomPage}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <Image source={{ uri: item.uri }} style={{ width: screenWidth, flex: 1 }} resizeMode="contain" />
                </ScrollView>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </NoteModal>
    </View>
  );
}
const styles = StyleSheet.create({
  toolsHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  toolsTitle: { fontSize: 13, fontFamily: "Pretendard-Medium" },
  actions: { flexDirection: "row", gap: 8 },
  toolIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  toolCopy: { minWidth: 0, gap: 2 },
  toolDetail: { fontSize: 11, fontFamily: "Pretendard-Regular" },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 26,
  },
  actionText: { fontSize: 15, fontFamily: "Pretendard-Medium" },
  segment: { marginTop: 14 },
  groupLabel: { fontSize: 12, fontFamily: "Pretendard-Medium", marginTop: 14, marginBottom: 6 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  photoCell: { width: "32%", aspectRatio: 1, borderRadius: 12, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  photoBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  photoBadgeText: { fontSize: 11, color: "#FFFFFF", fontFamily: "Pretendard-Medium", fontVariant: ["tabular-nums"] },
  recording: { flexDirection: "row", alignItems: "center", borderRadius: 14, marginTop: 6, paddingHorizontal: 4 },
  recordingPlay: { width: 44, height: 52, alignItems: "center", justifyContent: "center" },
  recordingBody: { flex: 1, gap: 6, paddingVertical: 10 },
  recordingMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recordingTime: { fontSize: 14, fontFamily: "Pretendard-Medium", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  smsButton: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  smsText: { fontSize: 15, fontFamily: "Pretendard-Medium" },
  zoomPage: { flexGrow: 1, justifyContent: "center" },
  caption: { fontSize: 12, marginTop: 4 },
  cameraPage: { flex: 1, backgroundColor: "#000000" },
  camera: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
  },
  close: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    color: "#FFFFFF",
    fontFamily: "Pretendard-Medium",
  },
  shutterRow: { padding: 24, alignItems: "center" },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
});
