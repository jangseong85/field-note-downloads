/**
 * Sent to the medic's own ChatGPT app with the cropped prescription photos (docs/MEDICINE_BAG_ANALYSIS.md).
 * The answer is one table, one drug per row, so drug, likely condition and side effect read across at a glance.
 * Departments were dropped: the grouping was often wrong and made the answer harder to scan.
 */
export const MEDICINE_BAG_PROMPT = `[구급 현장 처방전·약 봉투 분석]
첨부 사진은 환자 처방전 또는 약 봉투의 약 이름 부분이다. 여러 장이면 모든 사진의 약을 합쳐 한 번에 정리하고, 같은 약은 한 번만 쓴다. 아래 출력 형식 그대로만 답한다.

규칙
- 형식 밖의 문장(인사말, 서론, 요약, 주의 문구, 추가 질문, 진료 권고)은 쓰지 않는다.
- 표 한 개로만 답한다. 약 하나를 한 줄에 쓴다.
- 칸은 짧은 명사형으로 쓴다. 한 칸에 한 줄을 넘기지 않는다.
- 사진에서 읽은 약만 쓴다. 추측으로 약을 추가하지 않는다.
- 글자가 불확실하면 읽은 대로 적고 "(불확실)"을 붙인다.
- 추정 병력은 그 약으로 가능성이 높은 병명 1~2개만 쓴다. 병명은 **굵게** 쓴다. 위장약·진통제처럼 특정할 수 없으면 굵게 하지 않고 "특정 어려움"이라고 쓴다.
- 사람 이름, 병원·약국명, 연락처, 주소는 사진에 보여도 쓰지 않는다.

출력 형식
| 번호 | 약품명 (성분명) | 추정 병력 | 주요 부작용 |
|---|---|---|---|
| 1 | 노바스크정 (암로디핀) | **고혈압** | 하지 부종, 어지럼 |

약품명을 하나도 읽지 못하면 표 없이 "판독 불가: 약 이름 부분을 다시 촬영 바람"만 쓴다.`;

export const CHATGPT_PACKAGE = "com.openai.chatgpt";
