import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { buildServer } from "../src/server.js";
import { loadEnv } from "@rekuway/config";
import { createTestOrganization } from "./helpers.js";

const prisma = new PrismaClient();
let app: FastifyInstance;
let orgSlug: string;

beforeAll(async () => {
  app = await buildServer(loadEnv());
  await app.ready();

  const org = await createTestOrganization(prisma, "httptest-org");
  orgSlug = org.slug;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: "httptest+" } } });
  await prisma.organization.deleteMany({ where: { slug: { startsWith: "httptest-org-" } } });
  await prisma.$disconnect();
  await app.close();
});

describe("GET /health and /ready", () => {
  it("health returns ok without touching the DB", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("ready confirms DB and Redis connectivity", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready" });
  });
});

describe("Zod validation (spec section 25/26 — never trust client input)", () => {
  it("rejects a malformed email on /auth/register/options", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register/options",
      payload: { email: "not-an-email", organizationSlug: orgSlug },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  it("rejects a missing body entirely", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/login/options", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an oversized payload gracefully (no crash)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register/options",
      payload: { email: "a".repeat(2_000_000) + "@example.com", organizationSlug: orgSlug },
    });
    expect([400, 413]).toContain(res.statusCode);
  });
});

describe("Enumeration protection (spec section 27)", () => {
  it("register/options responds identically in shape for new vs existing email", async () => {
    const email = "httptest+enum1@example.com";

    const first = await app.inject({
      method: "POST",
      url: "/auth/register/options",
      payload: { email, organizationSlug: orgSlug },
    });
    const second = await app.inject({
      method: "POST",
      url: "/auth/register/options",
      payload: { email, organizationSlug: orgSlug },
    });

    expect(first.statusCode).toBe(second.statusCode);
    expect(Object.keys(first.json()).sort()).toEqual(Object.keys(second.json()).sort());
  });

  it("login/options responds 200 with a valid shape even for a nonexistent user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login/options",
      payload: { email: "httptest+doesnotexist@example.com", organizationSlug: orgSlug },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("challengeId");
    expect(res.json()).toHaveProperty("options");
  });
});

describe("Security headers (spec section 30)", () => {
  it("responses include HSTS and no-sniff headers", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });
});

describe("Authenticated routes require a valid session (spec section 24)", () => {
  it("rejects /auth/session without a cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/session" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects /auth/devices without a cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/devices" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a forged/unknown session cookie", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: { cookie: "rekuway_session=totally-forged-value" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Login flow rejects a fabricated WebAuthn payload (no bypass)", () => {
  it("login/verify fails cleanly on a syntactically valid but cryptographically fake credential", async () => {
    const email = "httptest+fake@example.com";
    const optionsRes = await app.inject({
      method: "POST",
      url: "/auth/login/options",
      payload: { email, organizationSlug: orgSlug },
    });
    const { challengeId } = optionsRes.json() as { challengeId: string };

    const res = await app.inject({
      method: "POST",
      url: "/auth/login/verify",
      payload: {
        email,
        organizationSlug: orgSlug,
        challengeId,
        credential: {
          id: "fake-credential-id",
          rawId: "ZmFrZQ",
          type: "public-key",
          response: {
            clientDataJSON: Buffer.from(JSON.stringify({ type: "webauthn.get" })).toString(
              "base64url",
            ),
            authenticatorData: "ZmFrZQ",
            signature: "ZmFrZQ",
          },
        },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("AUTHENTICATION_FAILED");
  });
});

describe("3-Touch cannot be used without a prior WebAuthn-verified nonce (spec section 34)", () => {
  it("rejects a bare 3-touch/verify call with a fabricated nonceId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login/3touch/verify",
      payload: {
        nonceId: "00000000-0000-0000-0000-000000000000",
        sequence: ["circle", "square", "triangle"],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("AUTHENTICATION_FAILED");
  });
});
