# AGENTS.md — 119 | FIELD NOTE (EMS Log)

이 파일은 Codex와 Claude Code가 함께 따르는 공용 규칙입니다. `CLAUDE.md`는 이 파일을 불러옵니다.

## 프로젝트 개요

- 구급대원이 현장에서 환자 정보, 활력징후, 메모, 사진·녹음을 기록하는 오프라인 iOS/Android 앱
- Expo 54, React Native 0.81(New Architecture), React 19, TypeScript
- 서버 없음. 환자 기록은 기기의 AsyncStorage와 앱 문서 폴더에만 저장
- 앱 셸: `App.tsx` / 화면·컨트롤: `src/*.tsx` / 순수 로직: `src/*.ts`
- 디자인 기준 `docs/DESIGN_SYSTEM.md`

## 검증 명령

변경 후 아래가 모두 통과해야 합니다.

```bash
npm run typecheck
npm run lint
node --test scripts/test-*.cjs
```

ML Kit 등 네이티브 모듈이 있어 Expo Go로는 실행되지 않습니다. 실기기 확인은 개발 빌드(`npx expo run:ios -d` / `npx expo run:android -d`)로 합니다.

## 역할 분담

| 역할 | 담당 | 하는 일 |
|---|---|---|
| 설계·디자인·구현 | Claude Code | 요구사항 정리, 디자인 시안, 설계 문서(`docs/`), 구조 변경, 구현. 반복·운영 작업은 Codex에 넘겨 세션 한도를 아낀다 |
| 디버깅·린트 | Codex | 버그 원인 분석, 검증 명령(tsc·lint·테스트) 실패 원인 추적, 린트·타입 오류 정리 |
| 커밋·실기기 설치 | Codex | 사용자가 승인한 변경의 커밋, Android 빌드 → 서명 → 폰 덮어 설치 (2026-10-25부터) |

작업 흐름:

1. Claude가 설계안을 `docs/`에 작성하고 사용자 승인을 받는다.
2. Claude가 구현하고 검증 명령을 통과시킨다.
3. 사용자에게 요약을 보고한다.
4. 사용자가 커밋·설치를 승인하면 Claude가 범위(커밋할 파일, 메시지, 설치할 빌드)를 정해 Codex에 맡기고, Codex의 결과(커밋 해시, 서명 검증, `firstInstallTime` 유지)를 직접 확인해 보고한다.

Codex를 부르는 경우 (매 작업마다 부르지 않는다):

- 버그가 재현되는데 원인이 바로 보이지 않을 때 — `codex exec --sandbox read-only`로 원인 분석
- 검증 명령이 실패하고 원인이 바로 보이지 않을 때
- 린트·타입 오류가 많이 쌓여 한꺼번에 정리할 때
- 사용자가 코드 리뷰를 요청했을 때만 `codex review --uncommitted`

Codex가 낸 분석이나 지적은 Claude가 코드에서 직접 확인한 뒤 반영하거나, 오탐이면 근거와 함께 반려한다.

## 승인 규칙

사용자 승인이 필요한 지점:

- 설계안 확정
- 저장 데이터 구조 변경: AsyncStorage 키, `FormState`·`PatientWorkspace` 형태, 버전, 마이그레이션, 파일 저장 경로
- git commit
- git push, 릴리스(APK·`releases/`), EAS 빌드, 버전 번호 변경 — 매번 따로 승인

승인 없이 진행해도 되는 작업: 파일 읽기, 구현, 검증 명령 실행, 읽기 전용 Codex 디버깅 분석.

Codex 실행 권한:

- 디버깅·린트 분석: `codex exec --sandbox read-only "<증상·재현 방법·관련 파일>"` — 원인 분석만, 파일 수정 금지
- 리뷰 (사용자 요청 시): `codex review --uncommitted` (읽기 전용). `--uncommitted`·`--base`·`--commit`에는 직접 쓴 지시문을 함께 넘길 수 없으므로, 리뷰 기준은 이 파일로 전달한다
- 직접 수정: `--sandbox workspace-write`는 사용자가 허락한 경우에만, 그리고 아래 워크트리 안에서만 (`codex exec -C <워크트리 경로> --sandbox workspace-write ...`)
- 커밋·실기기 설치 (사용자 승인 후): `codex exec -m gpt-6.1-sol -C /Users/jangseong/coding --skip-git-repo-check --sandbox workspace-write -c sandbox_workspace_write.network_access=true -c 'sandbox_workspace_write.writable_roots=["/Users/jangseong/.gradle"]' "<커밋할 파일·메시지 또는 설치 지시>" < /dev/null`
  - `< /dev/null`을 붙인다. 백그라운드 실행에서 stdin이 열려 있으면 Codex가 추가 입력을 기다리며 멈춘다
  - FIELD-NOTE·gjfire-tools가 모두 쓰기 범위에 들어가도록 `-C`는 상위 `coding` 폴더로 한다. 이 폴더는 git 저장소가 아니라서 `--skip-git-repo-check`가 필요하다. 네트워크 허용은 adb 서버(localhost) 연결용이다
  - 승인된 파일만 커밋한다(`git add -A` 금지). push·버전 변경·Releases 게시는 맡기지 않는다
  - 아래 "Android 릴리스 절차"의 금지 사항(디버그 키 서명, `adb uninstall`, 키·비밀번호 파일 읽기)을 그대로 지킨다. 서명 결과물은 `gjfire-tools/output/`을 어지럽히지 않게 `FIELD-NOTE/.codex-tmp/` 같은 git 밖 임시 폴더에서 만든다
  - adb 입력 전에는 `topResumedActivity`로 전면 앱을 확인하고, 사용자가 다른 앱을 쓰는 중이면 앱을 띄우지 않는다
- `--dangerously-bypass-approvals-and-sandbox`는 사용하지 않는다

## Android 릴리스 절차

사용자는 GJ FIRE 홈페이지(`../gjfire-tools`, Cloudflare Pages `cyber-education-checklist`)의 EMS Log 카드에서 APK를 받는다. 다운로드 버튼은 이 저장소(`jangseong85/field-note-downloads`)의 GitHub Releases 파일을 직접 가리킨다. 흐름은 다음과 같다.

FIELD-NOTE에서 빌드 → gjfire-tools에서 서명 → 실기기 확인 → field-note-downloads Releases 게시 → gjfire-tools 홈페이지 정보 갱신·배포

서명 키 보관과 원칙은 `../gjfire-tools/ANDROID_SIGNING.md`가 기준이다. 버전 변경, 커밋, push, Releases 게시, 홈페이지 배포는 각각 사용자 승인 대상이다.

**절대 하지 않는 것**

- `android/app/debug.keystore`나 `~/.android/debug.keystore`로 서명된 APK를 실기기·배포에 쓰지 않는다. 배포 서명(SHA-256 `2f10ea30…`)과 달라 덮어 설치가 실패한다
- 설치 실패를 피하려고 `adb uninstall`이나 앱 삭제를 하지 않는다. 기기의 환자 기록이 모두 지워진다
- 키스토어·비밀번호 파일(`~/.android/release-keys/`)을 읽거나 출력하지 않는다. 서명 도구가 파일 경로로만 쓴다

**1. 준비**

- 검증 명령을 모두 통과시키고 커밋한다
- 버전을 올린다. 이미 Releases에 게시된 versionCode는 다시 쓰지 않는다. 바꿀 곳:
  - `app.json`의 `expo.version`과 `expo.android.versionCode`
  - `package.json`의 `version`
  - 로컬 `android/app/build.gradle`의 `versionCode`·`versionName` (`android/`는 git 밖이라 prebuild 없이 빌드하면 직접 맞춰야 한다)
- 릴리스 노트를 `docs/RELEASE_<버전>.md`에 쓴다 (기존 형식: 제목, 배포일·versionCode·패키지, 변경점, 검증 내용)

**2. 빌드** (ARM64)

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# 결과: android/app/build/outputs/apk/release/app-release.apk
```

스플래시 HTML(`assets/web/splash/index.html`)을 바꿨다면 먼저 `npm run splash:build`를 실행한다.

**3. 서명** (gjfire-tools)

```bash
cd ../gjfire-tools
node tools/sign-android-apk.mjs ems-log ../FIELD-NOTE/android/app/build/outputs/apk/release/app-release.apk
# 결과: output/android-apps/ems-log-<버전>.apk, ems-log-SHA256SUMS.txt
```

도구가 패키지 ID, 배포 인증서, 16KB 정렬을 검증하고 하나라도 다르면 중단한다. 같은 이름의 결과물이 이미 있으면 덮어쓰지 않고 멈추므로, 이전 결과물을 보관한 뒤 다시 실행한다. 실기기 확인만 할 때는 임시 폴더에서 실행해 `output/`을 어지럽히지 않는다.

**4. 실기기 설치·확인**

```bash
adb devices
adb install -r <서명된 APK>
adb shell dumpsys package com.emslog.mobile | grep -E "versionName|firstInstallTime"
```

`firstInstallTime`이 바뀌지 않았으면 데이터를 유지한 채 덮어 설치된 것이다. 스플래시 → 메인 화면 전환, 기존 기록 유지, 이번 변경 기능을 실기기에서 확인한다.

**5. Releases 게시** (사용자 승인 후)

```bash
gh release create v<버전> \
  ../gjfire-tools/output/android-apps/ems-log-<버전>.apk \
  ../gjfire-tools/output/android-apps/ems-log-SHA256SUMS.txt \
  --repo jangseong85/field-note-downloads \
  --title "119 구급대원 메모장 v<버전>" \
  --notes-file docs/RELEASE_<버전>.md
```

첨부 이름은 `ems-log-<버전>.apk`와 `ems-log-SHA256SUMS.txt`로 유지한다 (기존 릴리스와 같은 형식). 이미 공개된 릴리스의 APK를 같은 파일명으로 교체하지 않고, 이전 릴리스는 지우지 않는다. 소스 push와 Releases 게시는 별개다. push만으로 배포 APK는 바뀌지 않는다.

**6. 홈페이지 갱신** (gjfire-tools, 사용자 승인 후)

Releases 게시만으로는 홈페이지 다운로드가 바뀌지 않는다. `../gjfire-tools/src/android-apps.ts`의 `ems-log` 항목을 갱신해야 새 APK로 연결된다.

- `version`, `releaseTag`(`v<버전>`), `file`(`ems-log-<버전>.apk`), `size`(MB), `date`, `sha256`(서명 도구가 출력한 값), `releaseNote`
- `features`는 기능이 바뀐 경우에만 고친다
- 배포 기록을 `../gjfire-tools/docs/ems-log-<버전>-release.md`에 남긴다 (기존 `ems-log-1.0.2-release.md` 형식: 앱 소스 커밋, versionCode, 릴리스 링크, APK, SHA-256)
- gjfire-tools의 `npm run check`·`npm test`를 통과시킨 뒤, 그 저장소의 규칙(`../gjfire-tools/AGENTS.md`)에 따라 커밋·배포한다. gjfire-tools에 커밋 안 된 다른 작업이 있으면 섞지 않는다

## 워크트리

기본은 메인 체크아웃에서 순차 작업한다 (Codex는 읽기 전용으로만 분석). 워크트리는 아래 경우에만 쓴다.

- Claude와 Codex가 **동시에** 코드를 고칠 때 — 쓰는 쪽마다 워크트리 하나
- 메인을 건드리지 않고 큰 리팩터링이나 실험을 할 때

규칙:

- 생성·삭제는 `scripts/worktree.sh`로 한다. 위치는 저장소 바깥 `../FIELD-NOTE-worktrees/<topic>`
  ```bash
  scripts/worktree.sh new claude/<topic>   # 또는 codex/<topic>, 기준 브랜치 기본값 main
  scripts/worktree.sh list
  scripts/worktree.sh remove claude/<topic>
  ```
- 브랜치 이름은 `claude/<topic>` 또는 `codex/<topic>` — 누가 쓰는 브랜치인지 드러나게
- 워크트리는 마지막 커밋에서 만들어진다. 메인의 커밋 안 된 변경은 들어가지 않으므로 먼저 커밋한다
- 스크립트가 `.env.local` 복사와 `npm ci`를 해 준다. `ios/`·`android/`는 git 추적 밖이라 없으므로, 실기기 확인이 필요하면 그 워크트리에서 `npx expo run:ios -d`로 다시 만든다
- 두 워크트리가 같은 파일을 동시에 고치지 않도록 작업 범위를 파일 단위로 나눈다
- 병합은 사용자 승인 후 main에서 한다. 각 브랜치는 병합 전에 검증 명령을 통과해야 한다
- 브랜치 push는 하지 않는다 (push는 승인 규칙 대상)

## 디버깅·리뷰 중점

Codex는 분석·리뷰 중 파일을 수정하지 않습니다. 디버깅은 원인(파일:줄), 근거, 고치는 방향을 적습니다. 리뷰 지적은 파일:줄, 실패 시나리오(입력·상태 → 잘못된 결과), 심각도를 적습니다. 아래를 우선해서 봅니다.

1. **데이터 유실** — 저장 순서(`patientSaveQueue`), 경합, 앱 종료·백그라운드 전환 중 저장, 리셋·삭제 시 파일 정리, 마이그레이션(`migrateStoredForm`)
2. **개인정보** — 주민등록번호 뒷자리·OCR 원문·신분증 사진이 저장되거나 로그·공유 파일에 남지 않는지, 사진첩·외부 저장소 노출
3. **의료 수치·시각** — BP·PR·RR·SpO₂·BT·BST 포맷과 범위, 한국시간(KST) 처리, 만 나이 계산
4. **현장 사용성** — 장갑 낀 손·한 손 조작, 다크 모드, 실패 시 사용자에게 알리는지(조용히 삼키는 `catch`)
5. 그 밖의 정확성 버그, 타입 안전성

저장 스키마 변경을 제안할 때는 기존 데이터의 마이그레이션 경로를 반드시 함께 적습니다.

## 코드 규칙

- 주변 코드의 스타일과 밀도를 따른다. 사용자에게 보이는 문구는 한국어
- 순수 로직은 `src/*.ts`로 분리하고 `scripts/test-*.cjs`(node:test)에 테스트를 붙인다
- 일부 테스트는 `App.tsx` 소스 문자열에서 코드 순서를 검사한다. 해당 구간을 바꾸면 테스트도 함께 갱신한다
- `.env.local`과 키·토큰은 커밋하지 않는다
