/**
 * Fournisseur de rédaction (§2.3) : abstrait pour pouvoir en changer. En production, uniquement un
 * modèle hébergé dans l'Union européenne (Mistral) : les données des débiteurs ne quittent pas l'UE.
 */
export type CompletionRequest = { system: string; user: string; maxTokens: number };

export interface LLMProvider {
  readonly name: string;
  /** Réponse brute du modèle (JSON attendu), ou null en cas d'échec : l'appelant se replie alors sur le modèle. */
  complete(request: CompletionRequest): Promise<string | null>;
}
