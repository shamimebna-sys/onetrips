import { searchAirports } from "@onetrips/catalog";
import { NextResponse } from "next/server";
import { AppError } from "@onetrips/shared";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const airports = await searchAirports({ q, limit: 20 });
    return NextResponse.json({ airports });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toPublicJSON(), { status: error.httpStatus });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ airports: [] });
    }
    return NextResponse.json({ code: "INTERNAL", message: "Unable to search airports." }, { status: 500 });
  }
}
