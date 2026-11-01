/**
 * 화면 문구 사전. 저장 값은 언제나 한글이고, 설정의 언어(English)는 화면에 보이는 글자만 바꾼다.
 * 영문은 국내 응급실·구급 현장에서 흔히 쓰는 의학 약어를 우선하고, 자리가 있으면 풀이를 함께 쓴다.
 */
const HISTORY_TERMS: Record<string, string> = {
  고혈압: "HTN",
  당뇨: "DM",
  고지혈증: "DL",
  협심증: "Angina",
  심근경색: "MI",
  부정맥: "Arrhythmia",
  심부전: "HF",
  항응고제: "Anticoagulant",
  뇌경색: "Cb. infarction",
  뇌출혈: "ICH",
  뇌전증: "Epilepsy",
  파킨슨병: "PD",
  천식: "Asthma",
  COPD: "COPD",
  결핵: "Tbc",
  신부전: "CKD",
  "투석 월·수·금": "HD (MWF)",
  "투석 화·목·토": "HD (TTS)",
  간경화: "LC",
  간염: "Hepatitis",
  우울증: "Depression",
  양극성장애: "Bipolar",
  조현병: "Schizophrenia",
  암: "Ca",
  갑상선질환: "Thyroid",
  치매: "Dementia",
  수술: "Op Hx",
  임신: "Pregnancy",
  알러지: "Allergy",
};

export const historyTerm = (item: string, medical: boolean) => (medical ? HISTORY_TERMS[item] ?? item : item);

const KO = {
  patient: "인적사항",
  name: "이름",
  namePlaceholder: "이름 입력",
  birthDate: "생년월일",
  age: (age: number) => `만 ${age}세`,
  ageEmpty: "만 나이",
  male: "남성",
  female: "여성",
  complaint: "주증상",
  complaintPlaceholder: "주증상 및 증상 경과를 입력하세요",
  vitals: "활력징후",
  measuredAt: "측정 시각",
  round: (index: number) => `${index}차`,
  history: "병력과 메모",
  historyPick: "병력 선택",
  historyAdd: "추가",
  historyPrefix: "과거력",
  historyMemoPlaceholder: "복용약, 알러지 등 추가 사항",
  patientPhone: "환자 연락처",
  guardian: "보호자",
  phonePlaceholder: "연락처 입력",
  vitalInput: "입력",
  map: (value: number) => `평균동맥압(MAP) · ${value} mmHg`,
};
type Terms = typeof KO;
const MEDICAL: Terms = {
  patient: "Patient",
  name: "Name",
  namePlaceholder: "Name",
  birthDate: "DOB",
  age: (age: number) => `${age} y`,
  ageEmpty: "Age",
  male: "M",
  female: "F",
  complaint: "C/C",
  complaintPlaceholder: "C/C, onset, progression",
  vitals: "V/S",
  measuredAt: "Time",
  round: (index: number) => `#${index}`,
  history: "PHx · Memo",
  historyPick: "PHx",
  historyAdd: "Add",
  historyPrefix: "PHx",
  historyMemoPlaceholder: "Meds, allergy, etc.",
  patientPhone: "Pt phone",
  guardian: "Guardian",
  phonePlaceholder: "Phone",
  vitalInput: "-",
  map: (value: number) => `MAP · ${value} mmHg`,
};
export const terms = (medical: boolean): Terms => (medical ? MEDICAL : KO);

/** Guardian relations are stored in Korean; English mode only changes the label. */
const RELATION_TERMS: Record<string, string> = {
  부모: "Parent",
  배우자: "Spouse",
  자녀: "Child",
  형제자매: "Sibling",
  조부모: "Grandparent",
  손자녀: "Grandchild",
  며느리: "Daughter-in-law",
  사위: "Son-in-law",
  친인척: "Relative",
  지인: "Acquaintance",
  요양보호사: "Caregiver",
  회사관계자: "Coworker",
  기타: "Other",
};
export const relationTerm = (item: string, medical: boolean) => (medical ? RELATION_TERMS[item] ?? item : item);

const WEEKDAY_TERMS: Record<string, string> = {
  일요일: "Sun", 월요일: "Mon", 화요일: "Tue", 수요일: "Wed", 목요일: "Thu", 금요일: "Fri", 토요일: "Sat",
};
export const weekdayTerm = (weekday: string, medical: boolean) => (medical ? WEEKDAY_TERMS[weekday] ?? weekday : weekday);

export const VITAL_TERMS = {
  bp: { ko: "혈압", en: "BP", unitKo: "mmHg", unitEn: "mmHg" },
  pr: { ko: "맥박", en: "PR", unitKo: "회/분", unitEn: "/min" },
  rr: { ko: "호흡", en: "RR", unitKo: "회/분", unitEn: "/min" },
  spo2: { ko: "산소포화도", en: "SpO₂", unitKo: "%", unitEn: "%" },
  bt: { ko: "체온", en: "BT", unitKo: "°C", unitEn: "°C" },
  bst: { ko: "혈당", en: "BST", unitKo: "mg/dL", unitEn: "mg/dL" },
} as const;
