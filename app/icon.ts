import { renderRingSvg } from "@/lib/brand/ring-svg";

// Favicon statique : l'anneau Relia, généré depuis la même géométrie que le logo et le loader.
export const contentType = "image/svg+xml";

export default function Icon() {
  return new Response(renderRingSvg(), { headers: { "Content-Type": contentType } });
}
