"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { type InquiryStatusKey } from "@/lib/inquiries";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";

type TabId = "write" | "mine";

interface PlayerInquiry {
  id: string;
  title: string;
  body: string;
  status: InquiryStatusKey;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export function CustomerInquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("shell.inquiry");
  const locale = useLocale();
  const [tab, setTab] = useState<TabId>("write");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [inquiries, setInquiries] = useState<PlayerInquiry[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadInquiries = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/inquiries");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("listLoadFailed"));
      setInquiries((data.inquiries ?? []) as PlayerInquiry[]);
    } catch (err) {
      setInquiries([]);
      setListError(err instanceof Error ? err.message : t("listLoadFailed"));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setTab("write");
    setDone(false);
    setError(null);
    setSelectedId(null);
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "mine") return;
    void loadInquiries();
  }, [open, tab, loadInquiries]);

  useRegisterInGameBackDismiss(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const selected = inquiries.find((item) => item.id === selectedId) ?? null;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const formatDay = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  const getStatus = (status: InquiryStatusKey, adminNote: string | null) => {
    const answered =
      status === "RESOLVED" || status === "CLOSED" || Boolean(adminNote?.trim());
    return {
      key: answered ? "answered" : "pending",
      label: t(answered ? "statusAnswered" : "statusPending"),
    };
  };

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setError(t("requiredFields"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("submitFailed"));
      setDone(true);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitFailed"));
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div
        className="flex h-[min(82dvh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("ariaLabel")}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-black">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            {t("close")}
          </button>
        </div>

        <div className="flex border-b border-white/10 px-2 pt-2">
          {(
            [
              { id: "write", label: t("writeTab") },
              { id: "mine", label: t("mineTab") },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setSelectedId(null);
                  setDone(false);
                  setError(null);
                }}
                className={`flex-1 rounded-t-lg px-2 py-2 text-xs font-bold transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/45 hover:text-white/75"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "write" ? (
          done ? (
            <div className="flex min-h-0 flex-1 flex-col justify-center space-y-4 px-4 py-5">
              <p className="text-sm font-bold text-emerald-300">{t("submitted")}</p>
              <p className="text-xs leading-relaxed text-white/65">
                {t("submittedDescription")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDone(false);
                    setTab("mine");
                  }}
                  className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm font-black text-white hover:bg-white/10"
                >
                  {t("viewMyInquiries")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-white py-2.5 text-sm font-black text-slate-900"
                >
                  {t("confirm")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto px-4 py-4">
              <p className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
                {t("warning")}
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder={t("titlePlaceholder")}
                className="w-full shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={6}
                placeholder={t("bodyPlaceholder")}
                className="min-h-0 w-full flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35"
              />
              {error ? <p className="shrink-0 text-xs font-bold text-rose-300">{error}</p> : null}
              <button
                type="button"
                disabled={sending}
                onClick={() => void submit()}
                className="w-full shrink-0 rounded-xl bg-sky-500 py-2.5 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-60"
              >
                {sending ? t("submitting") : t("submit")}
              </button>
            </div>
          )
        ) : selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
              >
                {t("backToList")}
              </button>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  getStatus(selected.status, selected.adminNote).key === "answered"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {getStatus(selected.status, selected.adminNote).label}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div className="shrink-0">
                <h3 className="truncate text-sm font-black text-white">{selected.title}</h3>
                <p className="mt-1 text-[11px] text-white/45">
                  {formatDate(selected.createdAt)}
                </p>
              </div>
              <section className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-[10px] font-bold tracking-wide text-white/45">
                  {t("myInquiry")}
                </p>
                <div className="mt-2 max-h-[calc(1.625em*5)] overflow-y-auto overscroll-contain text-sm leading-relaxed">
                  <p className="whitespace-pre-wrap text-white/90">{selected.body}</p>
                </div>
              </section>
              <section className="shrink-0 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-3">
                <p className="text-[10px] font-bold tracking-wide text-sky-300/80">
                  {t("answer")}
                </p>
                <div className="mt-2 max-h-[calc(1.625em*5)] overflow-y-auto overscroll-contain text-sm leading-relaxed">
                  {selected.adminNote?.trim() ? (
                    <p className="whitespace-pre-wrap text-sky-50">{selected.adminNote}</p>
                  ) : (
                    <p className="text-white/45">{t("noAnswer")}</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {listLoading ? (
              <p className="py-10 text-center text-xs text-white/45">{t("loading")}</p>
            ) : listError ? (
              <p className="py-10 text-center text-xs font-bold text-rose-300">{listError}</p>
            ) : inquiries.length === 0 ? (
              <p className="py-10 text-center text-xs text-white/45">
                {t("empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {inquiries.map((item) => {
                  const status = getStatus(item.status, item.adminNote);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors hover:bg-white/10"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {formatDay(item.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            status.key === "answered"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {status.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
