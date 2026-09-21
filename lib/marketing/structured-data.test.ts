import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/billing/plans";
import { LANDING_FAQ } from "./content";
import { faqJsonLd, landingJsonLd, pricingJsonLd, softwareJsonLd } from "./structured-data";

const SITE = "https://relia-pi.vercel.app/";

describe("données structurées", () => {
  it("annonce exactement les prix de la page tarifs", () => {
    const offers = softwareJsonLd(SITE).offers as Array<{ name: string; price: number; priceCurrency: string }>;

    expect(offers.map((offer) => [offer.name, offer.price])).toEqual(PLANS.map((plan) => [plan.name, plan.monthlyPrice]));
    expect(offers.every((offer) => offer.priceCurrency === "EUR")).toBe(true);
  });

  it("déclare des prix hors taxes, comme la page", () => {
    const offers = softwareJsonLd(SITE).offers as Array<{ priceSpecification: { valueAddedTaxIncluded: boolean } }>;

    expect(offers.every((offer) => offer.priceSpecification.valueAddedTaxIncluded === false)).toBe(true);
  });

  it("reprend toutes les questions fréquentes, sans en inventer", () => {
    const questions = (faqJsonLd(SITE).mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>);

    expect(questions.map((item) => item.name)).toEqual(LANDING_FAQ.map((item) => item.question));
    expect(questions.map((item) => item.acceptedAnswer.text)).toEqual(LANDING_FAQ.map((item) => item.answer));
  });

  it("normalise l'URL du site : jamais de double barre oblique", () => {
    const graph = landingJsonLd(SITE)["@graph"] as Array<{ "@id": string }>;

    expect(graph.every((node) => !node["@id"].includes("//#"))).toBe(true);
    expect(graph[0]?.["@id"]).toBe("https://relia-pi.vercel.app/#organisation");
  });

  it("l'éditeur n'est annoncé que s'il est renseigné (mentions légales à compléter)", () => {
    const organization = (landingJsonLd(SITE)["@graph"] as Array<Record<string, unknown>>)[0]!;

    // Tant que publisher.ts n'est pas rempli, aucun champ vide ne part dans le balisage.
    expect(Object.values(organization).every((value) => value !== null && value !== "")).toBe(true);
  });

  it("la page tarifs porte les offres, pas les questions de l'accueil", () => {
    const types = (pricingJsonLd(SITE)["@graph"] as Array<{ "@type": string }>).map((node) => node["@type"]);

    expect(types).toEqual(["Organization", "SoftwareApplication"]);
  });
});
