import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { POST as redeemExchange } from "@/app/api/auth/product-exchange/redeem/route";
import { POST as issueExchange } from "@/app/api/auth/product-exchange/issue/route";
import { getProductExchangeRepository } from "@/lib/server/product-exchange-repository";

function jsonRequest(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("product exchange API", () => {
  it("requires platform authentication before issuing an exchange code", async () => {
    const response = await issueExchange(jsonRequest("/api/auth/product-exchange/issue", { productKey: "nof-tt" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: false,
      error: "Authentication required",
    });
  });

  it("redeems a valid one-time exchange code", async () => {
    const issued = await getProductExchangeRepository().issue({
      platformUserId: "user-1",
      productKey: "nof-tt",
      returnTo: "/projects",
      state: "state-1",
      ttlSeconds: 120,
    });

    const response = await redeemExchange(
      jsonRequest("/api/auth/product-exchange/redeem", {
        code: issued.code,
        productKey: "nof-tt",
        state: "state-1",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      platformUserId: "user-1",
      productKey: "nof-tt",
      returnTo: "/projects",
    });
  });

  it("rejects invalid exchange codes", async () => {
    const response = await redeemExchange(
      jsonRequest("/api/auth/product-exchange/redeem", {
        code: "px_missing",
        productKey: "nof-tt",
        state: "state-1",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "not_found",
      ok: false,
    });
  });
});
