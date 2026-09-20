import { BRAND_HEX, OPEN_DASH_DEGREES, REDUCED_MOTION_PULSE, RING, RING_ARCS, spinOffsetAt } from "./ring";

/**
 * Favicon animé : version réduite du loader, dessinée sur un canvas et injectée dans
 * les <link rel="icon"> de la page le temps d'un chargement. Plusieurs loaders peuvent
 * la demander en même temps : elle s'arrête quand le dernier la libère.
 */
const FRAME_INTERVAL_MS = 80;
const CANVAS_SIZE = 64;

let activeRequests = 0;
let stopRunning: (() => void) | null = null;

export function acquireFaviconAnimation(isReducedMotion: boolean): () => void {
  activeRequests += 1;
  if (activeRequests === 1) stopRunning = startAnimation(isReducedMotion);

  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    activeRequests -= 1;
    if (activeRequests > 0) return;
    stopRunning?.();
    stopRunning = null;
  };
}

function startAnimation(isReducedMotion: boolean): () => void {
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (links.length === 0 || !context) return () => undefined;

  const originals = links.map((link) => ({ link, href: link.getAttribute("href"), type: link.type }));
  const startedAt = performance.now();
  const render = () => {
    drawRingFrame(context, performance.now() - startedAt, isReducedMotion);
    const frame = canvas.toDataURL("image/png");
    links.forEach((link) => {
      link.type = "image/png";
      link.setAttribute("href", frame);
    });
  };

  render();
  const timer = window.setInterval(render, FRAME_INTERVAL_MS);

  return () => {
    window.clearInterval(timer);
    originals.forEach(({ link, href, type }) => {
      link.type = type;
      if (href === null) link.removeAttribute("href");
      else link.setAttribute("href", href);
    });
  };
}

function pulseOpacity(elapsedMs: number): number {
  const { durationMs, minOpacity } = REDUCED_MOTION_PULSE;
  const wave = 0.5 + 0.5 * Math.cos((2 * Math.PI * elapsedMs) / durationMs);
  return minOpacity + (1 - minOpacity) * wave;
}

/** Dégradé conique cyclique (pas de rupture de couleur à midi) ; accent uni si non pris en charge. */
function brandConicGradient(context: CanvasRenderingContext2D): CanvasGradient | string {
  if (typeof context.createConicGradient !== "function") return BRAND_HEX.accent;
  const gradient = context.createConicGradient(-Math.PI / 2, RING.center, RING.center);
  gradient.addColorStop(0, BRAND_HEX.accent);
  gradient.addColorStop(0.5, BRAND_HEX.secondary);
  gradient.addColorStop(1, BRAND_HEX.accent);
  return gradient;
}

/** Canvas : 0 rad à 3 h, sens horaire ; les arcs traversent un dégradé conique fixe. */
function drawRingFrame(context: CanvasRenderingContext2D, elapsedMs: number, isReducedMotion: boolean): void {
  const { center, radius, strokeWidth, viewBox } = RING;
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  context.save();
  context.scale(CANVAS_SIZE / viewBox, CANVAS_SIZE / viewBox);

  context.strokeStyle = brandConicGradient(context);
  context.lineWidth = strokeWidth;
  context.lineCap = "round";
  context.globalAlpha = isReducedMotion ? pulseOpacity(elapsedMs) : 1;

  const halfDash = (OPEN_DASH_DEGREES / 2) * (Math.PI / 180);
  RING_ARCS.forEach((arc) => {
    const offset = isReducedMotion ? 0 : spinOffsetAt(arc, elapsedMs);
    const middle = ((arc.homeRotation + offset) * Math.PI) / 180;
    context.beginPath();
    context.arc(center, center, radius, middle - halfDash, middle + halfDash);
    context.stroke();
  });

  context.restore();
}
