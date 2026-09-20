import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicEnv, getServerEnv, isSupabaseConfigured } from "./env";

describe("variables d'environnement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lit la configuration publique de Supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(getPublicEnv()).toEqual({
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: "sb_publishable_test",
      siteUrl: "http://localhost:3000",
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("sur une préversion Vercel sans URL déclarée, les liens pointent vers la préversion", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "relia-git-debiteurs-equipe.vercel.app");

    expect(getPublicEnv().siteUrl).toBe("https://relia-git-debiteurs-equipe.vercel.app");
  });

  it("en production, l'URL du site est obligatoire", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("une URL déclarée l'emporte toujours", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://relia.example");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "relia-git-debiteurs-equipe.vercel.app");

    expect(getPublicEnv().siteUrl).toBe("https://relia.example");
  });

  it("explique quoi faire quand une variable manque", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*\.env\.example/s);
  });

  it("la clé secrète est lue séparément, côté serveur", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");

    expect(getServerEnv()).toEqual({ supabaseSecretKey: "sb_secret_test" });
  });
});
