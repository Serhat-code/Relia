import { expect, test } from "@playwright/test";

/** Parcours publics : accueil, tarifs, pages légales, sans compte ni base de données. */

test.describe("site public", () => {
  test("l'accueil présente Relia et mène à l'essai gratuit", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("sans relancer à la main");
    await page.getByRole("link", { name: /Essayer 14 jours gratuitement/ }).click();
    await expect(page).toHaveURL(/\/inscription$/);
    await expect(page.getByRole("checkbox")).toBeVisible();
  });

  test("les questions fréquentes s'ouvrent au clic", async ({ page }) => {
    await page.goto("/");
    const question = page.getByText("Mes clients règlent-ils Relia ?");

    await question.click();

    await expect(page.getByText("Aucun paiement ne transite par Relia.", { exact: false }).first()).toBeVisible();
  });

  test("les tarifs affichent les trois offres, hors taxes", async ({ page }) => {
    await page.goto("/tarifs");

    for (const price of ["29 €", "49 €", "79 €"]) {
      await expect(page.getByText(price, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("HT / mois").first()).toBeVisible();
  });

  test("les pages légales sont accessibles depuis le pied de page", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");

    for (const [label, heading] of [
      ["Mentions légales", "Mentions légales"],
      ["Conditions générales", "Conditions générales d'utilisation et d'abonnement"],
      ["Confidentialité", "Politique de confidentialité"],
      ["Sous-traitants", "Sous-traitants ultérieurs"],
    ] as const) {
      await footer.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    }
  });

  test("aucun terme interdit (§2.1) dans le texte des pages publiques", async ({ page }) => {
    for (const path of ["/", "/tarifs", "/cgu", "/confidentialite", "/mentions-legales", "/dpa", "/sous-traitants"]) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).toLowerCase();
      expect(text, path).not.toMatch(/recouvrement|\bagence\b/);
    }
  });

  test("une adresse inconnue affiche la page introuvable", async ({ page }) => {
    const response = await page.goto("/cette-page-n-existe-pas");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("n'existe pas");
  });

  test("sur téléphone, aucun écran ne déborde horizontalement", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "contrôle propre au format téléphone");
    const paths = ["/", "/tarifs", "/cgu", "/connexion", "/design/factures", "/design/debiteurs", "/design/relances", "/design/reponses", "/design/tableau-de-bord", "/design/journal", "/design/parametres"];

    for (const path of paths) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

/**
 * Données structurées : le vrai risque est la CSP du projet, qui n'autorise aucun script sans le
 * nonce de la requête. Un test unitaire ne verrait pas un balisage bloqué par le navigateur.
 */
test.describe("données structurées", () => {
  test("l'accueil publie un balisage schema.org valide, servi avec le nonce", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
    });

    await page.goto("/");
    const script = page.locator('script[type="application/ld+json"]');

    await expect(script).toHaveCount(1);
    // Le navigateur efface l'attribut nonce du DOM une fois la CSP appliquée (protection contre
    // l'exfiltration) : on le cherche donc dans le HTML servi, pas dans le DOM.
    const served = await (await page.request.get("/")).text();
    const tag = served.match(/<script[^>]*application\/ld\+json[^>]*>/)?.[0] ?? "";
    expect(tag, "balise du balisage structuré dans le HTML servi").toMatch(/nonce="[^"]+"/);
    const graph = JSON.parse((await script.textContent()) ?? "{}");
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual([
      "Organization",
      "SoftwareApplication",
      "FAQPage",
    ]);
    expect(violations).toEqual([]);
  });

  test("les tarifs annoncent les trois prix au moteur de recherche", async ({ page }) => {
    await page.goto("/tarifs");

    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    const software = graph["@graph"].find((node: { "@type": string }) => node["@type"] === "SoftwareApplication");

    expect(software.offers.map((offer: { price: number }) => offer.price)).toEqual([29, 49, 79]);
  });
});
