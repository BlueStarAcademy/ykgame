"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { getLegalDocs, type LegalDocId } from "@/lib/legal-docs";
import type { Locale } from "@/i18n/config";

export function SiteLegendLegalFooter() {
  const t = useTranslations("siteLegendLegal");
  const locale = useLocale() as Locale;
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);
  const docs = getLegalDocs(locale);
  const doc = openDoc ? docs[openDoc] : null;
  const links: { id: LegalDocId; label: string }[] = [
    { id: "privacy", label: t("privacy") },
    { id: "terms", label: t("terms") },
    { id: "email", label: t("email") },
  ];

  return (
    <>
      <footer className="site-legend-legal-footer">
        <nav className="site-legend-legal-links" aria-label={t("linksAriaLabel")}>
          {links.map((link) => (
            <button key={link.id} type="button" onClick={() => setOpenDoc(link.id)}>
              {link.label}
            </button>
          ))}
        </nav>
        <p className="site-legend-legal-meta">
          {t("address")}
          <span aria-hidden> | </span>
          TEL: 1588-3806
          <span aria-hidden> | </span>
          FAX: 031-474-3806
        </p>
        <p className="site-legend-legal-meta">
          {t("businessNumber")}
          <span aria-hidden> | </span>
          {t("representative")}
        </p>
        <p className="site-legend-legal-copy">{t("copyright")}</p>
      </footer>

      <AppModalOverlay
        open={!!doc}
        onClose={() => setOpenDoc(null)}
        panelClassName="!max-w-lg !bg-[#121826] !p-0 !text-white"
      >
        {doc ? (
          <div className="site-legend-legal-modal">
            <div className="site-legend-legal-modal-head">
              <h2>{doc.title}</h2>
              <button type="button" onClick={() => setOpenDoc(null)}>
                {t("close")}
              </button>
            </div>
            <div className="site-legend-legal-modal-body">
              {doc.body.split("\n").map((line, index) =>
                line.trim() ? (
                  <p key={`${index}-${line.slice(0, 12)}`}>{line}</p>
                ) : (
                  <br key={`br-${index}`} />
                ),
              )}
            </div>
          </div>
        ) : null}
      </AppModalOverlay>
    </>
  );
}
