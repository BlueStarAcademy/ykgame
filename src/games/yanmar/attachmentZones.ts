import type { AttachmentType } from "./types";
import {
  getActiveDigZoneAt,
  isInCrashZone,
  isInDumpZone,
  isInHillZone,
  type TerrainData,
} from "./terrain";

export type SiteZoneKind = "dig" | "crash" | "hill" | "dump" | "neutral";
export type AttachmentAction = "dig" | "strike" | "grab" | "dump";

export function getZoneAt(
  wx: number,
  wz: number,
  terrain: TerrainData,
): SiteZoneKind {
  if (isInCrashZone(terrain, wx, wz)) return "crash";
  if (isInHillZone(terrain, wx, wz)) return "hill";
  if (getActiveDigZoneAt(terrain, wx, wz)) return "dig";
  if (isInDumpZone(wx, wz)) return "dump";
  return "neutral";
}

function expectedAttachment(zone: SiteZoneKind): AttachmentType | null {
  if (zone === "crash") return "breaker";
  if (zone === "hill") return "grapple";
  if (zone === "dig" || zone === "dump") return "bucket";
  return null;
}

const LABELS: Record<AttachmentType, string> = {
  bucket: "버켓",
  breaker: "브레이커",
  grapple: "집게",
};

/** 주격 조사: 받침 유무에 따라 은/는 */
function topicParticle(label: string): "은" | "는" {
  if (label === "버켓") return "은";
  return "는";
}

/** 목적격 조사: 을/를 */
function objectParticle(label: string): "을" | "를" {
  if (label === "버켓") return "을";
  return "를";
}

const ZONE_LABELS: Record<Exclude<SiteZoneKind, "neutral">, string> = {
  dig: "굴착",
  crash: "파쇄",
  hill: "석재",
  dump: "하역",
};

const ATTACHMENT_ZONE: Record<AttachmentType, Exclude<SiteZoneKind, "neutral">> =
  {
    bucket: "dig",
    breaker: "crash",
    grapple: "hill",
  };

export function checkAttachmentUse(
  attachment: AttachmentType,
  zone: SiteZoneKind,
  action: AttachmentAction,
): { allowed: boolean; message?: string } {
  if (action === "dump") {
    if (attachment === "bucket" && zone === "dump") return { allowed: true };
    return {
      allowed: false,
      message:
        attachment === "bucket"
          ? "하역은 하역 지역에서만 가능합니다."
          : "현재 부착물로는 하역할 수 없습니다. 버켓으로 전환하세요.",
    };
  }

  const requiredAction: Record<AttachmentType, AttachmentAction> = {
    bucket: "dig",
    breaker: "strike",
    grapple: "grab",
  };
  if (requiredAction[attachment] !== action) {
    return { allowed: false };
  }

  const expected = expectedAttachment(zone);
  if (expected === attachment) return { allowed: true };

  if (expected) {
    const tool = LABELS[expected];
    return {
      allowed: false,
      message: `${ZONE_LABELS[zone as Exclude<SiteZoneKind, "neutral">]} 지역에서는 ${tool}${objectParticle(tool)} 사용하세요.`,
    };
  }

  const label = LABELS[attachment];
  const zoneLabel = ZONE_LABELS[ATTACHMENT_ZONE[attachment]];
  return {
    allowed: false,
    message: `${label}${topicParticle(label)} ${zoneLabel} 지역에서만 사용할 수 있습니다.`,
  };
}
