import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateNonce } from "./csp";

const directive = (policy: string, name: string) => policy.split("; ").find((entry) => entry.startsWith(`${name} `) || entry === name);

describe("buildContentSecurityPolicy", () => {
  const production = buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: false });

  it("n'exécute que les scripts portant le nonce de la requête, sans eval en production", () => {
    expect(directive(production, "script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(production).not.toContain("unsafe-eval");
    expect(production).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("interdit l'intégration dans un cadre, les objets et les bases détournées", () => {
    expect(directive(production, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(production, "object-src")).toBe("object-src 'none'");
    expect(directive(production, "base-uri")).toBe("base-uri 'self'");
    expect(directive(production, "upgrade-insecure-requests")).toBeDefined();
  });

  it("ne connaît aucune source tierce, sauf le paiement Stripe pour les formulaires", () => {
    const thirdParties = production.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(thirdParties).toEqual(["https://checkout.stripe.com", "https://billing.stripe.com"]);
    expect(directive(production, "connect-src")).toBe("connect-src 'self'");
  });

  it("en développement, autorise ce qu'exige le rechargement à chaud", () => {
    const development = buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: true });
    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
    expect(directive(development, "connect-src")).toBe("connect-src 'self' ws: wss:");
    expect(development).not.toContain("upgrade-insecure-requests");
  });
});

describe("generateNonce", () => {
  it("renvoie 128 bits aléatoires en base64, différents à chaque appel", () => {
    const first = generateNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(generateNonce()).not.toBe(first);
  });
});
