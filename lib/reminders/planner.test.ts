import { describe, expect, it } from "vitest";
import { nextBusinessDay, nextReminder, parisTimeToUtc, stepDate, type PlannerStep } from "./planner";

const STEPS: PlannerStep[] = [
  { id: "s1", position: 1, offsetDays: -3, tone: "courtois" },
  { id: "s2", position: 2, offsetDays: 7, tone: "courtois" },
  { id: "s3", position: 3, offsetDays: 15, tone: "ferme" },
  { id: "s4", position: 4, offsetDays: 30, tone: "mise_en_demeure" },
];

const invoice = (dueAt: string, status: "pending" | "late" | "promised" | "paid" = "late") => ({ dueAt, status });

describe("dates de relance", () => {
  it("place l'étape par rapport à l'échéance", () => {
    expect(stepDate("2026-09-30", -3)).toBe("2026-09-27");
    expect(stepDate("2026-09-30", 15)).toBe("2026-10-15");
  });

  it("repousse un samedi ou un dimanche au lundi", () => {
    expect(nextBusinessDay("2026-09-19")).toBe("2026-09-21"); // samedi
    expect(nextBusinessDay("2026-09-20")).toBe("2026-09-21"); // dimanche
    expect(nextBusinessDay("2026-09-22")).toBe("2026-09-22"); // mardi
  });

  it("convertit 9 h 30 à Paris en UTC, heure d'été comme d'hiver", () => {
    expect(parisTimeToUtc("2026-09-21", 9, 30)).toBe("2026-09-21T07:30:00.000Z");
    expect(parisTimeToUtc("2026-12-01", 9, 30)).toBe("2026-12-01T08:30:00.000Z");
  });
});

describe("nextReminder", () => {
  it("rien avant la date de la première étape", () => {
    expect(nextReminder(invoice("2026-10-10", "pending"), STEPS, [], "2026-09-22")).toBeNull();
  });

  it("première étape dès sa date, envoyée le jour ouvré suivant", () => {
    expect(nextReminder(invoice("2026-09-30", "pending"), STEPS, [], "2026-09-27")).toEqual({
      step: STEPS[0],
      sendOn: "2026-09-28",
    });
  });

  it("une facture importée très en retard commence par le rappel courtois, pas par la mise en demeure", () => {
    expect(nextReminder(invoice("2026-07-01"), STEPS, [], "2026-09-22")?.step.id).toBe("s1");
  });

  it("progresse d'une étape à la fois, avec cinq jours au moins entre deux envois", () => {
    const sent = [{ stepId: "s1", status: "sent" as const, sentAt: "2026-09-18T07:30:00Z" }];

    expect(nextReminder(invoice("2026-07-01"), STEPS, sent, "2026-09-22")).toBeNull();
    expect(nextReminder(invoice("2026-07-01"), STEPS, sent, "2026-09-23")?.step.id).toBe("s2");
  });

  it("n'en prépare pas une nouvelle tant qu'une relance attend (validation ou envoi)", () => {
    const waiting = [{ stepId: "s1", status: "awaiting_approval" as const, sentAt: null }];

    expect(nextReminder(invoice("2026-07-01"), STEPS, waiting, "2026-09-22")).toBeNull();
  });

  it("reprend une étape dont l'envoi a échoué", () => {
    const failed = [{ stepId: "s1", status: "failed" as const, sentAt: null }];

    expect(nextReminder(invoice("2026-07-01"), STEPS, failed, "2026-09-22")?.step.id).toBe("s1");
  });

  it("ne relance ni une facture réglée, ni une promesse en cours", () => {
    expect(nextReminder(invoice("2026-07-01", "paid"), STEPS, [], "2026-09-22")).toBeNull();
    expect(nextReminder(invoice("2026-07-01", "promised"), STEPS, [], "2026-09-22")).toBeNull();
  });

  it("toutes les étapes envoyées : plus rien", () => {
    const allSent = STEPS.map((step, index) => ({
      stepId: step.id,
      status: "sent" as const,
      sentAt: `2026-08-${String(index + 1).padStart(2, "0")}T07:30:00Z`,
    }));

    expect(nextReminder(invoice("2026-07-01"), STEPS, allSent, "2026-09-22")).toBeNull();
  });
});
