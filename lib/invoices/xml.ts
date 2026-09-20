import { XMLParser } from "fast-xml-parser";

/**
 * Lecture XML partagée par les deux syntaxes de la norme européenne EN 16931 : CII (celle du
 * Factur-X franco-allemand) et UBL (celle de la plupart des autres pays de l'Union, dont le
 * e-Factura roumain). Les deux décrivent la même facture avec des balises différentes ; seul le
 * chemin des données change, pas la façon de les lire.
 */

export type XmlNode = { [key: string]: unknown };

export const xmlParser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  maxNestedTags: 64,
});

export const isNode = (value: unknown): value is XmlNode =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Un élément répété (plusieurs conditions de paiement…) arrive en tableau : on garde le premier. */
export function child(node: unknown, ...path: string[]): unknown {
  let current: unknown = node;
  for (const key of path) {
    const value = isNode(current) ? current[key] : undefined;
    current = Array.isArray(value) ? value[0] : value;
  }
  return current;
}

export function all(node: unknown, key: string): unknown[] {
  const value = isNode(node) ? node[key] : undefined;
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function text(node: unknown): string | null {
  const value = isNode(node) ? node["#text"] : node;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export const attribute = (node: unknown, name: string) => (isNode(node) ? text(node[`@_${name}`]) : null);

export function amount(node: unknown): number | null {
  const raw = text(node);
  if (raw === null || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
  return Math.round(Number(raw) * 100) / 100;
}

/** Une facture électronique n'a jamais de DOCTYPE : le refuser écarte l'expansion d'entités. */
export const hasDoctype = (xml: string) => /<!DOCTYPE/i.test(xml);
