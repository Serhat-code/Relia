import { expect, test } from "@playwright/test";

/**
 * Lien d'invitation (§7), parcours anonyme seulement : aucune écriture en base. Le point essentiel
 * est qu'afficher la page ne consomme jamais le jeton, qui ne sert qu'une fois.
 */

test.describe("lien d'invitation", () => {
  const TOKEN = "0".repeat(64);

  test("sans jeton, la page le dit au lieu de laisser croire à une erreur", async ({ page }) => {
    await page.goto("/rejoindre");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lien incomplet");
  });

  test("un visiteur non connecté est d'abord invité à créer son compte, jeton conservé", async ({ page }) => {
    await page.goto(`/rejoindre?jeton=${TOKEN}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vous êtes invité");
    const signup = page.getByRole("link", { name: /Créer mon compte/ });
    await expect(signup).toHaveAttribute("href", new RegExp(`next=.*jeton%3D${TOKEN}`));
  });

  test("afficher la page ne consomme pas le jeton : aucune redirection, aucune requête d'écriture", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.method() !== "HEAD") writes.push(`${request.method()} ${request.url()}`);
    });

    await page.goto(`/rejoindre?jeton=${TOKEN}`);
    await page.waitForLoadState("networkidle");

    expect(writes).toEqual([]);
    // Comparaison littérale : l'URL ne doit pas avoir bougé d'un caractère.
    expect(page.url()).toContain(`/rejoindre?jeton=${TOKEN}`);
  });

  test("la page d'invitation n'est pas indexable", async ({ page }) => {
    await page.goto(`/rejoindre?jeton=${TOKEN}`);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
