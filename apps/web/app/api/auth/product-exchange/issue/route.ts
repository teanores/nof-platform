import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

import { portalSessionFromRequest, requirePortalApiSession } from "@/lib/server/portal-auth-gate";
import { getProductAccessRepository } from "@/lib/server/product-access-repository";
import { getProductExchangeRepository } from "@/lib/server/product-exchange-repository";

function productCallbackOrigin(productKey: string): string {
  if (productKey === "nof-tt") {
    return process.env.NOF_TT_ORIGIN ?? process.env.NEXT_PUBLIC_NOF_TT_ORIGIN ?? "http://localhost:3001";
  }

  return process.env.NOF_DEFAULT_PRODUCT_ORIGIN ?? "http://localhost:3001";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requirePortalApiSession(request);
  if (authError) {
    return authError;
  }

  const body = (await request.json().catch(() => ({}))) as {
    productKey?: unknown;
    returnTo?: unknown;
  };
  const productKey = String(body.productKey ?? "");
  const returnTo = String(body.returnTo ?? "/");

  if (!productKey) {
    return NextResponse.json({ error: "invalid_request", ok: false }, { status: 400 });
  }
  const session = await portalSessionFromRequest(request);
  const platformUserId = session.user?.id;
  if (!platformUserId) {
    return NextResponse.json({ error: "invalid_session", ok: false }, { status: 401 });
  }

  if (!(await getProductAccessRepository().exists(productKey))) {
    return NextResponse.json({ error: "unknown_product", ok: false }, { status: 404 });
  }

  const state = randomUUID();
  const issued = await getProductExchangeRepository().issue({
    platformUserId,
    productKey,
    returnTo,
    state,
    ttlSeconds: 120,
  });
  const callbackUrl = new URL("/auth/platform/callback", productCallbackOrigin(productKey));
  callbackUrl.searchParams.set("code", issued.code);
  callbackUrl.searchParams.set("state", state);
  callbackUrl.searchParams.set("next", returnTo);

  return NextResponse.json({
    callbackUrl: callbackUrl.toString(),
    expiresAt: issued.expiresAt,
    ok: true,
  });
}
