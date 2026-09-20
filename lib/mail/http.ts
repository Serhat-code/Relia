/** Appels aux API de messagerie (Gmail, Microsoft Graph). */

const REQUEST_TIMEOUT_MS = 15_000;

/** Appel HTTP qui ne lève jamais : délai dépassé ou réseau coupé donnent null. */
export async function requestProvider(url: string | URL, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

/** Accès refusé par le fournisseur : jeton révoqué ou permission retirée. */
export const isAuthFailure = (status: number) => status === 401 || status === 403;

/**
 * Corps d'une réponse, lu au plus jusqu'à `maxBytes` : au-delà, la lecture est interrompue et null
 * est renvoyé (un message de plusieurs Mo n'est jamais chargé en entier). Null aussi si le flux casse.
 */
export async function readBodyWithin(response: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
}
