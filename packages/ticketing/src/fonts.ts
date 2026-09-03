import "regenerator-runtime/runtime";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

function loadFontFile(file: string) {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "../fonts", file),
    join(process.cwd(), "packages/ticketing/fonts", file),
    join(process.cwd(), "../../packages/ticketing/fonts", file),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path);
  }
  throw new Error(`Ticket PDF font not found: ${file}`);
}

let regularBytes: Buffer | undefined;
let boldBytes: Buffer | undefined;

function regularFontBytes() {
  return (regularBytes ??= loadFontFile("NotoSansBengali-Regular.ttf"));
}

function boldFontBytes() {
  return (boldBytes ??= loadFontFile("NotoSansBengali-Bold.ttf"));
}

export async function embedUnicodeFonts(doc: PDFDocument): Promise<{ unicode: PDFFont; unicodeBold: PDFFont }> {
  doc.registerFontkit(fontkit);
  return {
    unicode: await doc.embedFont(regularFontBytes(), { subset: true }),
    unicodeBold: await doc.embedFont(boldFontBytes(), { subset: true }),
  };
}
