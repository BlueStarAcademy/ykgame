import type { SportsMeetStageKind } from "./patterns";
import type { AttachmentType } from "../types";

export type SportsMeetWorkKind = "dig" | "dump" | "crash" | "hill";

export function getSportsMeetAllowedAttachment(
  stage: SportsMeetStageKind | null | undefined,
): AttachmentType | null {
  if (!stage) return null;
  switch (stage) {
    case "drive":
    case "dig":
      return "bucket";
    case "crash":
      return "breaker";
    case "hill":
      return "grapple";
  }
}

export function isSportsMeetWorkAllowed(
  stage: SportsMeetStageKind | null | undefined,
  work: SportsMeetWorkKind,
): boolean {
  if (!stage) return false;
  switch (work) {
    case "dig":
    case "dump":
      return stage === "dig";
    case "crash":
      return stage === "crash";
    case "hill":
      return stage === "hill";
  }
}

export function sportsMeetStageLockMessage(
  stage: SportsMeetStageKind | null | undefined,
): string {
  if (!stage) return "이전 코스를 먼저 완료하세요";
  switch (stage) {
    case "drive":
      return "주행 별을 먼저 모두 모으세요";
    case "dig":
      return "흙 하역을 먼저 완료하세요";
    case "crash":
      return "아스팔트 파쇄를 먼저 완료하세요";
    case "hill":
      return "돌 하역을 먼저 완료하세요";
  }
}
