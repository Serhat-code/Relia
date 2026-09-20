import { expect, test } from "@playwright/test";

/**
 * Écrans de l'application sur leurs démonstrations (données fictives, sans base) : interactions
 * côté navigateur. Les actions serveur, qui exigent une session, ne sont pas déclenchées.
 */

test.describe("démonstrations", () => {
  test("une réponse de client propose les décisions adaptées, et la promesse s'ouvre dans une fenêtre", async ({ page }) => {
    await page.goto("/design/reponses");
    const dispute = page.locator("article, div").filter({ hasText: "Menuiserie Caradec & Fils · facture F-2026-0412" }).last();

    await expect(page.getByText("Contestation").first()).toBeVisible();
    await expect(page.getByText("Analyse assistée par IA").first()).toBeVisible();
    await page.getByRole("button", { name: "Noter une promesse" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Noter une promesse de règlement" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Date promise")).toBeVisible();
    await dialog.getByRole("button", { name: "Retour" }).click();
    await expect(dialog).toBeHidden();
    await expect(dispute).toBeVisible();
  });

  test("le tableau de bord montre les chiffres clés et l'ancienneté des retards", async ({ page }) => {
    await page.goto("/design/tableau-de-bord");

    for (const label of ["Encours total", "En retard", "Sous promesse", "DSO"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    const bucket = page.getByRole("listitem").filter({ hasText: "Plus de 90 jours" });
    await expect(bucket).toContainText("du montant en retard");
  });

  test("le journal filtre par thème et pagine", async ({ page }) => {
    await page.goto("/design/journal");

    await expect(page.getByRole("link", { name: "Réponses et promesses" })).toBeVisible();
    await expect(page.getByText("1–50 sur 124")).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Promesse non tenue");
  });

  test("les offres des paramètres affichent l'essai en cours", async ({ page }) => {
    await page.goto("/design/parametres");

    await expect(page.getByText(/jours restants/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Choisir cette offre" })).toHaveCount(3);
  });
});
