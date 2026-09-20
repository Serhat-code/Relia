import { describe, expect, it } from "vitest";
import { MAX_TOASTS, autoDismissDelay, toastReducer, type Toast } from "./toast-store";

const toast = (id: string, tone: Toast["tone"] = "info"): Toast => ({ id, tone, title: `Titre ${id}` });

describe("toastReducer", () => {
  it("ajoute une notification à la fin", () => {
    const state = toastReducer([toast("a")], { type: "add", toast: toast("b") });

    expect(state.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it(`garde au plus ${MAX_TOASTS} notifications, les plus récentes`, () => {
    const initial = ["a", "b", "c", "d"].map((id) => toast(id));

    const state = toastReducer(initial, { type: "add", toast: toast("e") });

    expect(state.map((item) => item.id)).toEqual(["b", "c", "d", "e"]);
  });

  it("met à jour une notification sans modifier l'état précédent", () => {
    const initial = [toast("a", "loading")];

    const state = toastReducer(initial, { type: "update", id: "a", patch: { tone: "success", title: "Envoyée" } });

    expect(state[0]).toEqual({ id: "a", tone: "success", title: "Envoyée" });
    expect(initial[0]?.tone).toBe("loading");
  });

  it("retire une notification", () => {
    const state = toastReducer([toast("a"), toast("b")], { type: "dismiss", id: "a" });

    expect(state.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("autoDismissDelay", () => {
  it("un chargement ne se ferme jamais seul", () => {
    expect(autoDismissDelay("loading")).toBeNull();
  });

  it("une erreur reste plus longtemps qu'une information", () => {
    expect(autoDismissDelay("error")).toBeGreaterThan(autoDismissDelay("info") ?? Infinity);
  });
});
