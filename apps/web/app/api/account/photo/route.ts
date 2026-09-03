import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCustomerPhotoFilename, setCustomerPhoto } from "@onetrips/customer";
import { jsonError, requireCustomer } from "@/lib/guard";
import { assertHttpRateLimit, assertSameOrigin } from "@onetrips/observability";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "..", "..", "uploads", "photos");

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    const filename = await getCustomerPhotoFilename(auth.userId);
    if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ message: "No photo." }, { status: 404 });
    }
    const file = path.join(UPLOAD_DIR, filename);
    const bytes = await readFile(file);
    const ext = filename.split(".").pop();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth.error) return auth.error;
  try {
    assertSameOrigin(req);
    await assertHttpRateLimit(req, "photo", 8, 15 * 60_000);
    const form = await req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ code: "VALIDATION", message: "Choose a JPEG, PNG, or WebP photo." }, { status: 400 });
    }
    const ext = ALLOWED.get(file.type);
    if (!ext) {
      return NextResponse.json({ code: "VALIDATION", message: "Only JPEG, PNG, or WebP photos are allowed." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ code: "VALIDATION", message: "Photos must be 2 MB or smaller." }, { status: 400 });
    }
    const filename = `${crypto.randomUUID()}.${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ profile: await setCustomerPhoto(auth.userId, filename) });
  } catch (error) {
    return jsonError(error);
  }
}
