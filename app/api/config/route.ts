import { NextResponse } from "next/server";
import { getProviderPreset } from "@/lib/ai/config";

export async function GET() {
  const providerId = process.env.API_PROVIDER_ID?.trim() ?? "deepseek";
  const preset = getProviderPreset(providerId);
  return NextResponse.json({
    hasServerKey: !!process.env.API_KEY,
    providerId: process.env.API_PROVIDER_ID ?? "(not set)",
    model: process.env.API_MODEL ?? "(not set)",
    resolvedProviderId: preset.id,
    resolvedBaseUrl: preset.baseUrl
  });
}
