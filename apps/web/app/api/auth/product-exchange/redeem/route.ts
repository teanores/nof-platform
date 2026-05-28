import { type NextRequest, NextResponse } from "next/server";

import { getProductExchangeRepository } from "@/lib/server/product-exchange-repository";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    code?: unknown;
    productKey?: unknown;
    state?: unknown;
  };

  const code = String(body.code ?? "");
  const productKey = String(body.productKey ?? "");
  const state = String(body.state ?? "");

  if (!code || !productKey || !state) {
    return NextResponse.json({ error: "invalid_request", ok: false }, { status: 400 });
  }

  const result = await getProductExchangeRepository().redeem({ code, productKey, state });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ok: false }, { status: 400 });
  }

  return NextResponse.json({
    expiresAt: result.record.expiresAt,
    ok: true,
    platformUserId: result.record.platformUserId,
    productKey: result.record.productKey,
    returnTo: result.record.returnTo,
  });
}
