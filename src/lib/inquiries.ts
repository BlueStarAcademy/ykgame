export const INQUIRY_STATUS_LABELS = {
  OPEN: "접수",
  IN_PROGRESS: "처리중",
  RESOLVED: "해결",
  CLOSED: "종료",
} as const;

export type InquiryStatusKey = keyof typeof INQUIRY_STATUS_LABELS;

export function formatInquiryDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
