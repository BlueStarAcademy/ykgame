export const ADMIN_MENU_ITEMS = [
  {
    href: "/admin/users",
    emoji: "👥",
    title: "회원관리",
    desc: "회원 목록 조회 및 상세 관리",
    color: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
  },
  {
    href: "/admin/coupons",
    emoji: "🎟️",
    title: "쿠폰 관리",
    desc: "시즌별 쿠폰 잔여 수량 및 획득 내역",
    color: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
  },
  {
    href: "/admin/game-info",
    emoji: "🎮",
    title: "게임정보",
    desc: "확률정보 · 퀘스트 정보 · 작업장 정보",
    color: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white",
  },
  {
    href: "/admin/mail",
    emoji: "📮",
    title: "우편발송",
    desc: "재화 지급 및 우편 발송",
    color: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
  },
  {
    href: "/admin/inquiries",
    emoji: "💬",
    title: "고객문의 관리",
    desc: "인게임 고객문의 접수·상세·조치",
    color: "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
  },
  {
    href: "/admin/notices",
    emoji: "📢",
    title: "전광판 공지",
    desc: "게임 상단 전광판 공지 작성·순서·표시 관리",
    color: "border-rose-200 bg-gradient-to-br from-rose-50 to-white",
  },
] as const;
