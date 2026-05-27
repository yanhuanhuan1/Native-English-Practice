import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasServerKey: !!process.env.API_KEY,
    providerId: process.env.API_PROVIDER_ID ?? "(not set)",
    model: process.env.API_MODEL ?? "(not set)",
    baseUrl: process.env.API_BASE_URL ?? "(not set)"
  });
}
