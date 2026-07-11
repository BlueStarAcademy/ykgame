import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_ERROR_CODE = /^[A-Z0-9_]{1,64}$/;

export type HotApiOutcome =
  | "success"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "client_error"
  | "server_error";

export type HotApiMetadata = {
  outcome?: HotApiOutcome;
  batchSize?: number;
  replayed?: boolean;
  duplicate?: boolean;
  rateLimitBypassed?: boolean;
  errorCode?: string;
};

export type HotApiLogEntry = {
  event: "hot_api_request";
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
} & HotApiMetadata;

export type HotApiObservationContext = {
  readonly requestId: string;
  setMetadata(metadata: HotApiMetadata): void;
};

function definedMetadata(metadata: HotApiMetadata): HotApiMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as HotApiMetadata;
}

export function mergeHotApiMetadata(
  current: HotApiMetadata,
  update: HotApiMetadata,
): HotApiMetadata {
  return { ...current, ...definedMetadata(update) };
}

export function getHotApiRequestId(request: Request): string {
  const candidate = request.headers.get("x-request-id");
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

function defaultOutcome(status: number): HotApiOutcome {
  if (status < 400) return "success";
  if (status < 500) return "client_error";
  return "server_error";
}

export function createHotApiLogEntry({
  requestId,
  route,
  method,
  status,
  durationMs,
  metadata = {},
}: {
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  metadata?: HotApiMetadata;
}): HotApiLogEntry {
  const safeMetadata = definedMetadata(metadata);
  if (
    safeMetadata.errorCode &&
    !SAFE_ERROR_CODE.test(safeMetadata.errorCode)
  ) {
    delete safeMetadata.errorCode;
  }

  return {
    event: "hot_api_request",
    requestId,
    route,
    method,
    status,
    durationMs: Math.max(0, Math.round(durationMs)),
    outcome: safeMetadata.outcome ?? defaultOutcome(status),
    ...safeMetadata,
  };
}

export function writeHotApiLog(
  entry: HotApiLogEntry,
  logger: (line: string) => void = console.info,
): void {
  logger(JSON.stringify(entry));
}

export function withHotApiObservability<RouteContext>(
  route: string,
  handler: (
    request: Request,
    routeContext: RouteContext,
    observation: HotApiObservationContext,
  ) => Promise<NextResponse> | NextResponse,
) {
  return async (
    request: Request,
    routeContext: RouteContext,
  ): Promise<NextResponse> => {
    const startedAt = performance.now();
    const requestId = getHotApiRequestId(request);
    let metadata: HotApiMetadata = {};
    const observation: HotApiObservationContext = {
      requestId,
      setMetadata(update) {
        metadata = mergeHotApiMetadata(metadata, update);
      },
    };

    try {
      const response = await handler(request, routeContext, observation);
      response.headers.set("x-request-id", requestId);
      writeHotApiLog(
        createHotApiLogEntry({
          requestId,
          route,
          method: request.method,
          status: response.status,
          durationMs: performance.now() - startedAt,
          metadata,
        }),
      );
      return response;
    } catch (error) {
      writeHotApiLog(
        createHotApiLogEntry({
          requestId,
          route,
          method: request.method,
          status: 500,
          durationMs: performance.now() - startedAt,
          metadata: mergeHotApiMetadata(metadata, {
            outcome: "server_error",
            errorCode: "UNHANDLED_EXCEPTION",
          }),
        }),
      );
      throw error;
    }
  };
}
