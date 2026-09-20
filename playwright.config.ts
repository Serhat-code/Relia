import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout : parcours publics et démonstrations, sur un serveur de production local
 * (`npm run build` d'abord). Aucune écriture en base : les parcours connectés se testent sur un projet
 * Supabase dédié. Navigateur : Edge installé sur le poste (canal msedge), rien à télécharger.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Plusieurs Edge en parallèle sur un même poste finissent par se fermer en cours de test.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "bureau", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
