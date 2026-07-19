/** 닉네임 등 사용자 입력용 비속어/부적절한 표현 필터 */

const PROFANITY_TERMS = [
  // 한국어
  "시발",
  "씨발",
  "시팔",
  "씨팔",
  "시바",
  "씨바",
  "시벌",
  "씨벌",
  "쉬발",
  "쉬벌",
  "ㅅㅂ",
  "ㅆㅂ",
  "병신",
  "븅신",
  "병쉰",
  "ㅂㅅ",
  "개새끼",
  "개색기",
  "개새",
  "개쉐",
  "개소리",
  "지랄",
  "좆",
  "좇",
  "존나",
  "졸라",
  "니미",
  "니애미",
  "느금마",
  "느금",
  "애미",
  "애비",
  "꺼져",
  "닥쳐",
  "씹",
  "보지",
  "자지",
  "빨통",
  "섹스",
  "야동",
  "야한",
  "창녀",
  "창년",
  "걸레",
  "변태",
  "장애인년",
  "장애년",
  "한남충",
  "김치녀",
  "틀딱",
  "맘충",
  "폐녀",
  "엠창",
  "ㅅㄲ",
  "ㅄ",
  // 영어
  "fuck",
  "fuk",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "pussy",
  "nigger",
  "nigga",
  "cunt",
  "whore",
  "slut",
] as const;

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

function stripSeparators(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_./\\|:;,'"`~!?#%^&*()+=[\]{}<>·ㆍ•★☆♥♡※]+/g, "");
}

function applyLeet(value: string): string {
  return Array.from(value)
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
}

/** 공백/기호 제거, 숫자 우회(시1발), 영문 leet(sh1t)를 함께 검사 */
function normalizeCandidates(value: string): string[] {
  const base = stripSeparators(value);
  const withoutDigits = base.replace(/[0-9]/g, "");
  const leet = applyLeet(base);
  return Array.from(new Set([base, withoutDigits, leet].filter(Boolean)));
}

const NORMALIZED_TERMS = PROFANITY_TERMS.map((term) =>
  stripSeparators(term),
).filter((term) => term.length > 0);

export function containsProfanity(value: string): boolean {
  const candidates = normalizeCandidates(value);
  if (candidates.length === 0) return false;
  return candidates.some((normalized) =>
    NORMALIZED_TERMS.some((term) => normalized.includes(term)),
  );
}
