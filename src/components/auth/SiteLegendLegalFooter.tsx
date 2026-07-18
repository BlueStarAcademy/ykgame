"use client";

import { useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { LEGAL_DOCS, type LegalDocId } from "@/lib/legal-docs";

const LINKS: { id: LegalDocId; label: string }[] = [
  { id: "privacy", label: "개인정보처리방침" },
  { id: "terms", label: "이용약관" },
  { id: "email", label: "이메일주소 무단수집거부" },
];

export function SiteLegendLegalFooter() {
  const [openDoc, setOpenDoc] = useState<LegalDocId | null>(null);
  const doc = openDoc ? LEGAL_DOCS[openDoc] : null;

  return (
    <>
      <footer className="site-legend-legal-footer">
        <nav className="site-legend-legal-links" aria-label="약관 및 정책">
          {LINKS.map((link) => (
            <button key={link.id} type="button" onClick={() => setOpenDoc(link.id)}>
              {link.label}
            </button>
          ))}
        </nav>
        <p className="site-legend-legal-meta">
          경기도 안양시 만안구 경수대로 1357
          <span aria-hidden> | </span>
          TEL: 1588-3806
          <span aria-hidden> | </span>
          FAX: 031-474-3806
        </p>
        <p className="site-legend-legal-meta">
          사업자번호 : 119-81-30845
          <span aria-hidden> | </span>
          대표자 : 채호선
        </p>
        <p className="site-legend-legal-copy">
          Copyright © sunnyyk.co.kr All rights reserved.
        </p>
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
                닫기
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
