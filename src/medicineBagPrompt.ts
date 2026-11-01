/**
 * Sent to the medic's own ChatGPT app with the cropped medicine-bag photo (docs/MEDICINE_BAG_ANALYSIS.md).
 * The fixed output template and the "unreadable" sentence keep every answer in the same three sections.
 */
export const MEDICINE_BAG_PROMPT = `[구급 현장 처방전·약 봉투 분석]
첨부 사진은 환자 처방전 또는 약 봉투의 약 이름 부분이다. 아래 출력 형식 그대로만 답한다.

규칙
- 형식 밖의 문장(인사말, 서론, 요약, 주의 문구, 추가 질문, 진료 권고)은 쓰지 않는다.
- 개조식, "~함/~임"체로 쓴다.
- 사진에서 읽은 약만 쓴다. 추측으로 약을 추가하지 않는다.
- 글자가 불확실하면 읽은 대로 적고 "(불확실)"을 붙인다.
- 사람 이름, 병원·약국명, 연락처, 주소는 사진에 보여도 쓰지 않는다.

출력 형식
1. 약물명
- 약품명 (성분명)
2. 부작용
- 약품명: 주요 부작용 1줄
3. 추정 병력
- 병력명: 근거 약품명
(가능성 높은 순)

약품명을 하나도 읽지 못하면 다른 내용 없이 "판독 불가: 약 이름 부분을 다시 촬영 바람"만 쓴다.`;

export const CHATGPT_PACKAGE = "com.openai.chatgpt";
