/** Messages français pour les codes d'erreur de Supabase Auth. */
const MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed: "Confirmez d'abord votre adresse e-mail : nous vous avons envoyé un lien.",
  weak_password: "Mot de passe trop faible : choisissez-en un plus long ou moins courant.",
  same_password: "Choisissez un mot de passe différent de l'actuel.",
  over_email_send_rate_limit: "Trop de tentatives. Réessayez dans quelques minutes.",
  over_request_rate_limit: "Trop de tentatives. Réessayez dans quelques minutes.",
  signup_disabled: "Les inscriptions sont momentanément fermées.",
  otp_expired: "Ce lien a expiré. Demandez-en un nouveau.",
};

const FALLBACK = "Une erreur est survenue. Réessayez dans un instant.";

export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK;
}
