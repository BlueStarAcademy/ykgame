"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface UserMail {
  id: string;
  title: string;
  body: string | null;
  currencyAmount: number;
  couponType: "YK_PARTS_DISCOUNT" | "EQUIPMENT_RENTAL_DISCOUNT" | null;
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
  return type === "YK_PARTS_DISCOUNT" ? "YK건기 부품 할인권" : "중장비 대여 할인권";
}

function hasAttachment(mail: UserMail) {
  return mail.currencyAmount > 0 || (mail.couponType && mail.couponDiscountPct);
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
    void fetch(`/api/mail/${selectedMailId}/read`, { method: "PATCH" });
  }, [open, selectedMailId]);

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-sky-600 px-4 py-3 text-white">
          <h2 className="text-base font-black">우편함</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30"
          >
            닫기
          </button>
        </div>

        <div className="space-y-3 p-4">
          {loading ? (
            <p className="py-8 text-center text-xs text-gray-400">우편함 불러오는 중...</p>
          ) : mails.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">받은 우편이 없습니다.</p>
          ) : (
            <>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-900">{selectedMail.title}</p>
                  {selectedMail.body ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                      {selectedMail.body}
                    </p>
                  ) : null}

                  {hasAttachment(selectedMail) ? (
                    <div className="mt-3 space-y-1 rounded-lg bg-white px-3 py-2 text-xs">
                      {selectedMail.currencyAmount > 0 ? (
                        <p className="font-bold text-amber-700">
                          ⭐ 스타 {selectedMail.currencyAmount.toLocaleString()}
                        </p>
                      ) : null}
                      {selectedMail.couponType && selectedMail.couponDiscountPct ? (
                        <p className="font-bold text-purple-700">
                          🎟️ {couponLabel(selectedMail.couponType)} {selectedMail.couponDiscountPct}%
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {!selectedMail.claimedAt && hasAttachment(selectedMail) ? (
                    <button
                      type="button"
                      disabled={claiming}
                      onClick={() => claimMail(selectedMail.id)}
                      className="mt-3 w-full rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
                    >
                      {claiming ? "수령 중..." : "보상 수령"}
                    </button>
                  ) : selectedMail.claimedAt ? (
                    <p className="mt-3 text-center text-[10px] font-bold text-slate-400">수령 완료</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function useMailboxBadge() {
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  const refresh = async () => {
    try {
      const res = await fetch("/api/mail");
      if (!res.ok) return;
      const data = await res.json();
      setUnclaimedCount(data.unclaimedCount ?? 0);
    } catch {
      setUnclaimedCount(0);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { unclaimedCount, refresh };
}
