#!/usr/bin/env bash
# 병렬 작업용 git 워크트리 관리
#   scripts/worktree.sh new <owner>/<topic> [base]   예) scripts/worktree.sh new codex/fix-save-race
#   scripts/worktree.sh list
#   scripts/worktree.sh remove <owner>/<topic>
# 워크트리는 저장소 바깥 ../EMSLog-worktrees/<topic>에 만든다 (Metro가 중첩 폴더를 감시하지 않도록).
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
BASE_DIR="$(dirname "$ROOT")/EMSLog-worktrees"

usage() { sed -n 2,6p "$0" | sed 's/^# \{0,1\}//'; exit 1; }

cmd="${1:-}"; branch="${2:-}"
case "$cmd" in
  new)
    [[ "$branch" =~ ^(claude|codex)/[a-z0-9._-]+$ ]] || { echo "브랜치 이름은 claude/<topic> 또는 codex/<topic> 형식이어야 합니다." >&2; exit 1; }
    base="${3:-main}"
    dir="$BASE_DIR/${branch#*/}"
    [[ -e "$dir" ]] && { echo "이미 있습니다: $dir" >&2; exit 1; }
    if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
      echo "주의: 메인 체크아웃에 커밋 안 된 변경이 있습니다. 새 워크트리에는 들어가지 않습니다 (기준: $base)." >&2
    fi
    mkdir -p "$BASE_DIR"
    git -C "$ROOT" worktree add -b "$branch" "$dir" "$base"
    # git이 추적하지 않는 로컬 파일 복사 (키는 커밋되지 않음)
    for f in .env.local; do
      if [[ -f "$ROOT/$f" ]]; then cp "$ROOT/$f" "$dir/$f"; fi
    done
    (cd "$dir" && npm ci)
    echo
    echo "완료: $dir ($branch)"
    echo "ios/·android/는 없습니다. 실기기 확인이 필요하면 그 워크트리에서 npx expo run:ios -d 로 prebuild하세요."
    ;;
  list)
    git -C "$ROOT" worktree list
    ;;
  remove)
    [[ -n "$branch" ]] || usage
    dir="$BASE_DIR/${branch#*/}"
    git -C "$ROOT" worktree remove "$dir"
    echo "워크트리를 지웠습니다: $dir"
    echo "브랜치 $branch 는 남겨 두었습니다. 병합 후 지우려면: git branch -d $branch"
    ;;
  *) usage ;;
esac
