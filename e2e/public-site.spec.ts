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
