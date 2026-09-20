/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireFaviconAnimation } from "./favicon-animation";

const FRAME = "data:image/png;base64,FRAME";

function fakeContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    clearRect: noop,
    save: noop,
    restore: noop,
    scale: noop,
    beginPath: noop,
    arc: noop,
    stroke: noop,
    createConicGradient: () => ({ addColorStop: noop }),
  } as unknown as CanvasRenderingContext2D;
}

function addIconLink(): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = "/icon";
  document.head.append(link);
  return link;
}

describe("acquireFaviconAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fakeContext() as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(FRAME);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.head.innerHTML = "";
  });

  it("remplace le favicon par l'image animée, puis le restaure", () => {
    const link = addIconLink();

    const release = acquireFaviconAnimation(false);
    expect(link.getAttribute("href")).toBe(FRAME);
    expect(link.type).toBe("image/png");

    release();
    expect(link.getAttribute("href")).toBe("/icon");
    expect(link.type).toBe("image/svg+xml");
  });

  it("reste animé tant qu'un loader le demande encore", () => {
    const link = addIconLink();

    const releaseFirst = acquireFaviconAnimation(false);
    const releaseSecond = acquireFaviconAnimation(false);
    releaseFirst();
    expect(link.getAttribute("href")).toBe(FRAME);

    releaseSecond();
    expect(link.getAttribute("href")).toBe("/icon");
  });

  it("une double libération ne restaure pas le favicon d'un autre loader", () => {
    const link = addIconLink();

    const releaseFirst = acquireFaviconAnimation(false);
    const releaseSecond = acquireFaviconAnimation(false);
    releaseFirst();
    releaseFirst();
    expect(link.getAttribute("href")).toBe(FRAME);

    releaseSecond();
  });

  it("ne fait rien sans favicon ni canvas disponible", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const link = addIconLink();

    const release = acquireFaviconAnimation(false);
    expect(link.getAttribute("href")).toBe("/icon");
    release();
  });
});
