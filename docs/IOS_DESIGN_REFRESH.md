# iOS 디자인 정비 설계안

작성일: 2026-10-23 · 상태: 초안 (사용자 승인 전, 코드 변경 없음)

## 목표

App Store 출시를 앞두고, iOS에서 앱의 틀(탭바, 헤더 메뉴, 시트, 알림, 스위치)이 iOS 26/27 기본 모습으로 보이게 한다. 환자 기록 영역의 가독성과 현장 조작성은 그대로 지킨다.

원칙:

1. **틀만 네이티브로 바꾼다.** 탭바, 메뉴, 시트, 알림, 스위치는 시스템 컴포넌트에 맡긴다. 이렇게 하면 Liquid Glass와 iOS 27의 투명도 설정이 자동으로 적용된다.
2. **기록 영역은 불투명하게 유지한다.** 인적사항, 활력징후, 메모, 첨부는 지금처럼 불투명 카드로 둔다. Apple도 유리 위에 유리를 겹치지 말라고 하고, 현장에서는 가독성이 먼저다.
3. **Android는 바꾸지 않는다.** 모든 변경은 `Platform.OS === "ios"` 분기나 `.ios.tsx` 파일로 한정한다. 예외는 Android 영향 표에 따로 적는다.
4. **기능과 저장은 바꾸지 않는다.** 저장 구조, 버튼 동작 순서, 취소·적용 규칙(초안을 편집하다 적용할 때만 반영)을 유지한다.

하지 않는 것:

- 기록 카드에 유리 재질 적용
- expo-router 도입 같은 앱 전체 내비게이션 구조 교체
- Android Material 3 개편
- 브랜드 색·서체 교체 (Pretendard와 119 레드는 유지)

## 현재 상태 (검토 결과)

| 영역 | 현재 구현 | iOS 26/27 기본 | 위치 |
|---|---|---|---|
| 하단 탭 | 스크롤 아래 고정된 높이 60 불투명 바, 위쪽 가는 선 | 콘텐츠 위에 떠 있는 유리 탭바, 스크롤 시 축소 가능, 콘텐츠가 바 아래로 지나감 | `App.tsx` `BottomNavigation` |
| 헤더 `…` | 스크롤 안에 있는 헤더, 누르면 가운데 대화상자 "기록 옵션" | 버튼에서 펼쳐지는 메뉴(UIMenu) | `App.tsx` 헤더, `CenteredDialog` |
| 알림·확인 | 직접 만든 가운데 카드 (`useNoteAlert`, 사용처 약 39곳) | 시스템 알림(유리 재질, 버튼에서 나타나는 전환) | `src/NoteDialogs.tsx` |
| 시트 | 투명 Modal 위에 직접 그린 하단 시트, "완료" 글자 버튼, 손잡이·높이 단계 없음 | 시스템 시트: 일부 열림은 떠 있는 유리, 전체 열림은 불투명, 손잡이, 스와이프로 닫기 | 병력 선택(`PatientNoteScreen`), 날짜·시각 휠(`DateTimeWheelPicker`) |
| 스위치 | 직접 만든 Squish 스위치 53.2×26.6 | 시스템 스위치(UISwitch) | `src/SquishThemeSwitch.tsx` (3곳) |
| 아이콘 | Ionicons | SF Symbols (글자 굵기·크기와 연동) | 전체 |
| 햅틱 | 없음 | 선택 변경·토글·삭제 확인에 가벼운 햅틱 | — |
| 글자 | 상단 "FIELD NOTE" 10pt, 크기를 숫자로 직접 지정 | 최소 11pt, Dynamic Type 반영 | `App.tsx` `noteBrandText`, `src/design.ts` |
| 모서리 | 바깥 26 / 여백 20 / 안쪽 16 | 동심형(안쪽 ≈ 바깥 − 여백) | `PatientNoteScreen` 스타일 |

## 정비 항목과 우선순위

우선순위 기준: **P1** iOS 출시 전에 꼭 할 것(눈에 크게 띄거나 iOS에서 동작 위험이 있음) / **P2** 출시 전에 하는 것이 좋음 / **P3** 출시 후 다듬기.

### P1-1. 알림을 iOS 시스템 알림으로

- iOS에서는 `NoteDialogProvider`의 큐를 그대로 두고, 화면에 그리는 부분만 `Alert.alert`(UIAlertController)로 바꾼다. 앱 코드의 `useNoteAlert()` 호출 39곳은 고치지 않는다.
- 한 번에 하나만 띄우는 규칙을 유지한다. 앞 알림의 버튼이 눌린 뒤에 다음 알림을 띄운다.
- 지켜야 할 기존 규칙:
  - 알림을 띄우는 것만으로는 동작하지 않는다
  - 바깥을 눌러 닫으면 취소로 처리한다
  - 연속으로 눌러도 한 번만 실행된다
  - "취소" 버튼은 `style: "cancel"`, "삭제" 버튼은 `style: "destructive"`로 시스템 스타일에 맞춘다
- 덤 효과: iOS 전용으로 만든 "모달 안 알림 자리"(`NoteModal`/`NoteAlertOutlet`)가 필요 없어진다. RN의 iOS 알림은 별도 창에 뜨므로 모달 위에서도 보인다. 단, **이 동작은 실기기에서 확인한 뒤에** 그 코드를 걷어낸다.
- Android 영향: 없음 (지금의 가운데 카드를 유지)
- 규모: 작음 · 위험: 낮음

### P1-2. 헤더 `…` → 버튼에서 펼쳐지는 메뉴

- iOS에서는 "기록 옵션" 대화상자 대신 UIMenu를 띄운다. 항목:
  - 화면 모드 (시스템 / 라이트 / 다크)
  - 휠 피커 사용 (켬·끔 체크 표시)
  - 소속 설정 (입력이 필요하므로 시트로 연다)
  - 환자 기록 전체 초기화 (빨간 destructive 항목, 누르면 지금처럼 확인 알림을 거친다)
- 후보 라이브러리:
  - `@react-native-menu/menu` 2.0.0: iOS는 UIMenu, Android는 팝업 메뉴. Android에는 쓰지 않는다
  - `@expo/ui` ContextMenu: SDK 54 기준 베타라 후보에서 낮춘다
- Android 영향: 없음 (지금 대화상자를 유지)
- 규모: 작음~중간 · 위험: 낮음

### P1-3. 하단 탭 → iOS 네이티브 탭바

- iOS에서는 UITabBarController 기반 네이티브 탭바로 바꾼다. iOS 26에서는 유리 탭바가 자동으로 적용된다. 탭은 메모 / 다수사상자 / 설정 그대로이고, 아이콘은 SF Symbols로 한다.
- 후보: `react-native-bottom-tabs` 1.5.0 (네이티브 탭). React Navigation 없이 단독으로 쓸 수 있는지는 **검증이 필요하다**.
- 꼭 지킬 동작:
  - 녹음이나 촬영 중(`mediaBusy`)에는 탭 이동을 막고 "기록 진행 중" 알림을 띄운다. 네이티브 탭에서 선택을 가로채 취소할 수 있는지 먼저 확인한다
  - 탭을 바꿔도 메모 화면 상태(스크롤, 입력 중인 내용)가 유지된다
  - 키보드가 올라올 때 탭바와 입력창이 겹치지 않는다
- 콘텐츠가 탭바 아래로 지나가므로, 스크롤 마지막 여백을 탭바 높이만큼 준다.
- 위 동작 중 하나라도 보장되지 않으면, 대안으로 `expo-glass-effect`의 GlassView로 떠 있는 캡슐 탭바를 직접 만든다. 유리 효과는 iOS 26 이상에서만 나오고, 그보다 낮은 버전에서는 불투명 배경으로 대신한다.
- Android 영향: 없음 (지금 `BottomNavigation` 유지). 단, 라이브러리를 Android에서도 불러오지 않도록 분기한다
- 규모: 중간~큼 · 위험: 중간 (탭 이동 막기, 키보드 처리)

### P2-1. 시트를 iOS 시스템 시트로

- 대상: 병력 선택, 생년월일·Onset·측정 시각 휠, 보호자 정보 편집(`PatientContacts`의 `CenteredDialog`)
- 1단계는 RN `Modal`의 `presentationStyle="pageSheet"`와 `allowSwipeDismissal`(RN 0.81)로 시스템 시트에 손잡이와 스와이프 닫기를 붙인다.
  - 스와이프로 닫으면 **취소로 처리한다.** 휠은 지금처럼 초안을 편집하다 "적용"할 때만 기록에 반영한다.
  - 높이 단계(중간/전체)는 RN `Modal`이 지원하지 않는다. 필요하면 2단계에서 `@lodev09/react-native-true-sheet` 3.x를 검토한다. 이 라이브러리는 의존성이 많아서(reanimated 4, worklets 등) 별도 승인을 받는다.
- 시트 안의 휠은 지금 구현을 유지한다. 한국식 연·월·일 순서, 길게 누르면 빨라지는 가속, 큰 행 높이 때문이다. UIDatePicker로 바꾸지 않는다.
- "완료" 글자 버튼 → iOS 26 방식의 ✓ 아이콘 버튼(SF Symbol `checkmark`)
- 직접 지정한 시트 배경과 모서리는 iOS에서 빼서 시스템 재질이 보이게 한다.
- Android 영향: 없음 (`presentationStyle`은 iOS 전용 속성이고, Android 분기는 지금 스타일 유지)
- 규모: 중간 · 위험: 낮음~중간 (스와이프로 닫을 때의 취소 처리)

### P2-2. 스위치 → Squish 유지 (2026-10-23 사용자 결정)

- 시스템 스위치(UISwitch)로 바꾸지 않는다. React Bits Squish Switch를 옮겨 만든 `SquishThemeSwitch`를 양쪽 플랫폼에서 그대로 쓴다. 크기 53.2×26.6, 색, 늘어나는 움직임 모두 유지한다.
- 기록 옵션은 토글이 더 직관적이라는 판단에 따라 메뉴의 체크 항목 대신 토글 목록으로 한다. 시안의 "기록 옵션 · 토글 대안 A·B"에서 고른다.
- iOS에서 할 일은 햅틱(P2-3)과, 시트 안에 놓였을 때 줄 높이·여백을 맞추는 것뿐이다.
- Android 영향: 없음
- 규모: 작음 · 위험: 낮음

### P2-3. 햅틱

- `expo-haptics`(SDK 54 번들 ~15.0.8)를 쓴다.
  - 선택 변경(환자·회차·성별 탭, 휠 칸 이동): selection
  - 스위치: light impact
  - 삭제 확인과 저장 실패: warning notification
- 처음에는 iOS에서만 켠다. Android에도 켤지는 따로 정한다.
- Android 영향: 없음 (iOS 한정일 때)
- 규모: 작음 · 위험: 낮음

### P3-1. SF Symbols

- `expo-symbols`(SDK 54 번들 ~1.0.8)를 쓴다. iOS에서는 SF Symbols, Android에서는 지금의 Ionicons가 나오도록 공통 `AppIcon` 컴포넌트를 하나 만든다.
- 이름 대응 예: `scan-outline` → `viewfinder`, `trash-outline` → `trash`, `pencil-outline` → `pencil`, `add` → `plus`, `ellipsis-horizontal` → `ellipsis`
- Android 영향: 없음
- 규모: 중간(사용처가 많음) · 위험: 낮음

### P3-2. 글자와 Dynamic Type

- "FIELD NOTE" 10pt → 11pt 이상. **양쪽 플랫폼에 적용된다.**
- 큰 글자 설정(접근성 크기 포함)에서 잘림 점검: 활력징후 타일, 생년월일·만 나이 줄, 환자 탭, 하단 탭. 이미 `fontScale`로 분기하는 곳(`narrow`, 1.7 이상이면 한 열)을 기준으로 보완한다.
- Android 영향: 있음 (글자 1pt). 화면 배치 변화는 없음

### P3-3. 동심형 모서리와 디자인 문서

- iOS에서 바깥 카드, 여백, 안쪽 카드의 반경을 동심형 규칙에 맞춘다. 수치는 시안을 본 뒤 정한다.
- `docs/DESIGN_SYSTEM.md`를 실제 토큰에 맞게 고친다. 지금 문서는 틸·민트 기준인데 실제 코드는 슬레이트 블루(#4B6276)와 119 레드다. 플랫폼별 차이도 이 문서에 정리한다.
- Android 영향: 모서리는 iOS 한정이면 없음. 문서는 해당 없음

## Android 영향 요약

| 항목 | Android 화면 변화 | Android 동작 변화 | 비고 |
|---|---|---|---|
| P1-1 알림 | 없음 | 없음 | iOS만 시스템 알림 |
| P1-2 메뉴 | 없음 | 없음 | iOS만 UIMenu |
| P1-3 탭바 | 없음 | 없음 | 라이브러리를 Android에서 불러오지 않게 분기 |
| P2-1 시트 | 없음 | 없음 | `presentationStyle`은 iOS 전용 |
| P2-2 스위치 | 없음 | 없음 | |
| P2-3 햅틱 | 없음 | 없음 | iOS 한정일 때 |
| P3-1 아이콘 | 없음 | 없음 | Android는 Ionicons 유지 |
| P3-2 글자 | **있음 (FIELD NOTE 1pt)** | 없음 | |
| P3-3 모서리·문서 | 없음 | 없음 | |

공통 위험: 플랫폼 분기가 늘면 같은 기능을 두 벌로 관리하게 된다. 다음으로 줄인다.

- 데이터와 동작(큐, 취소 규칙, 적용 시점)은 지금 공통 코드에 두고, **그리는 부분만** 플랫폼별로 나눈다.
- 기존 테스트(대화상자가 한 번만 실행되는지, 휠 초안·적용 등)는 iOS와 Android 두 경우를 모두 돌리게 확장한다. `test-note-dialogs.cjs` 하네스에 이미 `os` 옵션이 있다.
- Android 회귀 확인: 바꾸기 전과 후에 같은 데이터로 Android 화면을 캡처해 비교한다.

## 진행 순서 (제안)

1. P1-1 알림, P2-2 스위치, P2-3 햅틱 — 작고 독립적이라 한 번에 진행한다
2. P1-2 메뉴
3. P1-3 탭바 — 탭 이동 막기와 키보드 처리를 먼저 시제품으로 검증한 뒤 본 구현
4. P2-1 시트
5. P3 항목들

단계마다 tsc, lint, 테스트를 통과시키고, iOS 시뮬레이터와 Android 실기기에서 확인한다. 새 패키지를 추가할 때(`@react-native-menu/menu`, `react-native-bottom-tabs`, `expo-haptics`, `expo-symbols`, 필요하면 `expo-glass-effect`)는 단계별로 승인을 받는다.

## 검증 계획

- **iOS 시뮬레이터:** iOS 26과 iOS 27 각각에서 라이트·다크, 투명도 줄이기(Reduce Transparency), iOS 27 투명도 슬라이더 최소·최대, Dynamic Type 기본·최대·접근성 크기, VoiceOver로 탭·메뉴·시트·알림 이동
- **iOS 시나리오:**
  - 옵션 메뉴 → 소속 저장 → 알림 표시 (모달 위 알림)
  - 녹음 중 탭 이동 차단
  - 휠 시트를 스와이프로 닫으면 기록이 바뀌지 않음
  - 전체 초기화 확인 → 취소
- **Android 실기기:** 위 시나리오가 지금과 똑같이 동작하는지, 화면 캡처 비교
- **빌드:** Xcode 26 SDK로 빌드해야 Liquid Glass가 적용된다. `Info.plist`에 호환 모드(`UIDesignRequiresCompatibility`)를 넣지 않는다.

## 결정이 필요한 것

1. iOS 최소 지원 버전 — iOS 26 미만에서는 유리 효과 없이 불투명으로 대신 그린다
2. 햅틱을 Android에도 켤지
3. 높이 단계가 있는 시트가 필요한지 — 필요하면 true-sheet의 무거운 의존성을 감수해야 한다
4. 하단 탭바: 네이티브 탭바(1안) 대 GlassView로 직접 만드는 탭바(2안). 시제품 결과를 보고 정한다

## 참고

- Apple WWDC25 "Get to know the new design system": https://developer.apple.com/videos/play/wwdc2025/356/
- Apple WWDC25 "Build a UIKit app with the new design": https://developer.apple.com/videos/play/wwdc2025/284/
- Apple WWDC25 "Meet Liquid Glass": https://developer.apple.com/videos/play/wwdc2025/219/
- iOS 27 투명도 조절 보도 (BGR): https://www.bgr.com/2191219/ios-27-liquid-glass-fix-customization/
