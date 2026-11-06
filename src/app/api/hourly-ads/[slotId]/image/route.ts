import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isHourlyAdSlotId } from "@/lib/hourly-ad-constants";
import { getHourlyAdSlotImage } from "@/lib/hourly-ads";

type RouteContext = { params: Promise<{ slotId: string }> };

function mimeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slotId: raw } = await context.params;
    if (!isHourlyAdSlotId(raw)) {
      return NextResponse.json({ error: "Unknown slot" }, { status: 404 });
    }

    const image = await getHourlyAdSlotImage(raw);
    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (image.kind === "bytes") {
      return new NextResponse(image.data, {
        headers: {
          "Content-Type": image.mime,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "Last-Modified": image.updatedAt.toUTCString(),
        },
      });
    }

    const relative = image.path.replace(/^\//, "");
    const absolute = path.join(process.cwd(), "public", relative);
    const data = await readFile(absolute);
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeFromPath(absolute),
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "Last-Modified": image.updatedAt.toUTCString(),
      },
    });
  } catch (error) {
    console.error("[hourly-ads/image] GET failed:", error);
    return NextResponse.json({ error: "Image load failed" }, { status: 500 });
  }
}
