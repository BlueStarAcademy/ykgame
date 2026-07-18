import type { GameId } from "./games";

/** YK건기 회사 소개 (sunnyyk.co.kr 기반) */
export const COMPANY = {
  name: "YK건기",
  nameEn: "YK GEONGI",
  homepage: "https://www.sunnyyk.co.kr/",
  tagline: "전세계 명품 중장비, 최고의 가치를 전합니다",
  intro:
    "YK건기는 전 세계의 우수한 장비를 선별해 고객에게 최고의 가치를 제공하는 전문 건설기계·농기계 수입업체입니다. 25년간 대한민국 건설시장을 선도해 온 당사는 일본 YANMAR, 프랑스 MANITOU, 독일 WIRTGEN, 미국 JOHN DEERE의 국내 공식 파트너로 활동하고 있습니다.",
  subIntro:
    "전국 16개 직영 원스톱 센터에서 장비 구매·정비·부품·렌탈까지 한곳에서 지원합니다. 이 체험존에서는 YK건기가 수입·판매하는 8개 글로벌 브랜드 장비를 게임으로 직접 운전해볼 수 있습니다.",
  stats: [
    { value: "25+", label: "년 업력" },
    { value: "8", label: "글로벌 브랜드" },
    { value: "16", label: "전국 직영센터" },
    { value: "1시간", label: "서비스 네트워크" },
  ],
  services: [
    {
      title: "장비 구매·렌탈",
      desc: "실시간 견적, 전자 계약, 카탈로그 확인까지 한곳에서",
    },
    {
      title: "정비·서비스",
      desc: "예방정비, ON-TIME 서비스, CAP 등 체계적 장비관리",
    },
    {
      title: "순정 부품",
      desc: "믿음직한 품질, 합리적인 가격의 YK건기 순정 부품",
    },
  ],
} as const;

/** 브랜드별 중장비 설명 (회사 홈페이지·제품 라인업 참고) */
export const BRAND_PROFILES: Record<
  GameId,
  { category: string; highlight: string; description: string }
> = {
  yanmar: {
    category: "굴착기",
    highlight: "미니 굴착기 시장 25년 1위",
    description:
      "일본 YANMAR — 좁은 작업 환경에서도 최적의 효율을 제공하는 프리미엄 굴착기 브랜드. 소형부터 대형까지 건설 현장의 스탠다드입니다.",
  },
  johndeere: {
    category: "트랙터·농기계",
    highlight: "스마트한 농업의 시작",
    description:
      "미국 JOHN DEERE — 국내 공식 파트너. 강력한 동력과 스마트 농업 기술로 밭일과 작물 관리의 새로운 기준을 제시합니다.",
  },
  manitou: {
    category: "지게차·물류장비",
    highlight: "프랑스 MANITOU 공식",
    description:
      "마니또(MANITOU) — 건설·물류·농업 현장에서 다양한 작업 높이와 하중을 커버하는 텔레핸들러·지게차 전문 브랜드입니다.",
  },
  wirtgen: {
    category: "도로 재생·작업",
    highlight: "100년 이상의 도로 기술",
    description:
      "독일 WIRTGEN — 도로 포장·재생 분야 세계 1위 그룹. 민링·안정화·재생 공법으로 도로 인프라를 혁신합니다.",
  },
  voegle: {
    category: "아스팔트 포장",
    highlight: "WIRTGEN 그룹 포장 장비",
    description:
      "보겔(VÖGELE) — 아스팔트 포설기 분야 글로벌 리더. 균일한 포장 품질과 생산성으로 도로 포장 공사의 핵심 장비입니다.",
  },
  gehl: {
    category: "스키드·로더",
    highlight: "다목적 소형 장비",
    description:
      "GEHL — 축사·건설·조경 현장에서 활약하는 컴팩트 로더. 좁은 공간에서도 강력한 적재·운반 작업을 수행합니다.",
  },
  hamm: {
    category: "도로 롤러",
    highlight: "HAMM HD 시리즈",
    description:
      "독일 HAMM — 도로·토공 압착의 글로벌 브랜드. HD12·HD13 등 다양한 롤러로 아스팔트·토사 다짐 작업을 완성합니다.",
  },
  kleemann: {
    category: "크러셔·선별",
    highlight: "골재·채석 솔루션",
    description:
      "KLEEMANN — WIRTGEN 그룹의 크러싱·스크리닝 전문 브랜드. 암석 분쇄와 크기별 선별로 골재 생산 라인을 구축합니다.",
  },
};

export const EXPERIENCE_STEPS = [
  { step: "01", title: "소개 페이지", desc: "홈 추가 또는 게임 체험으로 시작" },
  { step: "02", title: "로그인", desc: "QR·버튼으로 로그인 (이미 로그인 시 바로 이동)" },
  {
    step: "03",
    title: "장비 선택",
    desc: "「얀마! 너 뭐해?」로비로 이동해 체험할 장비를 고릅니다",
  },
  {
    step: "04",
    title: "플레이",
    desc: "굴착·하역·브레이커·석재 미션에 도전하고 보상을 획득합니다",
  },
] as const;

export const EXPERIENCE_MODES = [
  {
    title: "게임 체험",
    label: "Game Experience",
    desc: "「얀마! 너 뭐해?」에서 연습·게임 모드로 굴착·하역·브레이커·석재 작업에 도전하고, 스타·쿠폰·시즌 랭킹을 겨룹니다.",
    points: [
      "연습모드로 조작 익히기 / 게임모드로 기록 도전",
      "흙 하역·아스팔트 파괴·석재 운반으로 보상 획득",
      "스타로 장비 강화 · 시즌 랭킹 경쟁",
    ],
  },
] as const;
