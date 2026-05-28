import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ForgePortalSession } from "@/lib/types";

const authSession = vi.hoisted(() => ({
  value: {
    authenticated: true,
    loginUrl: "/login",
    user: {
      experience: 0,
      id: "user-1",
      username: "teanore",
    },
  } as ForgePortalSession,
}));

vi.mock("@/lib/server/portal-auth-gate", () => ({
  portalLoginUrl: (returnTo: string) => `/login?next=${encodeURIComponent(returnTo)}`,
  portalSessionFromRequest: vi.fn(async () => authSession.value),
  safePortalReturnTo: (returnTo?: string) => {
    if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.startsWith("/login")) {
      return "/";
    }
    return returnTo;
  },
}));

vi.mock("@/lib/server/product-access-repository", () => ({
  getProductAccessRepository: () => ({
    exists: async (productKey: string) => productKey === "nof-tt",
  }),
}));

import { GET as launchProduct } from "@/app/products/[productKey]/launch/route";

function launchRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, { method: "GET" });
}

describe("product launch route", () => {
  beforeEach(() => {
    authSession.value = {
      authenticated: true,
      loginUrl: "/login",
      user: {
        experience: 0,
        id: "user-1",
        username: "teanore",
      },
    };
  });

  it("redirects authenticated users to the product callback with an exchange code", async () => {
    const response = await launchProduct(launchRequest("/products/nof-tt/launch?next=/projects/nof-tt"), {
      params: Promise.resolve({ productKey: "nof-tt" }),
    });

    expect(response.status).toBe(303);
    const location = response.headers.get("location");
    expect(location).toContain("http://localhost:3001/auth/platform/callback?");
    expect(location).toContain("code=px_");
    expect(location).toContain("state=");
    expect(location).toContain("next=%2Fprojects%2Fnof-tt");
  });

  it("redirects guests to platform login before launching the product", async () => {
    authSession.value = { authenticated: false, loginUrl: "/login?next=%2Fproducts%2Fnof-tt%2Flaunch" };

    const response = await launchProduct(launchRequest("/products/nof-tt/launch"), {
      params: Promise.resolve({ productKey: "nof-tt" }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login?next=%2Fproducts%2Fnof-tt%2Flaunch");
  });

  it("fails closed for unknown products", async () => {
    const response = await launchProduct(launchRequest("/products/unknown/launch"), {
      params: Promise.resolve({ productKey: "unknown" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "unknown_product", ok: false });
  });
});
