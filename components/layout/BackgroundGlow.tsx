/**
 * Halo radial en haut de page, dérive très lente (20 s), coupé si l'utilisateur réduit les animations.
 *
 * Le jeton --gradient-glow est un cercle qui s'éteint à 70 % de la distance au coin le plus
 * éloigné : la zone doit être au moins deux fois moins haute que large, sinon le dégradé
 * est tranché net en bas. 90rem × 50rem laisse le fondu se terminer à l'intérieur,
 * y compris pendant la dérive (échelle 1,08).
 */
export function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[56rem] overflow-hidden">
      <div className="absolute top-0 left-1/2 h-[50rem] w-[90rem] -translate-x-1/2 bg-gradient-glow motion-safe:animate-glow-drift" />
    </div>
  );
}
