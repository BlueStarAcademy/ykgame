export const YANMAR_GUIDE_STEPS = [
  {
    icon: "🎮",
    title: "모드 선택",
    desc: "연습은 조작만 익히고, 게임은 점수·보상·랭킹에 도전합니다",
  },
  {
    icon: "🕹️",
    title: "기본 조작",
    desc: "좌·우 레버와 주행으로 조작하고, 기능 메뉴에서 부착물을 바꿉니다",
  },
  {
    icon: "🟠",
    title: "굴착 · 하역",
    desc: "주황 구역에서 흙을 담아 덤프트럭에 하역합니다",
  },
  {
    icon: "💥",
    title: "브레이커",
    desc: "브레이커로 아스팔트를 깨면 보상을 얻습니다",
  },
  {
    icon: "🪨",
    title: "집게 · 석재",
    desc: "집게로 돌을 집어 운반 트럭에 하역합니다",
  },
  {
    icon: "🎁",
    title: "보상 · 강화",
    desc: "스타·쿠폰을 모아 장비를 강화하고 시즌 랭킹에 도전합니다",
  },
] as const;

export const YANMAR_REWARD_INFO = [
  {
    icon: "⭐",
    label: "스타",
    desc: "무제한",
  },
  { icon: "🎟️", label: "YK 부품 할인권", desc: "10 / 15 / 20%" },
  { icon: "🎟️", label: "장비 대여 할인권", desc: "10 / 20 / 30%" },
  {
    icon: "🎟️",
    label: "필터 세트 교환 쿠폰",
    desc: "시즌 한정 교환권",
  },
] as const;
