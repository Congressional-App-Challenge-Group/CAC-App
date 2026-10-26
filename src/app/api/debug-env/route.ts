import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    provider: process.env.AI_PROVIDER,
    hasApiKey: !!process.env.ENRICHMENT_API_KEY,
    apiKeyLength: process.env.ENRICHMENT_API_KEY?.length || 0,
    apiKeyPrefix: process.env.ENRICHMENT_API_KEY?.substring(0, 10) || 'none',
    baseUrl: process.env.ENRICHMENT_BASE_URL,
    model: process.env.ENRICHMENT_MODEL,
  });
}
