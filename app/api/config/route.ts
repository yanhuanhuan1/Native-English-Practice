import { NextResponse } from "next/server";
import { getProviderPreset } from "@/lib/ai/config";

export async function GET() {
  const apiKey = process.env.API_KEY?.trim() ?? "";
  const providerId = process.env.API_PROVIDER_ID?.trim() ?? "deepseek";
  const preset = getProviderPreset(providerId);

  return NextResponse.json({
    configured: apiKey.length > 0,
    providerId: preset.id,
    model: process.env.API_MODEL?.trim() || preset.model,
    resolvedBaseUrl: process.env.API_BASE_URL?.trim() || preset.baseUrl
  });
}
