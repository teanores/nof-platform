import { randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { portalLoginUrl, portalSessionFromRequest, safePortalReturnTo } from "@/lib/server/portal-auth-gate";
import { getProductAccessRepository } from "@/lib/server/product-access-repository";
import { getProductExchangeRepository } from "@/lib/server/product-exchange-repository";

export const dynamic = "force-dynamic";

interface ProductLaunchContext {
  params: Promise<{ productKey: string }>;
}

function productCallbackOrigin(productKey: string): string {
  if (productKey === "nof-tt") {
    return process.env.NOF_TT_ORIGIN ?? process.env.NEXT_PUBLIC_NOF_TT_ORIGIN ?? "http://localhost:3001";
  }

  return process.env.NOF_DEFAULT_PRODUCT_ORIGIN ?? "http://localhost:3001";
}

export async function GET(request: NextRequest, context: ProductLaunchContext): Promise<NextResponse> {
  const { productKey } = await context.params;
  const session = await portalSessionFromRequest(request);

  if (!session.authenticated || !session.user?.id) {
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return new NextResponse(null, {
      headers: { location: session.loginUrl || portalLoginUrl(returnTo) },
      status: 303,
    });
  }

  if (!(await getProductAccessRepository().exists(productKey))) {
    return NextResponse.json({ error: "unknown_product", ok: false }, { status: 404 });
  }

  const returnTo = safePortalReturnTo(request.nextUrl.searchParams.get("next") ?? "/");
  const state = randomUUID();
  const issued = await getProductExchangeRepository().issue({
    platformUserId: session.user.id,
    productKey,
    returnTo,
    state,
    ttlSeconds: 120,
  });
  const callbackUrl = new URL("/auth/platform/callback", productCallbackOrigin(productKey));
  callbackUrl.searchParams.set("code", issued.code);
  callbackUrl.searchParams.set("state", state);
  callbackUrl.searchParams.set("next", returnTo);

  return new NextResponse(null, {
    headers: { location: callbackUrl.toString() },
    status: 303,
  });
}
