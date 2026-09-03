import { registerB2b } from "@onetrips/auth";
import { requestContext, toAuthResponse } from "@/lib/auth-http";
import { jsonError } from "@/lib/guard";
import { assertMutationOrigin } from "@onetrips/observability";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

async function saveUpload(file: File | null, dir: string) {
  if (!file || file.size === 0) return null;
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${filename}`;
}

export async function POST(request: Request) {
  try {
    assertMutationOrigin(request);
    const formData = await request.formData();
  const nidFile = formData.get("nidFile") as File | null;
  const tradeLicenseFile = formData.get("tradeLicenseFile") as File | null;
  const uploadDir = path.join(process.cwd(), "public/uploads");
  const nidUrl = await saveUpload(nidFile, uploadDir);

  if (!nidUrl) {
    return toAuthResponse({
      status: 400,
      body: { code: "VALIDATION", message: "NID upload is required." },
    });
  }

  return toAuthResponse(
    await registerB2b({
      fullName: String(formData.get("fullName") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      country: String(formData.get("country") ?? ""),
      city: String(formData.get("city") ?? ""),
      password: String(formData.get("password") ?? ""),
      nidUrl,
      tradeLicenseUrl: await saveUpload(tradeLicenseFile, uploadDir),
    }, requestContext(request)),
  );
  } catch (error) {
    return jsonError(error);
  }
}
