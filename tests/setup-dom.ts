import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "motion";
import { afterEach, beforeEach, vi } from "vitest";
import { stubReducedMotion } from "./helpers/media";

// Les animations Framer Motion se terminent immédiatement : on teste l'état, pas le mouvement.
MotionGlobalConfig.skipAnimations = true;

// jsdom n'implémente pas <dialog> modal : ouverture/fermeture minimales et événement « close ».
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

beforeEach(() => {
  stubReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
