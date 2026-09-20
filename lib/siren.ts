/** Retire espaces et points d'une saisie de SIREN (« 123 456 782 », « 123.456.782 »). */
export function normalizeSiren(value: string): string {
  return value.replace(/[\s.]/g, "");
}

/**
 * SIREN valide : 9 chiffres dont le dernier est une clé de Luhn (un chiffre sur deux doublé
 * en partant de la droite, somme multiple de 10).
 */
export function isValidSiren(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const sum = [...value].reduce((total, character, index) => {
    const digit = Number(character);
    if (index % 2 === 0) return total + digit;
    const doubled = digit * 2;
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return sum % 10 === 0;
}

/** Affichage usuel du SIREN, par groupes de trois chiffres : « 123 456 782 ». */
export function formatSiren(siren: string): string {
  return /^\d{9}$/.test(siren) ? siren.replace(/(\d{3})(?=\d)/g, "$1 ") : siren;
}
