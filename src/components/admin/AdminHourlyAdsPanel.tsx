"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "./AdminShell";
import {
  HOURLY_AD_DRAFT_SLOT_ID,
  HOURLY_AD_DURATION_PLACEHOLDER,
  HOURLY_AD_OFFSET_PLACEHOLDER,
  type HourlyAdSlotId,
} from "@/lib/hourly-ad-constants";

type AdminSlot = {
  id: HourlyAdSlotId;
  sortOrder: number;
  title: string;
  offsetMin: number;
  durationMin: number;
  imageUrl: string;
  hasCustomImage: boolean;
  defaultImagePath: string;
  linkEnabled: boolean;
  linkUrl: string | null;
  active: boolean;
  updatedAt: string;
};

type Draft = {
  title: string;
  offsetMin: string;
  durationMin: string;
  linkEnabled: boolean;
  linkUrl: string;
  active: boolean;
};

function emptyDraft(): Draft {
  return {
    title: "",
    offsetMin: "",
    durationMin: "",
    linkEnabled: false,
    linkUrl: "",
    active: true,
  };
}

export function AdminHourlyAdsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pendingDelete, setPendingDelete] = useState<AdminSlot | null>(null);

  const applyPayload = useCallback((data: { slots?: AdminSlot[] }) => {
    if (!Array.isArray(data.slots)) return;
    const nextSlots = data.slots;
    setSlots(nextSlots);
    setDrafts((prev) => {
      const next: Record<string, Draft> = {
        [HOURLY_AD_DRAFT_SLOT_ID]: prev[HOURLY_AD_DRAFT_SLOT_ID] ?? emptyDraft(),
      };
      for (const slot of nextSlots) {
        next[slot.id] = {
          title: slot.title,
          offsetMin: String(slot.offsetMin),
          durationMin: String(slot.durationMin),
          linkEnabled: slot.linkEnabled,
          linkUrl: slot.linkUrl ?? "",
          active: slot.active,
        };
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hourly-ads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "불러오기 실패");
      applyPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    const draftCard: AdminSlot = {
      id: HOURLY_AD_DRAFT_SLOT_ID,
      sortOrder: slots.length,
      title: "",
      offsetMin: 0,
      durationMin: 15,
      imageUrl: "",
      hasCustomImage: false,
      defaultImagePath: "",
      linkEnabled: false,
      linkUrl: null,
      active: true,
      updatedAt: "",
    };
    return [...slots, draftCard];
  }, [slots]);

  async function createSlotFromDraft(): Promise<AdminSlot | null> {
    const draft = drafts[HOURLY_AD_DRAFT_SLOT_ID] ?? emptyDraft();
    const title = draft.title.trim() || `광고 ${slots.length + 1}`;
    const res = await fetch("/api/admin/hourly-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        offsetMin: Number(draft.offsetMin),
        durationMin: Number(draft.durationMin || 15),
        active: draft.active,
        linkEnabled: draft.linkEnabled,
        linkUrl: draft.linkUrl.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "슬롯 추가 실패");
    applyPayload(data);
    setDrafts((prev) => ({
      ...prev,
      [HOURLY_AD_DRAFT_SLOT_ID]: emptyDraft(),
    }));
    const created = (data.slots as AdminSlot[] | undefined)?.at(-1) ?? null;
    return created;
  }

  async function saveSlot(slotId: HourlyAdSlotId) {
    const draft = drafts[slotId];
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      if (slotId === HOURLY_AD_DRAFT_SLOT_ID) {
        await createSlotFromDraft();
        return;
      }
      const res = await fetch(`/api/admin/hourly-ads/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          active: draft.active,
          linkEnabled: draft.linkEnabled,
          linkUrl: draft.linkUrl.trim() || null,
          offsetMin: Number(draft.offsetMin),
          durationMin: Number(draft.durationMin),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "슬롯 저장 실패");
      applyPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "슬롯 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(slotId: HourlyAdSlotId, file: File | null) {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      let targetId = slotId;
      if (slotId === HOURLY_AD_DRAFT_SLOT_ID) {
        const created = await createSlotFromDraft();
        if (!created) throw new Error("슬롯 추가 실패");
        targetId = created.id;
      }
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch(`/api/admin/hourly-ads/${targetId}/image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      applyPayload(data);
      setDrafts((prev) => ({
        ...prev,
        [HOURLY_AD_DRAFT_SLOT_ID]: emptyDraft(),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "업로드 실패";
      setError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function clearImage(slotId: HourlyAdSlotId) {
    if (slotId === HOURLY_AD_DRAFT_SLOT_ID) return;
    if (!confirm("업로드한 이미지를 제거하고 기본 이미지로 되돌릴까요?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hourly-ads/${slotId}/image`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이미지 제거 실패");
      applyPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 제거 실패");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSlot() {
    if (!pendingDelete) return;
    const slotId = pendingDelete.id;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hourly-ads/${slotId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "슬롯 삭제 실패");
      setPendingDelete(null);
      applyPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "슬롯 삭제 실패");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(slotId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [slotId]: { ...(prev[slotId] ?? emptyDraft()), ...patch },
    }));
  }

  return (
    <AdminShell title="광고 관리">
      <div className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중…</p>
        ) : (
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3 px-1">
              {cards.map((slot) => {
                const isDraft = slot.id === HOURLY_AD_DRAFT_SLOT_ID;
                const draft = drafts[slot.id] ?? emptyDraft();
                const dirty = isDraft
                  ? Boolean(
                      draft.title.trim() ||
                        draft.offsetMin ||
                        draft.durationMin ||
                        draft.linkUrl.trim() ||
                        draft.linkEnabled,
                    )
                  : draft.title !== slot.title ||
                    draft.offsetMin !== String(slot.offsetMin) ||
                    draft.durationMin !== String(slot.durationMin) ||
                    draft.linkEnabled !== slot.linkEnabled ||
                    (draft.linkUrl || "") !== (slot.linkUrl || "") ||
                    draft.active !== slot.active;

                return (
                  <section
                    key={slot.id}
                    className={`w-[14rem] shrink-0 rounded-2xl border p-3 shadow-sm ${
                      isDraft
                        ? "border-dashed border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-black text-slate-900">
                        {isDraft ? "새 슬롯" : `슬롯 ${slot.sortOrder + 1}`}
                      </h2>
                      <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) =>
                            updateDraft(slot.id, { active: e.target.checked })
                          }
                        />
                        노출
                      </label>
                    </div>

                    <div className="mt-2 flex h-60 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {isDraft || !slot.imageUrl ? (
                        <span className="px-2 text-center text-[11px] text-slate-400">
                          이미지 없음
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slot.imageUrl}
                          alt={slot.title}
                          className="mx-auto h-60 w-full object-contain"
                        />
                      )}
                    </div>

                    <label className="mt-2 block text-[11px] font-bold text-slate-700">
                      매시간 노출 시점
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.offsetMin}
                        placeholder={HOURLY_AD_OFFSET_PLACEHOLDER}
                        onChange={(e) =>
                          updateDraft(slot.id, {
                            offsetMin: e.target.value.replace(/[^\d]/g, ""),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs placeholder:text-slate-300"
                      />
                    </label>

                    <label className="mt-2 block text-[11px] font-bold text-slate-700">
                      노출 지속시간
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draft.durationMin}
                        placeholder={HOURLY_AD_DURATION_PLACEHOLDER}
                        onChange={(e) =>
                          updateDraft(slot.id, {
                            durationMin: e.target.value.replace(/[^\d]/g, ""),
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs placeholder:text-slate-300"
                      />
                    </label>

                    <label className="mt-2 block text-[11px] font-bold text-slate-700">
                      제목
                      <input
                        type="text"
                        value={draft.title}
                        maxLength={80}
                        placeholder="광고 제목"
                        onChange={(e) =>
                          updateDraft(slot.id, { title: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs placeholder:text-slate-300"
                      />
                    </label>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50">
                        업로드/교체
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
                          className="hidden"
                          disabled={saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            void uploadImage(slot.id, file);
                          }}
                        />
                      </label>
                      {!isDraft && slot.hasCustomImage ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void clearImage(slot.id)}
                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 disabled:opacity-40"
                        >
                          기본 복원
                        </button>
                      ) : null}
                    </div>

                    <label className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.linkEnabled}
                        onChange={(e) =>
                          updateDraft(slot.id, {
                            linkEnabled: e.target.checked,
                          })
                        }
                      />
                      링크 이동
                    </label>
                    <input
                      type="url"
                      placeholder="https://"
                      value={draft.linkUrl}
                      disabled={!draft.linkEnabled}
                      onChange={(e) =>
                        updateDraft(slot.id, { linkUrl: e.target.value })
                      }
                      className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs ${
                        draft.linkEnabled
                          ? "border-slate-200 bg-white text-slate-900"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                      }`}
                    />

                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        disabled={saving || !dirty}
                        onClick={() => void saveSlot(slot.id)}
                        className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                      >
                        {isDraft ? "슬롯 추가" : "슬롯 저장"}
                      </button>
                      {!isDraft ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setPendingDelete(slot)}
                          className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 disabled:opacity-40"
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {pendingDelete ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
            role="presentation"
            onClick={() => {
              if (!saving) setPendingDelete(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="hourly-ad-delete-title"
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="hourly-ad-delete-title"
                className="text-base font-black text-slate-900"
              >
                슬롯 삭제
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                <span className="font-bold text-slate-900">
                  슬롯 {pendingDelete.sortOrder + 1}
                </span>
                {pendingDelete.title.trim()
                  ? ` (${pendingDelete.title.trim()})`
                  : ""}
                을(를) 삭제할까요?
                <br />
                삭제 후 뒤쪽 슬롯 번호가 앞으로 당겨집니다.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPendingDelete(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmDeleteSlot()}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {saving ? "삭제 중…" : "삭제"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
