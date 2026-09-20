import { expect, test } from "@playwright/test";

/** Durcissement : en-têtes de sécurité, politique de contenu sans violation, espace client protégé. */

test.describe("sécurité", () => {
  test("chaque page porte une politique de contenu avec un nonce propre à la requête", async ({ request }) => {
    const first = await request.get("/");
    const second = await request.get("/");
    const policy = first.headers()["content-security-policy"] ?? "";

    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-eval");
    expect(second.headers()["content-security-policy"]).not.toBe(policy);
    expect(first.headers()["x-frame-options"]).toBe("DENY");
    expect(first.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("aucune violation de la politique de contenu sur les pages publiques et les démonstrations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy/i.test(message.text())) violations.push(message.text());
    });

    for (const path of ["/", "/tarifs", "/connexion", "/design/reponses", "/design/tableau-de-bord"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }

    expect(violations).toEqual([]);
  });

  test("l'espace client renvoie vers la connexion, en gardant la destination", async ({ page }) => {
    await page.goto("/app/factures");

    await expect(page).toHaveURL(/\/connexion\?next=%2Fapp%2Ffactures$/);
  });

  test("les crons refusent un appel sans le secret", async ({ request }) => {
    for (const path of ["/api/cron/relances/preparer", "/api/cron/relances/envoyer", "/api/cron/reponses", "/api/cron/purge"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });

  test("le webhook Stripe refuse un appel non signé", async ({ request }) => {
    const response = await request.post("/api/stripe/webhook", { data: { type: "checkout.session.completed" } });

    expect([400, 503]).toContain(response.status());
  });

  test("l'inscription refuse un formulaire vide, sans rien créer", async ({ page }) => {
    await page.goto("/inscription");

    await page.getByRole("button", { name: /Créer mon compte/ }).click();

    await expect(page.getByText(/obligatoire|Indiquez|accepter/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/inscription$/);
  });
});
