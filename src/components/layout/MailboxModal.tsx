"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";

interface UserMail {
  id: string;
  title: string;
  body: string | null;
  currencyAmount: number;
  couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT" | "FILTER_SET_EXCHANGE" | null;
  couponDiscountPct: number | null;
  readAt: string | null;
  claimedAt: string | null;
  createdAt: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function couponLabel(type: NonNullable<UserMail["couponType"]>) {
  switch (type) {
    case "YK_PARTS_DISCOUNT":
      return "YK건기 부품 할인권";
    case "EQUIPMENT_RENTAL_DISCOUNT":
      return "중장비 대여 할인권";
    case "FILTER_SET_EXCHANGE":
      return "필터세트 교환쿠폰";
  }
}

function hasAttachment(mail: UserMail) {
  return (
    mail.currencyAmount > 0 ||
    mail.couponType === "FILTER_SET_EXCHANGE" ||
    (mail.couponType && mail.couponDiscountPct)
  );
}

interface MailboxModalProps {
  open: boolean;
  onClose: () => void;
  onMailboxChange?: () => void;
}

export function MailboxModal({ open, onClose, onMailboxChange }: MailboxModalProps) {
  const { update } = useSession();
  const [mails, setMails] = useState<UserMail[]>([]);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function loadMails() {
    setLoading(true);
    try {
      const res = await fetch("/api/mail");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setMails(data.mails ?? []);
      setSelectedMailId((current) => current ?? data.mails?.[0]?.id ?? null);
      onMailboxChange?.();
    } catch {
      setMails([]);
      setSelectedMailId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadMails();
  }, [open]);

  useEffect(() => {
    if (!open || !selectedMailId) return;
    let cancelled = false;
    void fetch(`/api/mail/${selectedMailId}/read`, { method: "PATCH" }).then(
      (res) => {
        if (!res.ok || cancelled) return;
        setMails((prev) => {
          const mail = prev.find((item) => item.id === selectedMailId);
          if (!mail || mail.readAt) return prev;
          return prev.map((item) =>
            item.id === selectedMailId
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          );
        });
        onMailboxChange?.();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, selectedMailId, onMailboxChange]);

  if (!open) return null;

  const selectedMail = mails.find((mail) => mail.id === selectedMailId) ?? null;

  async function claimMail(mailId: string) {
    setClaiming(true);
    try {
      const res = await fetch(`/api/mail/${mailId}/claim`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "claim failed");
      if (typeof data.currency === "number") {
        await update({ user: { currency: data.currency } });
      }
      await loadMails();
    } catch {
      alert("보상 수령에 실패했습니다.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <AppModalOverlay open={open} onClose={onClose}>
      <div className="flex h-[min(82dvh,36rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl landscape:h-[min(90dvh,22rem)]">
        <div className="flex shrink-0 items-center justify-between bg-sky-600 px-4 py-3 text-white">
          <h2 className="text-base font-black">우편함</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
          >
            닫기
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {loading ? (
            <p className="flex flex-1 items-center justify-center text-xs text-gray-400">
              우편함 불러오는 중...
            </p>
          ) : mails.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-xs text-gray-400">
              받은 우편이 없습니다.
            </p>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
                {mails.map((mail) => {
                  const selected = mail.id === selectedMailId;
                  const unclaimed = !mail.claimedAt && hasAttachment(mail);
                  return (
                    <button
                      key={mail.id}
                      type="button"
                      onClick={() => setSelectedMailId(mail.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        selected
                          ? "border-sky-300 bg-sky-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-black text-gray-800">
                          {!mail.readAt ? "🔵 " : ""}
                          {mail.title}
                        </span>
                        {unclaimed ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            미수령
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">{formatDate(mail.createdAt)}</p>
                    </button>
                  );
                })}
              </div>

              {selectedMail ? (
                <div className="flex max-h-[45%] min-h-[8.5rem] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 landscape:max-h-[42%] landscape:min-h-[6.5rem]">
                  <p className="shrink-0 truncate text-sm font-black text-slate-900">
                    {selectedMail.title}
                  </p>
                  {selectedMail.body ? (
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                        {selectedMail.body}
                      </p>
                    </div>
                  ) : null}

                  {hasAttachment(selectedMail) ? (
                    <div className="mt-3 shrink-0 space-y-1 rounded-lg bg-white px-3 py-2 text-xs">
                      {selectedMail.currencyAmount > 0 ? (
                        <p className="font-bold text-amber-700">
                          ⭐ 스타 {selectedMail.currencyAmount.toLocaleString()}
                        </p>
                      ) : null}
                      {selectedMail.couponType ? (
                        <p className="font-bold text-purple-700">
                          🎟️ {couponLabel(selectedMail.couponType)}
                          {selectedMail.couponType === "FILTER_SET_EXCHANGE"
                            ? ""
                            : ` ${selectedMail.couponDiscountPct ?? 0}%`}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {!selectedMail.claimedAt && hasAttachment(selectedMail) ? (
                    <button
                      type="button"
                      disabled={claiming}
                      onClick={() => claimMail(selectedMail.id)}
                      className="mt-3 w-full shrink-0 rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
                    >
                      {claiming ? "수령 중..." : "보상 수령"}
                    </button>
                  ) : selectedMail.claimedAt ? (
                    <p className="mt-3 shrink-0 text-center text-[10px] font-bold text-slate-400">
                      수령 완료
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppModalOverlay>
  );
}

export function useMailboxBadge() {
  const [notifyCount, setNotifyCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/mail");
      if (!res.ok) return;
      const data = await res.json();
      const mails = (data.mails ?? []) as UserMail[];
      const count = mails.filter(
        (mail) => !mail.readAt || (!mail.claimedAt && hasAttachment(mail)),
      ).length;
      setNotifyCount(count);
    } catch {
      setNotifyCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { notifyCount, refresh };
}
