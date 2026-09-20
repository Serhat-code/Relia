import { Section } from "./Section";

type ColorToken = {
  variable: string;
  utility: string;
  role: string;
};

const COLOR_GROUPS: ReadonlyArray<{ title: string; tokens: ReadonlyArray<ColorToken> }> = [
  {
    title: "Fonds et surfaces",
    tokens: [
      { variable: "--bg", utility: "bg-canvas", role: "Fond de page" },
      { variable: "--bg-elevated", utility: "bg-elevated", role: "Cartes, barre latérale" },
      { variable: "--surface", utility: "bg-surface", role: "Champs, survol de ligne" },
      { variable: "--border", utility: "border-border", role: "Bordures" },
      { variable: "--border-glow", utility: "border-glow", role: "Halo de bordure" },
    ],
  },
  {
    title: "Accents",
    tokens: [
      { variable: "--accent", utility: "bg-accent", role: "Actions principales" },
      { variable: "--accent-hover", utility: "bg-accent-hover", role: "Survol des actions" },
      { variable: "--accent-soft", utility: "bg-accent-soft", role: "Fond d'élément actif" },
      { variable: "--accent-text", utility: "text-link", role: "Liens (texte lisible)" },
      { variable: "--secondary", utility: "bg-secondary", role: "Dégradés, décor" },
    ],
  },
  {
    title: "États",
    tokens: [
      { variable: "--success", utility: "text-success", role: "Payée, envoi réussi" },
      { variable: "--warning", utility: "text-warning", role: "Promesse, échéance proche" },
      { variable: "--danger", utility: "text-danger", role: "En retard, échec" },
    ],
  },
  {
    title: "Texte",
    tokens: [
      { variable: "--text", utility: "text-fg", role: "Texte principal" },
      { variable: "--text-muted", utility: "text-fg-muted", role: "Texte secondaire" },
      { variable: "--text-subtle", utility: "text-fg-subtle", role: "Métadonnées" },
    ],
  },
];

const GRADIENTS = [
  { variable: "--gradient-brand", utility: "bg-gradient-brand / text-gradient-brand", role: "Marque, anneau du logo" },
  { variable: "--gradient-glow", utility: "bg-gradient-glow", role: "Halo d'arrière-plan" },
] as const;

function TokenLabel({ variable, utility, role }: ColorToken) {
  return (
    <div className="flex flex-col gap-0.5">
      <code className="font-mono text-xs text-fg">{variable}</code>
      <span className="text-xs text-fg-muted">{role}</span>
      <code className="font-mono text-xs text-fg-muted">{utility}</code>
    </div>
  );
}

export function ColorTokens() {
  return (
    <Section
      title="Couleurs"
      description="Esprit fintech française : bleu nuit profond, accent électrique, contraste fort. Basculez le thème pour vérifier la version claire."
    >
      <div className="flex flex-col gap-10">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-4">
            <h3 className="text-sm font-medium text-fg-muted">{group.title}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {group.tokens.map((token) => (
                <div key={token.variable} className="flex flex-col gap-3">
                  <div
                    className="h-16 rounded-xl border border-border"
                    style={{ background: `var(${token.variable})` }}
                  />
                  <TokenLabel {...token} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-fg-muted">Dégradés</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GRADIENTS.map((gradient) => (
              <div key={gradient.variable} className="flex flex-col gap-3">
                <div
                  className="h-24 rounded-xl border border-border bg-elevated"
                  style={{ backgroundImage: `var(${gradient.variable})` }}
                />
                <TokenLabel {...gradient} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
