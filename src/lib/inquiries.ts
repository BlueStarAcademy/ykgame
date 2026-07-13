export const INQUIRY_STATUS_LABELS = {
  OPEN: "접수",
  IN_PROGRESS: "처리중",
  RESOLVED: "해결",
  CLOSED: "종료",
} as const;

export type InquiryStatusKey = keyof typeof INQUIRY_STATUS_LABELS;

/** Player-facing binary status for the in-game inquiry list. */
export function playerInquiryStatus(
  status: InquiryStatusKey,
  adminNote: string | null | undefined,
): { key: "pending" | "answered"; label: "문의중" | "답변완료" } {
  if (status === "RESOLVED" || status === "CLOSED" || Boolean(adminNote?.trim())) {
    return { key: "answered", label: "답변완료" };
  }
  return { key: "pending", label: "문의중" };
}

export function formatInquiryDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatInquiryDay(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
