// 주민등록번호 후보: 앞에 다른 숫자가 붙지 않은 "6자리-숫자", "6자리 7자리", 또는 13자리 연속.
// 8자리 날짜(20100123)나 면허번호(18-04-007412-90) 안쪽을 주민번호로 읽지 않는다.
// 뒤 6자리는 모양 확인에만 쓰고 읽어 두거나 저장하지 않는다.
const residentNumberPattern =
  /(?<!\d)(\d{2})\s?(\d{2})\s?(\d{2})(?:\s*[-‐‑‒–—―]\s*([0-9])|\s+([0-9])\d{6}(?!\d)|([0-9])\d{6}(?!\d))/;
const CENTURY: Record<string, string> = {
  "9": "18", "0": "18", "1": "19", "2": "19", "5": "19", "6": "19",
  "3": "20", "4": "20", "7": "20", "8": "20"
};
type ResidentCandidate = { birthDate: string; code: string };
/** Valid resident-number fronts in reading order; birth date and gender always come from the same one. */
function residentCandidates(normalized: string, today: Date): ResidentCandidate[] {
  const found: ResidentCandidate[] = [];
  for (const match of normalized.matchAll(new RegExp(residentNumberPattern.source, "g"))) {
    const [, yy, mm, dd] = match;
    const code = match[4] ?? match[5] ?? match[6];
    const prefix = code ? CENTURY[code] : undefined;
    if (!yy || !mm || !dd || !code || !prefix) continue;
    const value = `${prefix}${yy}${mm}${dd}`;
    if (isValidBirthDate(value, today)) found.push({ birthDate: value, code });
  }
  return found;
}
const normalizeDigits = (text: string) => text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");

/**
 * 주민등록증/운전면허증 OCR 문자열에서 생년월일만 추출합니다.
 * 주민등록번호 앞자리가 가장 확실하므로 먼저 보고, 없을 때만 "YYYY.MM.DD" 꼴을 찾습니다.
 * 카드의 발급일·주소 숫자가 날짜처럼 읽혀도 생년월일 판단을 가로채지 않게, 유효한 후보가 나올 때까지 모두 확인합니다.
 */
export function extractBirthDate(text: string, today = new Date()): string | null {
  const normalized = normalizeDigits(text);
  const resident = residentCandidates(normalized, today)[0];
  if (resident) return resident.birthDate;

  // 1990. 01. 23 / 1990-01-23 / 19900123
  for (const full of normalized.matchAll(/((?:19|20)\d{2})\s*[.\-/년]?\s*(1[0-2]|0?[1-9])\s*[.\-/월]?\s*(3[01]|[12]\d|0?[1-9])(?!\d)/g)) {
    const value = `${full[1]}${full[2]!.padStart(2, "0")}${full[3]!.padStart(2, "0")}`;
    if (isValidBirthDate(value, today)) return value;
  }
  return null;
}

export function isValidBirthDate(value: string, today = new Date()): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date <= today;
}

export function calculateAge(value: string, today = new Date()): number | null {
  if (!isValidBirthDate(value, today)) return null;
  const digits = value.replace(/\D/g, "");
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age;
}

export type ScannedIdentity = {
  name: string | null;
  birthDate: string | null;
  gender: "남성" | "여성" | null;
};

type OcrLine = { text: string; frame: { left: number; top: number; right: number; bottom: number } };
type OcrResult = { text: string; blocks: { lines: OcrLine[] }[] };
export type IdentityRegion = { left: number; top: number; right: number; bottom: number };

const identityWords = /(복지카드|주민등록증|자동차운전면허증|운전면허증|대한민국|경찰청|시장|도지사|특별시|광역시|군수|구청장|주소|면허|번호|적성검사|발급|유효기간|장애|등급)/;

export function findIdentityRegion(result: OcrResult): IdentityRegion | null {
  const residentLine = result.blocks.flatMap((block) => block.lines).find((line) => {
    const normalized = line.text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
    return residentCandidates(normalized, new Date()).length > 0;
  });
  if (!residentLine) return null;
  const lineHeight = Math.max(1, residentLine.frame.bottom - residentLine.frame.top);
  const lineWidth = Math.max(1, residentLine.frame.right - residentLine.frame.left);
  return {
    left: Math.max(0, residentLine.frame.left - lineWidth * 0.2),
    top: Math.max(0, residentLine.frame.top - lineHeight * 3.2),
    right: residentLine.frame.right + lineWidth * 0.2,
    bottom: residentLine.frame.bottom + lineHeight * 0.65,
  };
}

/**
 * 주민등록증 성명은 "홍길동(洪吉童)"처럼 한자가 함께 인쇄된다. 한국어 OCR은 이 한자를 비슷한 한글로 읽거나
 * 괄호를 놓치거나 1·l·|로 읽는다. 이름은 성명 줄의 첫 한글 덩어리만 쓰고 그 뒤는 버린다.
 */
const COMPOUND_SURNAMES = new Set(["남궁", "황보", "제갈", "사공", "선우", "서문", "독고", "동방", "어금", "망절", "장곡"]);

export function nameSegment(value: string): string {
  const beforeBracket = value.split(/[（(\[〔【]/)[0] ?? "";
  // A bracket misread as 1, l, I or | right after Hangul also ends the name.
  const beforeMisread = beforeBracket.replace(/([가-힣])\s*[|lI1].*$/u, "$1");
  const tokens = beforeMisread
    .replace(/[^가-힣\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return "";
  // OCR splits syllables ("홍 길동", "홍길 동", "홍 길 동"): a one-syllable piece joins its neighbour.
  // Two multi-syllable pieces ("홍길동 흥길등", "김철 금철") are the name and its misread Hanja.
  // A compound surname ("남궁 민수", "황보 지영") is also followed by its given name.
  let name = tokens[0]!;
  for (const token of tokens.slice(1)) {
    const joinsSyllable = token.length === 1 || name.length === 1;
    const afterCompoundSurname = COMPOUND_SURNAMES.has(name) && token.length <= 3;
    if ((joinsSyllable || afterCompoundSurname) && name.length + token.length <= 5) name += token;
    else break;
  }
  return name;
}

function extractNameFromLine(value: string): string | null {
  const afterLabel = value.match(/(?:성\s*명|이\s*름)\s*[:：]?\s*(.+)$/u)?.[1];
  const labeled = afterLabel ? nameSegment(afterLabel) : "";
  if (/^[가-힣]{2,5}$/u.test(labeled)) return labeled;
  // 운전면허 종별(1종대형, 1종보통 등)처럼 숫자로 시작하거나 종별 글자가 있는 줄은 성명 후보가 아닙니다.
  if (/^\s*\d/.test(value) || /(?:[12]\s*종|대형|보통|소형|특수)/.test(value)) return null;
  const head = value.split(/[（(\[〔【]/)[0] ?? "";
  if (/\d/.test(head.replace(/([가-힣])\s*1.*$/u, "$1"))) return null;
  const candidate = nameSegment(value);
  return candidate.length >= 2 && candidate.length <= 5 && !identityWords.test(candidate) ? candidate : null;
}

/** 카드 종류와 무관하게 OCR 결과에서 필요한 최소 정보만 골라 반환합니다. */
export function extractIdentity(text: string, today = new Date()): ScannedIdentity {
  const normalized = text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
  const genderCode = residentCandidates(normalized, today)[0]?.code;
  const maleCodes = new Set(["1", "3", "5", "7", "9"]);
  const femaleCodes = new Set(["0", "2", "4", "6", "8"]);
  let gender: ScannedIdentity["gender"] = genderCode && maleCodes.has(genderCode) ? "남성" : genderCode && femaleCodes.has(genderCode) ? "여성" : null;
  if (!gender && /(?:성별\s*[:：]?\s*)?(?:남성|남자|\b남\b)/.test(text)) gender = "남성";
  if (!gender && /(?:성별\s*[:：]?\s*)?(?:여성|여자|\b여\b)/.test(text)) gender = "여성";

  const blocked = /(주민등록증|운전면허증|복지카드|장애인|대한민국|경찰청|시장|도지사|특별시|광역시|군수|구청장|주소|성명|이름|면허|번호|적성검사|발급|보건복지부)/;
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const labeled = lines
    .map((line) => line.match(/(?:성\s*명|이\s*름)\s*[:：]?\s*(.+)$/u)?.[1])
    .map((rest) => (rest ? nameSegment(rest) : ""))
    .find((name) => /^[가-힣]{2,5}$/u.test(name));
  const candidates = lines
    .filter((line) => !/^\s*\d/.test(line) && !/(?:[12]\s*종|대형|보통|소형|특수)/.test(line))
    .filter((line) => !/\d/.test((line.split(/[（(\[〔【]/)[0] ?? "").replace(/([가-힣])\s*1.*$/u, "$1")))
    .filter((line) => !blocked.test(line))
    .map(nameSegment)
    .filter((name) => /^[가-힣]{2,5}$/u.test(name));

  return { name: labeled ?? candidates[0] ?? null, birthDate: extractBirthDate(normalized, today), gender };
}

/** 주민번호 줄을 기준으로 바로 위 성명 영역을 우선 탐색합니다. */
export function extractIdentityFromOcr(result: OcrResult, today = new Date()): ScannedIdentity {
  const identity = extractIdentity(result.text, today);
  const lines = result.blocks.flatMap((block) => block.lines);
  const residentLine = lines.find((line) => {
    const normalized = line.text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
    return residentCandidates(normalized, today).length > 0;
  });
  if (!residentLine) return identity;

  const sameLineName = extractNameFromLine(residentLine.text.replace(residentNumberPattern, " "));
  return { ...identity, name: sameLineName ?? nearestNameLine(lines, residentLine)?.name ?? identity.name };
}

/** The line above the resident number that holds the name, with its frame for a closer re-read. */
function nearestNameLine(lines: OcrLine[], residentLine: OcrLine) {
  const numberHeight = Math.max(1, residentLine.frame.bottom - residentLine.frame.top);
  return lines
    .filter((line) => line !== residentLine && line.frame.bottom <= residentLine.frame.top + numberHeight * 0.35)
    .map((line) => ({
      name: extractNameFromLine(line.text),
      frame: line.frame,
      verticalGap: Math.max(0, residentLine.frame.top - line.frame.bottom),
      horizontalGap: Math.abs(line.frame.left - residentLine.frame.left),
    }))
    .filter((candidate) => candidate.name && candidate.verticalGap <= numberHeight * 4.5)
    .sort((a, b) => (a.verticalGap + a.horizontalGap * 0.15) - (b.verticalGap + b.horizontalGap * 0.15))[0];
}

/** Frame of the name line in OCR pixels, to crop and re-read it larger (small licence print is often misread). */
export function findNameLineFrame(result: OcrResult, today = new Date()): IdentityRegion | null {
  const lines = result.blocks.flatMap((block) => block.lines);
  const residentLine = lines.find((line) => residentCandidates(normalizeDigits(line.text), today).length > 0);
  if (!residentLine) return null;
  return nearestNameLine(lines, residentLine)?.frame ?? null;
}

/** Name read from a crop that holds only the name line. */
export function nameFromLineCrop(result: OcrResult): string | null {
  for (const line of result.blocks.flatMap((block) => block.lines)) {
    const name = extractNameFromLine(line.text);
    if (name) return name;
  }
  return null;
}

/**
 * Majority vote between independent reads of the same name. Ties go to the earliest entry,
 * so callers list the most reliable read first (the enlarged name line).
 */
export function voteName(reads: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const read of reads) if (read) counts.set(read, (counts.get(read) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const read of reads) {
    if (!read) continue;
    const count = counts.get(read)!;
    if (count > bestCount) {
      best = read;
      bestCount = count;
    }
  }
  // OCR on small licence print tends to drop a syllable (or turn it into Latin letters), not add one.
  // A read that is the winner plus the missing syllable(s) is the complete name.
  if (best) {
    const winner = best;
    const fuller = reads.find((read): read is string => !!read && read.length > winner.length && read.startsWith(winner));
    if (fuller) return fuller;
  }
  return best;
}
