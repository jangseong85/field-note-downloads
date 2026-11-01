/** Department headings, in the order ChatGPT lists them; fixed so every answer groups drugs the same way. */
export const MEDICINE_DEPARTMENTS = [
  "심혈관계",
  "호흡기",
  "신경과",
  "정신건강의학과",
  "내분비(당뇨·갑상선)",
  "소화기",
  "신장내과",
  "비뇨기과",
  "정형외과",
  "기타",
];

/**
 * Sent to the medic's own ChatGPT app with the cropped prescription photo (docs/MEDICINE_BAG_ANALYSIS.md).
 * Drugs are grouped by department with the likely condition beside each one, so the history reads at a glance.
 */
export const MEDICINE_BAG_PROMPT = `[구급 현장 처방전·약 봉투 분석]
첨부 사진은 환자 처방전 또는 약 봉투의 약 이름 부분이다. 여러 장이면 모든 사진의 약을 합쳐 한 번에 정리하고, 같은 약은 한 번만 쓴다. 아래 출력 형식 그대로만 답한다.

규칙
- 형식 밖의 문장(인사말, 서론, 요약, 주의 문구, 추가 질문, 진료 권고)은 쓰지 않는다.
- 개조식, "~함/~임"체로 쓴다.
- 사진에서 읽은 약만 쓴다. 추측으로 약을 추가하지 않는다.
- 글자가 불확실하면 읽은 대로 적고 "(불확실)"을 붙인다.
- 사람 이름, 병원·약국명, 연락처, 주소는 사진에 보여도 쓰지 않는다.
- 약을 아래 진료과로 묶는다. 진료과 이름은 이 목록에서만 고르고, 이 순서로 쓴다. 약이 없는 진료과는 쓰지 않는다.
  ${MEDICINE_DEPARTMENTS.join(", ")}
- 한 약이 여러 진료과에 해당하면 주된 용도의 진료과 한 곳에만 쓴다.
- 추정 병력은 그 약으로 진단 가능성이 높은 병명 1~2개만 쓴다. 위장약·진통제처럼 병력을 특정할 수 없으면 "병력 특정 어려움"이라고 쓴다.

출력 형식
■ 진료과
- 약품명 (성분명) → 추정 병력
  부작용: 주요 부작용 1줄

예시
■ 심혈관계
- 노바스크정 (암로디핀) → 고혈압
  부작용: 하지 부종, 어지럼

약품명을 하나도 읽지 못하면 다른 내용 없이 "판독 불가: 약 이름 부분을 다시 촬영 바람"만 쓴다.`;

export const CHATGPT_PACKAGE = "com.openai.chatgpt";
