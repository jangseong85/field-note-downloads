import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert as NativeAlert,
  AlertButton,
  Modal,
  ModalProps,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clinicalTheme } from "./clinicalTheme";

type Request = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};
type DialogContext = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  queue: Request[];
  dismiss: (id: number) => void;
};
// iOS는 시스템 알림을 쓴다. RN은 알림을 별도 창(UIWindowLevelAlert)에 띄우므로 열린 모달 위에서도 보이고,
// 모달을 하나 더 띄우지 못하는 iOS 제약에 걸리지 않는다. Android는 앱 자체 가운데 대화상자를 쓴다.
const USE_NATIVE_ALERTS = Platform.OS === "ios";
const FAILED_ACTION = [
  "작업 확인",
  "작업을 완료하지 못했습니다. 기록을 확인하고 다시 시도해 주세요.",
] as const;

/** System alert buttons for a queued request: each one dismisses the request, then runs once. */
export function nativeAlertButtons(
  request: Request,
  dismiss: (id: number) => void,
  alert: DialogContext["alert"],
): AlertButton[] {
  let handled = false;
  return [
    ...request.buttons.filter((button) => button.style !== "cancel"),
    ...request.buttons.filter((button) => button.style === "cancel"),
  ].map((button) => ({
    text: button.text ?? "확인",
    style: button.style,
    onPress: () => {
      if (handled) return;
      handled = true;
      dismiss(request.id);
      void Promise.resolve()
        .then(() => button.onPress?.())
        .catch(() => alert(...FAILED_ACTION));
    },
  }));
}
const Context = createContext<DialogContext | null>(null);
export function NoteDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queue, setQueue] = useState<Request[]>([]);
  const sequence = useRef(0);
  const alert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      const item = {
        id: ++sequence.current,
        title,
        message,
        buttons: buttons?.length ? buttons : [{ text: "확인" }],
      };
      setQueue((previous) => [...previous, item]);
    },
    [],
  );
  const dismiss = useCallback(
    (id: number) =>
      setQueue((previous) => previous.filter((item) => item.id !== id)),
    [],
  );
  const value = useMemo(
    () => ({ alert, queue, dismiss }),
    [alert, queue, dismiss],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function useDialogs() {
  const context = useContext(Context);
  if (!context) throw new Error("NoteDialogProvider is required");
  return context;
}
export function useNoteAlert() {
  return useDialogs().alert;
}

export function CenteredDialog({
  visible,
  isDark,
  title,
  message,
  onClose,
  children,
}: {
  visible: boolean;
  isDark: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <NoteModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <DialogPanel
        isDark={isDark}
        title={title}
        message={message}
        onClose={onClose}
      >
        {children}
      </DialogPanel>
    </NoteModal>
  );
}

function DialogPanel({
  isDark,
  title,
  message,
  onClose,
  children,
}: {
  isDark: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = clinicalTheme(isDark);
  return (
    <View style={styles.stage}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessible={false}
      />
      <View
        accessibilityViewIsModal
        style={[styles.panel, { backgroundColor: t.surface }]}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: t.ink }]}
          >
            {title}
          </Text>
          {message ? (
            <Text style={[styles.message, { color: t.muted }]}>{message}</Text>
          ) : null}
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// 앱의 모든 모달이 거치는 한 곳. 모달별 플랫폼 처리가 필요해지면 여기서 한다.
export function NoteModal(props: ModalProps) {
  return <Modal {...props} />;
}
export function NoteDialogHost({ isDark }: { isDark: boolean }) {
  const { queue, dismiss, alert } = useDialogs();
  const shown = useRef<number | null>(null);
  const current = queue[0];
  useEffect(() => {
    if (!USE_NATIVE_ALERTS || !current || shown.current === current.id) return;
    shown.current = current.id;
    NativeAlert.alert(
      current.title,
      current.message,
      nativeAlertButtons(current, dismiss, alert),
      {
        cancelable: false,
      },
    );
  }, [current, dismiss, alert]);
  if (USE_NATIVE_ALERTS) return null;
  return <NoteAlertPanel isDark={isDark} />;
}
export function NoteAlertPanel({ isDark }: { isDark: boolean }) {
  const { queue, dismiss, alert } = useDialogs();
  const handled = useRef<number | null>(null);
  const current = queue[0];
  const t = clinicalTheme(isDark);
  if (!current) return null;
  const cancel = () => {
    if (handled.current === current.id) return;
    handled.current = current.id;
    dismiss(current.id);
    current.buttons.find((button) => button.style === "cancel")?.onPress?.();
  };
  const buttons = [
    ...current.buttons.filter((button) => button.style !== "cancel"),
    ...current.buttons.filter((button) => button.style === "cancel"),
  ];
  const panel = (
    <DialogPanel
      isDark={isDark}
      title={current.title}
      message={current.message}
      onClose={cancel}
    >
      <View style={styles.actions}>
        {buttons.map((button, index) => (
          <Pressable
            key={`${index}-${button.text}`}
            accessibilityRole="button"
            onPress={() => {
              if (handled.current === current.id) return;
              handled.current = current.id;
              dismiss(current.id);
              void Promise.resolve()
                .then(() => button.onPress?.())
                .catch(() => alert(...FAILED_ACTION));
            }}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor:
                  button.style === "cancel" ? "transparent" : t.field,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.actionText,
                {
                  color:
                    button.style === "destructive"
                      ? t.danger
                      : button.style === "cancel"
                        ? t.muted
                        : t.ink,
                },
              ]}
            >
              {button.text ?? "확인"}
            </Text>
          </Pressable>
        ))}
      </View>
    </DialogPanel>
  );
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={cancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {panel}
    </Modal>
  );
}
const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  panel: {
    width: "100%",
    maxWidth: 350,
    maxHeight: "80%",
    borderRadius: 24,
    overflow: "hidden",
  },
  content: { padding: 22, gap: 16 },
  title: {
    fontSize: 19,
    fontFamily: "Pretendard-SemiBold",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Pretendard-Regular",
    textAlign: "center",
  },
  actions: { gap: 8, marginTop: 2 },
  action: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    textAlign: "center",
  },
});
