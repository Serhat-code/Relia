import type { Enums } from "@/lib/supabase/database.types";

/** Type de client (§2.5) : les mentions propres aux professionnels ne s'adressent jamais aux particuliers. */
export type ClientType = Enums<"client_type">;

export const CLIENT_TYPE_LABELS: Readonly<Record<ClientType, string>> = {
  b2b: "Professionnel",
  b2c: "Particulier",
};

export const CLIENT_TYPE_SHORT_LABELS: Readonly<Record<ClientType, string>> = {
  b2b: "Pro",
  b2c: "Particulier",
};
