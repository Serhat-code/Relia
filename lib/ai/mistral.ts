import "server-only";
import { z } from "zod";
import type { CompletionRequest, LLMProvider } from "./llm-provider";

/** Mistral (La Plateforme, hébergée dans l'UE) — §2.3. */
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";
const TIMEOUT_MS = 20_000;
/** Peu de fantaisie : on reformule un courrier factuel. */
const TEMPERATURE = 0.3;

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export class MistralProvider implements LLMProvider {
  readonly name = "Mistral";

  constructor(private readonly apiKey: string) {}

  async complete({ system, user, maxTokens }: CompletionRequest): Promise<string | null> {
    try {
      const response = await fetch(MISTRAL_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          temperature: TEMPERATURE,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error("Mistral : réponse en erreur", { status: response.status });
        return null;
      }
      const parsed = responseSchema.safeParse(await response.json());
      return parsed.success ? (parsed.data.choices[0]?.message.content ?? null) : null;
    } catch (error) {
      console.error("Mistral : appel impossible", { message: error instanceof Error ? error.message : "inconnu" });
      return null;
    }
  }
}

/** Fournisseur configuré, ou null (MISTRAL_API_KEY absente) : les relances utilisent alors les modèles tels quels. */
export function getLLMProvider(): LLMProvider | null {
  const apiKey = process.env.MISTRAL_API_KEY;
  return apiKey ? new MistralProvider(apiKey) : null;
}
