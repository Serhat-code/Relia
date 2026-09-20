# Prompt Claude Code — Relia

> Colle ce fichier à la racine de ton projet vide, puis lance Claude Code et dis :
> « Lis RELIA-PROMPT-CLAUDE-CODE.md et construis le projet en suivant l'ordre de la section 10. »
> Garde-le ensuite comme CLAUDE.md du repo : c'est la référence permanente du projet.

---

## 1. Mission

Construire **Relia**, un SaaS français de **relance automatisée des factures impayées**, destiné aux TPE, PME, freelances et agences.

Le problème : un dirigeant de TPE déteste relancer ses clients, c'est gênant et chronophage. Relia automatise cette gêne. Les factures partent à 30 jours, sont payées à 60, et personne ne relance.

Positionnement : **outil en libre-service**, tarifs 29–79 €/mois, inscription sans rendez-vous commercial, prise en main en moins de 10 minutes.

---

## 2. Contraintes juridiques — NON NÉGOCIABLES

Ces règles conditionnent l'architecture. Elles ne se rajoutent pas après coup. Si une décision technique les contredit, **arrête-toi et signale-le** plutôt que de contourner.

### 2.1 Relia est un outil, jamais une agence de recouvrement

Le recouvrement amiable **pour le compte d'autrui** est une activité réglementée en France (décret n° 96-1112) : déclaration au procureur, RC pro, compte bancaire dédié. Relia doit rester hors de ce champ.

Conséquences techniques strictes :

- Les e-mails de relance partent **de la boîte du client**, via OAuth Google (Gmail API) ou Microsoft (Graph API). Jamais depuis un domaine Relia.
- Un **mode SMTP personnalisé** est proposé en repli, avec les identifiants du client.
- L'expéditeur, le `From`, le `Reply-To` et la signature sont toujours ceux du client.
- **Relia n'encaisse jamais un paiement à la place de son client.** Pas de compte de cantonnement, pas de lien de paiement hébergé par Relia, pas d'agrégation de fonds. Stripe ne sert qu'à encaisser l'abonnement Relia lui-même.
- Aucune occurrence des mots « recouvrement », « recouvrement de créances » ou « agence » dans l'UI, le marketing ou les e-mails transactionnels. Vocabulaire imposé : **relance**, **suivi des règlements**, **encaissement**.
- Ajoute un test automatisé qui échoue si ces termes interdits apparaissent dans `/app`, `/components` ou `/emails`.

> **Exception validée le 18/09/2026** : « agences » au pluriel est autorisé pour désigner la clientèle
> cible (« TPE, PME, freelances et agences »). Le singulier « agence » reste interdit.

### 2.2 RGPD — Relia est sous-traitant, pas responsable de traitement

Relia traite des données personnelles de tiers (les débiteurs de ses clients). Le client est responsable de traitement.

- **Supabase en région UE obligatoire** (`eu-west-3` Paris ou `eu-central-1` Francfort). Le choix est irréversible après création du projet : à faire en premier.
- **Vercel : forcer la région `cdg1`** dans `vercel.json`, y compris pour les fonctions serverless et les crons. Aucune exécution hors UE.
- **DPA article 28** présenté et accepté à l'inscription, avec horodatage, version et adresse IP stockés en base.
- Page publique `/sous-traitants` listant tous les sous-traitants ultérieurs (Supabase, Vercel, Stripe, Mistral, Resend).
- Durées de conservation configurables par client, valeur par défaut 3 ans après la clôture d'une facture. Purge automatique via cron.
- Endpoint d'export et de suppression des données d'un débiteur, pour que le client puisse honorer une demande d'accès ou d'effacement.
- Journal d'audit immuable : chaque action automatique est tracée (qui, quoi, quand, sur quelle facture).

### 2.3 IA — modèle hébergé en UE

- **Mistral** (`mistral-large-latest`) pour la rédaction des relances. Pas d'OpenAI ni d'Anthropic en production : les données des débiteurs ne doivent pas quitter l'UE.
- Abstraire derrière une interface `LLMProvider` pour pouvoir changer de fournisseur.
- Mention « Message assisté par IA » visible dans l'interface de prévisualisation (obligation de transparence de l'AI Act).
- **Toute relance générée par IA passe par une validation humaine avant le premier envoi à un débiteur donné.** Ensuite seulement, l'envoi automatique peut être activé par le client.

### 2.4 Pas de scoring de personnes physiques

Le scoring de solvabilité de personnes physiques relève des systèmes à haut risque de l'AI Act (annexe III).

- Le score de risque de retard ne se calcule **que sur des personnes morales** (débiteur avec un SIREN renseigné).
- Si le débiteur est un particulier ou une entreprise individuelle sans SIREN, le champ `risk_score` reste `null` et l'UI affiche « Non applicable ».
- Contrainte à faire respecter en base (`CHECK`) et dans la couche métier, pas seulement dans l'UI.

### 2.5 Deux jeux de modèles distincts : B2B et B2C

L'indemnité forfaitaire de 40 € et les intérêts de retard majorés relèvent du Code de commerce, **transactions entre professionnels uniquement**.

- Champ `client_type` (`b2b` / `b2c`) obligatoire sur chaque débiteur, demandé à l'import.
- Les modèles B2B peuvent mentionner l'indemnité forfaitaire de 40 € et les intérêts au taux BCE majoré de 10 points.
- Les modèles B2C ne les mentionnent **jamais**. Délais plus longs, ton plus mesuré.
- Le moteur de modèles refuse de rendre un modèle B2B pour un débiteur B2C. Test unitaire dédié.

### 2.6 Aucune menace dans les modèles

Interdits dans tous les modèles, quel qu'en soit le niveau : saisie, huissier, commissaire de justice, procédure judiciaire, injonction de payer, fichage, mise en recouvrement. Le client ne peut pas mettre ces actions à exécution, et menacer d'une action qu'on ne peut pas engager est une pratique prohibée.

Le niveau le plus ferme autorisé est une **mise en demeure factuelle** : montant, échéance dépassée, délai de règlement demandé, et le simple fait que le dossier pourra être confié à un tiers si aucun règlement n'intervient. Pas de date, pas de nom de tiers, pas de menace chiffrée.

Ajoute une liste noire de termes vérifiée par test automatisé sur tous les modèles.

---

## 3. Stack technique

- **Next.js 15**, App Router, TypeScript strict
- **Supabase** : PostgreSQL, Auth, Row Level Security, Storage — région UE
- **Stripe** : abonnement Relia uniquement, Checkout + portail client + webhooks
- **Tailwind CSS v4** + composants faits maison (pas de librairie de composants imposant son style)
- **Framer Motion** pour les animations
- **Resend** pour les e-mails transactionnels Relia (bienvenue, facturation) — **jamais** pour les relances aux débiteurs
- **Mistral** pour la génération de texte
- **Zod** pour la validation, **Vitest** pour les tests
- Déploiement Vercel, région `cdg1`

---

## 4. Schéma de base de données

Toutes les tables portent `organization_id`. RLS activée partout, sans exception. Un utilisateur n'accède qu'aux lignes de son organisation.

```
organizations
  id, name, siren, plan, stripe_customer_id, stripe_subscription_id,
  dpa_accepted_at, dpa_version, dpa_ip, retention_months (défaut 36),
  created_at

users
  id (= auth.users.id), organization_id, email, full_name, role, created_at

email_accounts            -- boîte d'envoi du client, jamais celle de Relia
  id, organization_id, provider (gmail|outlook|smtp),
  email_address, display_name,
  oauth_access_token (chiffré), oauth_refresh_token (chiffré), oauth_expires_at,
  smtp_host, smtp_port, smtp_user, smtp_password (chiffré),
  status, last_verified_at

debtors
  id, organization_id, name, siren, client_type (b2b|b2c),
  contact_email, contact_name, phone, address,
  risk_score (null si client_type='b2c' ou siren null),
  payment_behavior_days, notes, created_at
  CHECK (client_type = 'b2b' AND siren IS NOT NULL) OR risk_score IS NULL

invoices
  id, organization_id, debtor_id,
  number, amount_ht, amount_ttc, currency,
  issued_at, due_at, paid_at, status (pending|late|promised|paid|disputed|cancelled),
  source (manual|csv|pennylane|qonto|stripe|facturx),
  external_id, factur_x_raw (jsonb), created_at

reminder_sequences        -- scénarios de relance
  id, organization_id, name, client_type (b2b|b2c), is_default, created_at

reminder_steps
  id, sequence_id, position, offset_days,   -- négatif = avant échéance
  tone (courtois|ferme|mise_en_demeure),
  template_id, channel (email), created_at

templates
  id, organization_id (null = modèle système), name,
  client_type (b2b|b2c), tone, subject, body_markdown,
  variables (jsonb), is_system, created_at

reminders                 -- relances planifiées ou envoyées
  id, organization_id, invoice_id, step_id,
  scheduled_at, sent_at, status (scheduled|awaiting_approval|sent|cancelled|failed),
  subject, body, ai_generated, approved_by, approved_at,
  provider_message_id, error, created_at

promises                  -- promesses de paiement détectées
  id, organization_id, invoice_id, promised_amount, promised_date,
  source (email_reply|manual), confidence, kept, created_at

audit_logs                -- immuable, insertion seule
  id, organization_id, actor_type (user|system|ai), actor_id,
  action, entity_type, entity_id, payload (jsonb), created_at

integrations
  id, organization_id, provider (pennylane|qonto|stripe|sellsy),
  credentials (chiffré), status, last_sync_at, created_at
```

---

## 5. Fonctionnalités du MVP

### Dans le périmètre

1. **Inscription et onboarding** : création de compte, acceptation du DPA, connexion de la boîte e-mail, premier import de factures. Moins de 10 minutes.
2. **Import de factures** : CSV avec assistant de correspondance des colonnes, saisie manuelle, et lecture de **Factur-X** (PDF avec XML embarqué). La facturation électronique étant obligatoire en réception depuis le 1er septembre 2026, les factures structurées se généralisent — c'est un atout à exploiter dès le MVP.
3. **Scénarios de relance** : un scénario B2B et un scénario B2C fournis par défaut, modifiables. Étapes déclenchées en jours relatifs à l'échéance.
4. **Rédaction assistée par IA** : génération du texte à partir du contexte facture et débiteur, ton choisi par l'étape, validation humaine obligatoire avant le premier envoi à un débiteur.
5. **Envoi délégué** : par la boîte du client, avec suivi du statut.
6. **Détection des réponses** : lecture des réponses entrantes, extraction des promesses de paiement (montant + date), suspension automatique de la séquence en cas de réponse ou de litige.
7. **Tableau de bord** : encours total, montant en retard, DSO, factures à risque, activité du jour.
8. **Journal d'audit** consultable par le client.
9. **Abonnement Stripe** : trois offres, essai gratuit de 14 jours sans carte.

### Hors périmètre — ne le construis pas

- Encaissement de paiements pour le compte des clients
- Envoi depuis un domaine Relia
- Statut de plateforme agréée (agrément, audits, charge disproportionnée) — on se branche dessus, on ne le devient pas
- Relances par SMS ou téléphone au MVP
- Application mobile
- Scoring de personnes physiques

---

## 6. Identité visuelle

### Nom et logo

**Relia.** Le logo est un **anneau segmenté en quatre arcs**, chacun représentant une étape du cycle : facture émise → relance envoyée → promesse obtenue → encaissement.

- Arcs de 76° séparés par des espaces de 14°, épaisseur de trait 8 sur une viewBox 48×48, extrémités arrondies.
- Les quatre arcs portent un dégradé allant de l'accent primaire à l'accent secondaire, dans le sens horaire.
- Le quatrième arc (encaissement) est le seul plein quand l'état est « payé ».

**Animation de chargement** — c'est la signature visuelle du produit, elle doit être soignée :

1. Les arcs tournent autour du centre, chacun à une vitesse légèrement différente (1,2 s / 1,6 s / 2 s / 2,4 s), en sens alternés.
2. Le dégradé se déplace le long des arcs pendant la rotation.
3. À la fin du chargement, les arcs convergent, les espaces se referment et l'anneau devient un cercle plein, avec une légère surimpulsion d'échelle (1 → 1,08 → 1).
4. Puis une onde lumineuse se diffuse une fois vers l'extérieur avant disparition.

Composant `<ReliaLoader size="sm|md|lg" state="loading|success" />`, utilisé partout : chargement de page, import en cours, envoi de relance, synchronisation. Une version réduite sert de favicon animé et de spinner de bouton.

Respecte `prefers-reduced-motion` : dans ce cas, opacité pulsée douce uniquement, pas de rotation.

### Palette

Esprit fintech française : bleu nuit profond, accent électrique, contraste fort, beaucoup d'espace. Rendu futuriste mais **lisible** — c'est un outil financier, pas une démo technique.

```css
/* Sombre — thème par défaut de l'application */
--bg:            #070B14;
--bg-elevated:   #0E1526;
--surface:       #16203A;
--border:        #243250;
--border-glow:   #2F6BFF33;

--accent:        #2F6BFF;   /* bleu électrique — actions principales */
--accent-hover:  #4B82FF;
--accent-soft:   #2F6BFF1A;
--secondary:     #00E5C2;   /* cyan — accents, dégradés, succès actif */

--success:       #22D18C;
--warning:       #FFB020;
--danger:        #FF4D6A;

--text:          #E8EEF9;
--text-muted:    #8A9BB8;
--text-subtle:   #5A6B88;

--gradient-brand: linear-gradient(135deg, #2F6BFF 0%, #00E5C2 100%);
--gradient-glow:  radial-gradient(circle at 50% 0%, #2F6BFF26 0%, transparent 70%);
```

Prévoir aussi un thème clair complet (`#FAFBFD` en fond, mêmes accents), commutable. Les comptables travaillent souvent en clair.

### Typographie

- Interface : **Inter** (variable), interlignage serré sur les titres
- Titres et chiffres marquants : **Space Grotesk**
- Tous les montants et dates en **chiffres tabulaires** (`font-variant-numeric: tabular-nums`) — obligatoire, sinon les colonnes dansent
- Échelle : 12 / 14 / 16 / 20 / 28 / 40 / 56

### Animations et micro-interactions

Courbe standard : `cubic-bezier(0.22, 1, 0.36, 1)`. Durées 180–320 ms. Rien au-delà de 400 ms sauf le loader.

- **Transitions de page** : fondu + translation verticale de 8 px, en cascade sur les blocs (décalage de 40 ms)
- **Lignes de tableau** : apparition en cascade à l'arrivée, halo de bordure au survol
- **Cartes de statistiques** : compteurs animés au montage, léger dégradé qui se déplace en fond
- **Boutons** : halo qui s'intensifie au survol, enfoncement à 0,97 au clic, loader intégré pendant l'action
- **Chargement** : squelettes avec effet de balayage, pas de spinners nus
- **Statuts de facture** : pastilles colorées avec pulsation douce sur « en retard »
- **Barre latérale** : indicateur actif qui glisse d'un élément à l'autre (`layoutId` Framer Motion)
- **Toasts** : entrée par la droite avec rebond léger
- **Fond** : léger dégradé radial animé en haut de page, très lent (20 s), presque imperceptible
- **Succès d'envoi** : le loader passe en état `success`, anneau plein, onde lumineuse

Aucune animation ne doit retarder une interaction. Tout reste interruptible.

---

## 7. Structure des pages

```
/                        landing (public)
/tarifs                  offres
/sous-traitants          liste RGPD des sous-traitants (public)
/mentions-legales /cgu /confidentialite
/inscription /connexion
/app                     tableau de bord
/app/factures            liste + filtres + import
/app/factures/[id]       détail : historique, relances, promesses
/app/debiteurs           liste
/app/debiteurs/[id]      fiche : factures, comportement de paiement
/app/scenarios           scénarios de relance
/app/scenarios/[id]      éditeur d'étapes
/app/modeles             bibliothèque de modèles (B2B / B2C séparés)
/app/boite-mail          connexion et état de la boîte d'envoi
/app/journal             journal d'audit
/app/parametres          organisation, équipe, conservation, abonnement
```

---

## 8. Règles de code

- TypeScript strict, aucun `any`
- Server Components par défaut, `"use client"` seulement si nécessaire
- Server Actions pour les mutations, validation Zod systématique en entrée
- Aucune requête Supabase dans un composant client : tout passe par une couche `lib/data/`
- RLS activée sur **toutes** les tables, avec un test qui vérifie qu'aucune table n'en est dépourvue
- Secrets chiffrés en base via `pgsodium`, jamais en clair
- Tous les textes d'interface en français, sans anglicismes inutiles
- Tests Vitest obligatoires sur : moteur de modèles, séparation B2B/B2C, liste noire de termes, calcul des dates de relance, règle de scoring

---

## 9. Crons Vercel (région cdg1)

- `0 7 * * *` — calcul des relances du jour et mise en file
- `*/15 * * * *` — envoi des relances dues, via la boîte du client
- `*/30 * * * *` — lecture des réponses entrantes, détection des promesses
- `0 3 * * *` — synchronisation des intégrations
- `0 4 * * 0` — purge des données au-delà de la durée de conservation

---

## 10. Ordre de construction

Construis dans cet ordre, en t'arrêtant à chaque palier pour que je puisse vérifier.

1. Initialisation du projet, Tailwind v4, jetons de design, thèmes clair et sombre
2. **Composant `ReliaLoader`** avec ses états et son animation, plus une page de démonstration des variantes
3. Bibliothèque de composants : bouton, carte, tableau, badge, champ, modale, toast, squelette
4. Schéma Supabase complet, RLS, migrations, jeu de données de test
5. Authentification, inscription, acceptation du DPA, onboarding
6. Factures : import CSV, saisie manuelle, lecture Factur-X, liste, détail
7. Débiteurs : liste, fiche, séparation B2B/B2C, règle de scoring
8. Modèles et scénarios : modèles système B2B et B2C, éditeur d'étapes, tests de la liste noire
9. Connexion de la boîte e-mail : OAuth Gmail et Outlook, repli SMTP
10. Moteur de relance : planification, génération IA, validation humaine, envoi
11. Réponses entrantes et détection des promesses
12. Tableau de bord et journal d'audit
13. Stripe : offres, Checkout, portail, webhooks
14. Landing page et pages légales
15. Crons, purge, durcissement, tests de bout en bout

---

## 11. Rappels permanents

- Relia est un **outil**, pas un prestataire de recouvrement. À chaque décision, demande-toi si elle fait franchir cette ligne.
- Aucune donnée personnelle ne sort de l'UE.
- Aucun modèle ne menace.
- Aucun scoring de personne physique.
- Le loader est la signature de la marque : il mérite plus de soin que n'importe quel autre composant.

---

## 12. Avancement et décisions techniques

Section tenue à jour par Claude Code à chaque palier.

### Paliers

- [x] **1. Initialisation, Tailwind v4, jetons de design, thèmes** — validé le 18/09/2026
- [x] **2. `ReliaLoader`** — validé le 18/09/2026
- [x] **3. Bibliothèque de composants** — validé le 18/09/2026
- [x] **4. Schéma Supabase, RLS, migrations, données de test** — validé en PGlite ; reste à valider sur un vrai Supabase (Docker)
- [x] **5. Authentification, inscription, DPA, onboarding** — sans Supabase réel : parcours complet à tester dès qu'un projet existe
- [x] **6. Factures : import CSV, saisie, Factur-X, liste, détail** — rendu vérifié sur `/design/factures` ;
  parcours réel à tester avec un projet Supabase
- [x] **7. Débiteurs : liste, fiche, B2B/B2C, règle de scoring, export et effacement RGPD** — rendu vérifié sur
  `/design/debiteurs` ; parcours réel à tester avec un projet Supabase
- [x] **8. Modèles et scénarios : modèles système B2B/B2C, éditeur d'étapes, liste noire** — rendu vérifié sur
  `/design/modeles` ; parcours réel à tester avec un projet Supabase
- [x] **9. Boîte d'envoi : OAuth Gmail et Outlook, repli SMTP** — rendu vérifié sur `/design/boite-mail` ; connexions
  réelles à tester avec un projet Supabase et les applications OAuth Google / Microsoft
- [x] **10. Moteur de relance : planification, rédaction IA, validation humaine, envoi** — rendu vérifié sur
  `/design/relances` ; parcours réel à tester avec un projet Supabase, une boîte connectée et une clé Mistral
- [x] **11. Réponses entrantes et promesses de règlement** — rendu vérifié sur `/design/reponses` ; lecture réelle
  à tester avec une boîte connectée (Gmail, Outlook ou IMAP)
- [x] **12. Tableau de bord et journal d'audit** — rendu vérifié sur `/design/tableau-de-bord` et `/design/journal`
- [x] **13. Abonnement Stripe : offres, Checkout, portail, webhooks** — rendu vérifié sur `/design/parametres` ;
  paiement réel à tester avec un compte Stripe (mode test) et ses prix
- [x] **14. Page d'accueil et pages légales** — rendu vérifié sur `/`, `/tarifs` et les pages légales ; textes
  juridiques et informations de l'éditeur **à compléter et faire valider par un juriste**
- [x] **15. Crons, purge, durcissement, tests de bout en bout** — 33 tests Playwright verts (bureau et mobile) ;
  crons à activer avec Vercel Pro et `CRON_SECRET`

### Commandes

- `npm run dev` — serveur de développement (Turbopack), sortie dans `.next-dev`
- `npm run check` — types + lint + tests (à lancer avant chaque fin de palier)
- `npm run build` — build de production (webpack ; le build Turbopack de Next 15 est encore en bêta)
- `/design` — page interne des jetons de design (404 sur le déploiement de production Vercel)
- `/design/loader` — démonstration du `ReliaLoader` et du logo (même règle)
- `/design/composants` — démonstration de la bibliothèque de composants (même règle)
- Tests : projet Vitest « logique » (`*.test.ts`, Node) et « composants » (`*.test.tsx`, jsdom + Testing Library)
- `npm run test:db` — tests de la base : les vraies migrations appliquées dans PGlite (PostgreSQL en WebAssembly, sans Docker)
- `npm run test:e2e` — tests de bout en bout Playwright (Edge du poste, canal `msedge`) sur `next start -p 3100` :
  lancer `npm run build` avant. Parcours publics, sécurité, démonstrations ; aucune écriture en base
- `npm run db:start` / `db:reset` / `db:lint` / `db:types` — Supabase local (nécessite Docker Desktop)
- `npm run db:types:local` — régénère `lib/supabase/database.types.ts` depuis les migrations, via PGlite (sans Docker) ;
  un test échoue si le fichier n'est pas à jour
- `/design/app` — cadre de l'application avec un membre fictif (même règle que `/design`)
- `/design/factures`, `/design/debiteurs`, `/design/modeles`, `/design/boite-mail`, `/design/relances`,
  `/design/reponses`, `/design/tableau-de-bord`, `/design/journal`, `/design/parametres` — écrans des paliers 6 à 13
  avec des données fictives (même règle)

### Décisions de l'utilisateur (18/09/2026)

- Blanc sur `--accent` (4,499:1) : **accepté**, on garde le bleu imposé pour les boutons.
- « agences » au pluriel autorisé pour la clientèle cible (voir §2.1) ; « agence » au singulier interdit.
- Durées : survol/pression **220 ms**, apparitions/toasts **280 ms**, transitions de page **320 ms** (inchangées).
  Classes `duration-hover` / `duration-enter` / `duration-page`, jumelles TS dans `lib/design/motion.ts` (`DURATION`),
  parité vérifiée par test.
- Vercel (région du projet, déploiement) : l'utilisateur s'en occupe au moment du push.

### Décisions

- **Next.js 15.5.x** conformément au §3 (Next 16 existe ; migration à décider explicitement). React 19.2.
- **PostCSS forcé en ≥ 8.5.28** via `overrides` : la copie embarquée par Next 15 est vulnérable (build uniquement).
- **Framer Motion** : installer le paquet `motion` (nouveau nom de Framer Motion, import `motion/react`).
- **Thème** : `next-themes`, attribut `data-theme` sur `<html>`, sombre par défaut, pas de thème « système ».
  Un sous-arbre peut forcer un thème avec `data-theme` (les jetons se résolvent localement).
- **Jetons** : source unique dans `app/globals.css`. Variables brutes aux noms du §6 (`--bg`, `--text`…),
  exposées à Tailwind en `bg-canvas`, `bg-elevated`, `bg-surface`, `border-border`, `border-glow`,
  `text-fg`, `text-fg-muted`, `text-fg-subtle`, `bg-accent`, `text-success`… Palette Tailwind par défaut
  désactivée, échelle typographique fermée (`text-xs` 12 → `text-3xl` 56).
- **Utilitaires maison** : `bg-gradient-brand`, `text-gradient-brand`, `bg-gradient-glow`, `shadow-raised`,
  `shadow-halo`. Jamais de nom `<préfixe>-<couleur>` (collision avec les utilitaires de couleur générés) —
  garanti par `tests/design/theme-tokens.test.ts`.
- **Thème clair** : mêmes `--accent` / `--secondary` / `--gradient-brand` ; couleurs d'état assombries pour
  un contraste ≥ 4,5:1. `--secondary` est décoratif, jamais pour du texte sur fond clair.
- **Contrastes (WCAG AA)**, vérifiés par test dans les deux thèmes :
  - jetons ajoutés au §6 : `--accent-fg` (texte sur accent) et `--accent-text` → `text-link` (liens) ;
    `--accent` en texte plafonne à ~4,4:1, donc jamais `text-accent` pour du texte ;
  - `--text-subtle` (#5A6B88 imposé, ~3,6:1) : grands textes, icônes, désactivé, textes d'exemple
    uniquement, jamais sur `--surface`. Tout texte lisible : `text-fg-muted` au minimum ;
  - blanc sur `--accent` (#2F6BFF) = 4,499:1, un millième sous le seuil AA : accepté par l'utilisateur.
- **Polices** : `next/font/google` (auto-hébergées au build, aucun appel à Google côté navigateur — RGPD).
- **Formatage** : `lib/format.ts`, locale `fr-FR`, fuseau `Europe/Paris` forcé (pas d'écart serveur/navigateur).
- **Conformité §2.1** : `lib/compliance/forbidden-terms.ts` + test de balayage de `/app`, `/components`, `/emails`, `/lib`.
  « agencement » reste autorisé ; « agence » et « agences » sont interdits.
- **Composants** : fichiers en PascalCase (`ThemeToggle.tsx`), props typées par `type`.
- **Anneau (palier 2)** : géométrie unique dans `lib/brand/ring.ts`, partagée par `ReliaMark`, `ReliaLoader`,
  le favicon statique (`app/icon.ts`) et le favicon animé. Les 76° s'entendent **extrémités arrondies comprises**
  (sinon les espaces de 14° disparaissent). Arcs centrés à 45°/135°/225°/315°, espaces à midi, 3 h, 6 h, 9 h.
- **ReliaLoader** : rotation en CSS pur et dégradé mouvant en SMIL, pour qu'il tourne avant l'hydratation
  (`loading.tsx`). Le succès est joué avec l'API Web Animations : lecture de l'angle réel des arcs, convergence à
  vitesse continue, fermeture des espaces, surimpulsion 1 → 1,08 → 1, onde. `data-state` est piloté hors rendu
  React après le montage (il faut lire l'angle avant de couper la rotation CSS). Framer Motion n'est pas utilisé
  pour le loader (plus léger, pas de JS par image) ; il le sera pour les composants d'interface (palier 3).
- **`tone="current"`** : le loader prend la couleur du texte, pour les boutons pleins (le dégradé de marque
  disparaît sur `--accent`).
- **Logo avec étape** (`<ReliaMark stage="paid" />`) : l'arc de l'étape est plein, les autres à 22 % d'opacité.
- **Favicon animé** : canvas + `setInterval`, compteur de demandes partagé entre loaders, favicon restauré ensuite.
  Prop `hasFaviconAnimation` sur le loader (chargements de page, imports longs).
- **À traiter au palier 5** : le middleware Next s'exécute par défaut sur le runtime Edge, donc dans toutes les
  régions Vercel. Le déclarer en runtime Node.js (`export const config = { runtime: "nodejs" }`, stable en 15.5)
  pour qu'il reste en `cdg1` (§2.2).
- **À faire côté Vercel** : régler aussi « Function Region » sur `cdg1` dans les paramètres du projet.
- **Dossiers de build séparés** : `next dev` → `.next-dev`, `next build` → `.next` (`next.config.ts`). Un build
  lancé pendant que le serveur de dev tourne vidait `.next` sous ses pieds (ENOENT `_buildManifest.js.tmp`).
  Conséquence : **pas de `typedRoutes`** (chaque dossier générerait ses propres types de liens, en conflit).

### Bibliothèque de composants (palier 3)

- Emplacement : `components/ui/` (génériques), `components/invoices/` (métier), `components/brand/` (marque).
- `cn()` (`lib/cn.ts`) : clsx + tailwind-merge instruit des utilitaires maison ; la classe passée l'emporte.
- **CSS pur** quand il suffit (fonctionne dès le rendu serveur) : survol/pression, balayage des squelettes,
  pulsation « en retard », cascade des lignes (`TableRow index`, 40 ms/ligne, plafond 12). **Framer Motion**
  (`motion/react`) quand il faut une sortie ou une valeur animée : toasts, compteurs.
- `Button` : `status` idle | loading | success, loader intégré qui se referme au succès ; `aria-disabled` (pas
  `disabled`) pendant l'action pour garder le focus, clic et soumission bloqués ; `buttonClasses()` pour les liens.
- `Badge` : pastille colorée + libellé en couleur de texte (contraste AA garanti) ; `InvoiceStatusBadge` pour
  les statuts du schéma (`lib/invoices/status.ts`), seul « en retard » pulse.
- `Field` + `Input`/`Textarea`/`Select` : libellé, aide, erreur, obligatoire reliés automatiquement.
- `Modal` : `<dialog>` natif (focus piégé, Échap, fond inerte), animation CSS `@starting-style`, défilement
  bloqué par `html:has(dialog[open])`.
- Toasts : `useToast()` → `show`, `update`, `dismiss`, `promise` ; `ToastProvider` dans le layout racine.
- `StatCard` / `AnimatedNumber` : compteur ≤ 400 ms, valeur finale seule lue par les lecteurs d'écran ; au rendu
  serveur la vraie valeur s'affiche, le comptage depuis 0 n'a lieu que pour un montage côté client.
- Jeton ajouté : `--danger-fg` (texte sur fond `--danger`, contraste testé dans les deux thèmes).

### Base de données (palier 4)

- Migrations : `supabase/migrations/` ; données de démonstration : `supabase/seed.sql` (comptes locaux
  demo@relia.local et autre@relia.local, mot de passe local `relia-demo`). PostgreSQL 17.
- Tests : `tests/db/`. `supabase-shim.sql` imite Supabase dans PGlite (rôles d'API, privilèges par défaut,
  `auth.uid()`, `auth.users`, API de Vault) ; chaque test applique les vraies migrations. Tests validés par
  mutation (RLS retirée, règle de scoring affaiblie → échecs).
- **Isolation** : RLS sur toutes les tables (`private.current_organization_id()`, motif `(select …)`) ; clés
  étrangères composites `(id, organization_id)` : impossible de rattacher une ligne à celle d'une autre
  organisation, même hors RLS. Rôle anonyme sans aucun accès ; TRUNCATE retiré aux rôles d'API.
- **Colonnes réservées au serveur** : offre, Stripe, DPA (organisations) ; rôle et rattachement (membres) ;
  boîtes d'envoi et intégrations en écriture. Réglages d'organisation et déconnexions : owner/admin.
- **Secrets** : Supabase Vault, et non pgsodium (dépréciation annoncée par Supabase). Les tables stockent
  l'identifiant Vault (`*_secret_id`) ; fonctions `vault_*` réservées à la clé de service ; supprimer une boîte
  d'envoi ou une intégration supprime ses secrets.
- **§2.4 renforcé** : colonne `debtors.is_legal_entity`. Une entreprise individuelle a un SIREN mais reste une
  personne physique : score seulement si B2B + SIREN + personne morale. Par défaut `false` (pas de score).
- **§2.5 en base** : une étape ne peut utiliser qu'un modèle du même type de client (B2B/B2C) et du même ton,
  système ou de sa propre organisation.
- **Audit** : immuable (UPDATE, DELETE, TRUNCATE refusés à tous, superutilisateur compris) ; seule
  `private.purge_audit_logs()` lève le verrou, pour sa transaction. Un utilisateur ne trace que ses propres
  actions (`actor_type = 'user'`, `actor_id = auth.uid()`) ; système et IA passent par le serveur.
- `invoices.closed_at` (payée ou annulée) est posé par déclencheur : point de départ de la conservation.
- `reminder_steps.organization_id` ajouté (absent du §4) : toutes les tables portent `organization_id`.
- DPA obligatoire à la création d'une organisation (`dpa_accepted_at`, `dpa_version`, `dpa_ip` non nuls).
- **À traiter plus tard** : supprimer une organisation (droit à l'effacement) devra passer par une fonction
  qui lève le verrou d'audit (palier 15) ; règle « validation humaine avant le premier envoi IA » (palier 10).

### Authentification et inscription (palier 5)

- Variables : `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `NEXT_PUBLIC_SITE_URL`), validées par Zod (`lib/env.ts`) avec un message qui dit quoi faire.
- Clients Supabase : `lib/supabase/server.ts` (session de l'utilisateur, RLS), `admin.ts` (clé secrète, `server-only`),
  `middleware.ts` (rafraîchit la session, `getClaims()`). `cookies()` est lu avant la configuration : les pages qui
  touchent à la session sont dynamiques. Segment `/app` en `force-dynamic`.
- **Middleware en runtime Node.js** (`middleware.ts`) : il reste en `cdg1` (§2.2). Limité aux pages `/app` et
  d'authentification ; logique de redirection pure et testée (`lib/auth/routes.ts`).
- **Inscription** : `signUp` avec la session de l'utilisateur, puis `public.provision_organization` (clé de service,
  transaction unique : organisation, DPA horodaté + version + IP, propriétaire, scénarios par défaut, audit).
  L'identifiant vient de Supabase Auth, jamais du formulaire. Réponse identique si le compte existe déjà (pas
  d'énumération). Provisionnement raté → « orphelin » → `/inscription/finaliser`.
- DPA : `lib/legal/dpa.ts` (`DPA_VERSION`, texte versionné), page `/dpa` ; sous-traitants : `lib/legal/subprocessors.ts`,
  page `/sous-traitants`. Texte du DPA à faire valider par un juriste avant ouverture.
- IP du DPA : `x-vercel-forwarded-for`, puis `x-real-ip`, puis `x-forwarded-for` (première adresse valide),
  `0.0.0.0` si inconnue.
- Revue de sécurité du palier 5 : la réinitialisation du mot de passe exige une connexion par lien de récupération
  de moins de 15 minutes (`amr`, `lib/auth/recovery.ts`) ; types de liens e-mail limités à ceux que Relia envoie ;
  `secure_password_change` ; en-têtes de sécurité (`next.config.ts`). **Reportés au palier 15** : limitation de
  débit applicative et captcha (Supabase Auth limite déjà), suivi des erreurs, CSP avec nonce.
- Redirections : `safeNextPath` n'accepte que des chemins internes (pas de redirection ouverte).
- Mots de passe : 10 caractères, lettres et chiffres (Zod et `supabase/config.toml`). Confirmation d'e-mail activée.
- E-mails d'authentification en français : `emails/auth/*.html` (liens `token_hash` vers `/auth/confirm`), couverts
  par le test des termes interdits. En production : SMTP Resend (région UE) dans le tableau de bord Supabase.
- Transitions de page en CSS (`components/motion/Reveal.tsx`, `animate-page-in`) : visibles dès le rendu serveur.
  Barre latérale : indicateur `layoutId` (Framer Motion). `buttonClasses` vit dans `components/ui/button-styles.ts`
  (sans « use client ») pour les composants serveur.


### Factures (palier 6)

- **Import en une transaction** : `public.import_invoices(p_rows, p_source)` (droits de l'utilisateur, donc RLS ;
  sources `manual`, `csv`, `facturx` seulement, les intégrations passeront par le serveur). 2 000 factures au plus.
  Débiteur rapproché par SIREN, sinon par nom (casse ignorée) ; le type de client d'un débiteur existant prévaut.
  Numéros déjà présents ou en double dans le fichier : ignorés et renvoyés (`skipped`). Tout ou rien.
- **Lecture des fichiers dans le navigateur** : le CSV (papaparse, UTF-8 sinon Windows-1252, séparateur détecté) et le
  Factur-X (pdf-lib + fast-xml-parser, chargés à la demande) ne quittent pas le poste ; seules les lignes extraites
  sont envoyées, puis revalidées par Zod côté serveur (`importRowSchema`). Pas de limite de 4,5 Mo de Vercel à gérer
  pour les PDF. Server Actions : `bodySizeLimit` 3 Mo.
- **Factur-X** : XML CII (profil conservé en résumé dans `factur_x_raw`, jamais le PDF) ; tout `DOCTYPE` est refusé
  (pas d'expansion d'entités) ; sans échéance, émission + 30 jours (délai supplétif, C. com. L441-10) ; type de client
  B2B par défaut (facturation électronique = échanges entre professionnels), modifiable avant l'import.
- **Correspondance des colonnes CSV** devinée par synonymes (`lib/invoices/csv-mapping.ts`), modifiable ; lignes en
  erreur listées avec leur numéro de ligne du tableur et laissées de côté ; type de client par défaut demandé.
- **Statut effectif** : « en attente » + échéance passée (heure de Paris) = « en retard », en SQL
  (`private.effective_invoice_status`) comme en TS (`effectiveStatus`) — les deux règles doivent rester identiques.
- **Journal d'audit tenu par la base** : déclencheurs sur `invoices` (création, changement de statut, champs modifiés)
  et `debtors` (création, champs modifiés), quel que soit le chemin (interface, import, cron). Acteur `user` si un
  utilisateur est connecté, sinon `system`. Aucun nom ni coordonnée de débiteur dans le journal (données personnelles).
- **Une facture payée, contestée, annulée ou sous promesse n'est plus relancée** : ses relances `scheduled` /
  `awaiting_approval` sont annulées par déclencheur, dans la même transaction.
- Changements de statut manuels : `lib/invoices/transitions.ts` (payée avec date, litige, annulation, réouverture) ;
  écriture conditionnée au statut lu (deux changements simultanés ne s'écrasent pas).
- Liste : `public.list_invoices` (statut effectif, recherche dans le numéro et le nom du client, tri selon l'onglet,
  pages de 25) et `public.invoice_status_counts`. État dans l'URL : `?statut=en-retard&q=…&page=2`.
- Historique d'une facture : `lib/data/audit.ts` + `lib/audit/describe.ts` (phrases françaises, réutilisées par le
  journal au palier 12).
- Générateur de types : gère `returns table`, les tableaux et les arguments à valeur par défaut.
- `lib/forms/form-state.ts` : `FormState`, `readForm`, `firstFieldErrors` partagés (l'authentification les réexporte).
- Démonstration sans base : `/design/factures` (liste, import réel dans le navigateur, formulaire).
- **Revue de la base (palier 6)**, corrections appliquées : verrou consultatif par organisation pendant l'import
  (deux imports simultanés se suivent) ; homonymes sans SIREN départagés par l'e-mail (deux « Jean Dupont »
  aux e-mails différents restent deux personnes) ; SIREN d'une ligne propagé aux autres lignes du même client
  dans le fichier ; devise mise en majuscules ; index de rapprochement (SIREN, nom) ; jokers `%` et `_` de la
  recherche échappés (`private.contains_pattern`). Écarté : unicité du SIREN par organisation (une entreprise
  à plusieurs établissements peut avoir plusieurs fiches). À surveiller au-delà de ~10 000 factures par
  organisation : index trigramme pour la recherche.
- Montants : un séparateur unique suivi d'exactement 3 chiffres groupe les milliers (« 1.234 » = 1 234 €) —
  aucun montant ne s'écrit avec trois décimales.
- **Au palier 10** : l'envoi devra verrouiller sa relance (`for update skip locked`) et passer à `sent` dans la
  même transaction, pour ne pas courir contre l'annulation par déclencheur.

### Débiteurs (palier 7)

- **Score de risque de retard calculé par la base** (`private.debtor_risk_score`), sur le seul historique de
  l'organisation avec ce débiteur (deux ans) : 40 pts retard moyen (plein à 60 j), 30 pts part des factures
  réglées en retard, 30 pts plus ancien retard en cours (plein à 90 j). Null sans historique. Recalculé par
  déclencheurs d'instruction (une fois par débiteur et par import) et quand la forme juridique change.
  Le calcul est expliqué dans l'interface (transparence).
- **§2.4 à trois niveaux** : contrainte `CHECK` en base, `private.is_scoring_eligible` (B2B + SIREN + personne
  morale) et `lib/debtors/scoring.ts` (`isScoringEligible`, « Non applicable » à l'écran). `risk_score` et
  `payment_behavior_days` sont réservés au serveur (privilèges de colonnes) ; leur recalcul n'encombre pas le journal.
- Le score dépend de la date (retard en cours) : **le cron quotidien du palier 15 devra le recalculer** pour tous.
- Forme juridique demandée sur la fiche (personne morale / entrepreneur individuel) ; un particulier n'est jamais
  une personne morale ; une personne morale exige un SIREN.
- **Droits des personnes (§2.2)** : `public.export_debtor` (JSON complet : fiche, factures, relances, promesses,
  téléchargé par `/app/debiteurs/[id]/export`) et `public.delete_debtor` (effacement en cascade, réservé
  owner/admin par RLS, confirmation en saisissant le nom). Les deux sont tracés, sans donnée personnelle.
- Liste : `public.list_debtors` (encours et retard en euros, retards d'abord), onglets Tous / Professionnels /
  Particuliers, recherche nom / e-mail / SIREN. `lib/search-params.ts` partagé par les listes.
- `components/ui/RowLink.tsx` : ligne de tableau entièrement cliquable (partagée factures / débiteurs).

### Infrastructure et coûts (décidé le 19/09/2026)

- **Pas de Docker** : tests de base en PGlite ; application réelle sur un projet Supabase cloud.
- **Développement** : projet Supabase **Free** `relia-dev`, région Paris (0 €, mis en pause après 7 jours
  d'inactivité, sans sauvegarde : acceptable pour du dev). Vercel **Hobby** tant qu'aucun client ne paie.
- **Production** (avant le premier client payant) : projet Supabase **Pro** `relia-prod` (25 $/mois, pas de pause,
  sauvegardes quotidiennes) et Vercel **Pro** (20 $/mois : le Hobby est réservé à l'usage non commercial et refuse
  les crons plus fréquents qu'une fois par jour). E-mails d'authentification : SMTP Resend, région UE (gratuit
  jusqu'à 3 000/mois). Écarté : auto-hébergement (économie faible, risque élevé pour des données personnelles).
- **Vercel** : Function Region Paris (cdg1) en plus de `vercel.json` ; variables Production → projet prod,
  Preview → projet dev (jamais la base de prod en préversion) ; `SUPABASE_SECRET_KEY` marquée *Sensitive* ;
  sans `NEXT_PUBLIC_SITE_URL` en préversion, les liens d'e-mail pointent vers l'URL de la branche
  (`VERCEL_BRANCH_URL`, `lib/env.ts`). Web Analytics / Speed Insights désactivés.
- **À anticiper aux paliers 9 et 11** : lire les réponses Gmail exige une permission « restreinte » de Google,
  soumise à un audit de sécurité annuel payant (CASA) au-delà de 100 utilisateurs de test. Outlook : vérification
  d'éditeur gratuite.

### Revue sécurité des paliers 6 et 7 (19/09/2026), corrections appliquées

- **Factures non modifiables directement** par un membre (privilèges `update` et `delete` retirés) : les changements
  de statut passent par `public.change_invoice_status` (security definer, verrou de ligne, mêmes transitions que
  `lib/invoices/transitions.ts`, parité testée sur les 24 combinaisons statut × action ; date de règlement jamais
  future). Les montants restent protégés par les contraintes `CHECK` existantes.
- Devise validée contre la liste ISO 4217 connue du moteur `Intl` (une faute de frappe « UDS » est refusée) ;
  `formatCurrency` ne fait jamais échouer une page (repli « 12,00 EU »).
- Montants ambigus (« 1.234 ») listés dans l'assistant CSV avec leur lecture ; case « j'ai vérifié » obligatoire.
- Résumé Factur-X à forme fixe et bornée (`facturXSummarySchema`), accepté seulement pour une source `facturx` ;
  dates Factur-X vérifiées comme dates réelles.
- Tableaux : les liens secondaires d'une ligne restent lus par les lecteurs d'écran (seulement retirés de la tabulation).
- **Reportés au palier 15** : limitation de débit des Server Actions d'import, page d'erreur personnalisée (ne pas y
  afficher `error.message`), CSP avec nonce.

### Modèles et scénarios (palier 8)

- **Règles de contenu à trois niveaux** : `lib/compliance/template-rules.ts` (formulaire, en direct pendant la saisie),
  Server Action, puis déclencheur `private.check_template_content` en base (`private.template_violations`, mêmes
  motifs ; parité vérifiée par test sur chaque exemple). Menaces (§2.6), mentions réservées aux professionnels dans un
  modèle B2C (§2.5 : 40 €, indemnité forfaitaire, pénalités, intérêts de retard, BCE, L441, Code de commerce) et
  termes du §2.1. Mots entiers seulement (« saisissez » passe).
- **Modèles système** : source unique `lib/templates/system-templates.ts` (identifiants fixes) ; le SQL de la migration
  en est généré, et un test vérifie que la base contient exactement ces textes. B2B ferme et mise en demeure rappellent
  l'indemnité de 40 € et les pénalités (article L441-10, formulé sans le mot interdit) ; B2C jamais, et propose un
  échéancier. Mise en demeure : montant, échéance, délai (8 jours B2B, 15 jours B2C) et « le dossier pourra être confié
  à un tiers », rien d'autre.
- **Moteur** (`lib/templates/engine.ts`) : variables `{{nom}}` en français (`salutation`, `numero_facture`, `montant`,
  `statut_echeance`, `retard`…), refuse un type de client différent de celui du débiteur (dans les deux sens) et toute
  variable inconnue. HTML des e-mails échappé ; l'aperçu est rendu par React (`markdownBlocks`), sans HTML injecté.
- Modèles système en lecture seule : « Personnaliser » crée une copie de l'organisation (même ton, même type de
  client). Supprimer un modèle utilisé : ses étapes repassent au modèle Relia du même ton (`template_id` nul).
- **Scénarios** : un par type de client, modifiables (1 à 8 étapes, échéances strictement croissantes de -60 à
  +365 jours, ton ferme ou mise en demeure seulement après l'échéance) ; `public.save_sequence_steps` enregistre
  tout d'un coup en gardant les identifiants existants (les relances planifiées restent rattachées). Frise
  `SequenceTimeline` autour de l'échéance.
- **Revue du palier 8**, corrections appliquées : texte normalisé avant les règles (caractères invisibles retirés,
  espaces Unicode — insécables, fines, retours à la ligne — ramenées à une espace : un texte collé depuis un
  traitement de texte ne contourne pas la liste), en TS (`normalizeForRules`) comme en SQL ; majuscules accentuées
  repliées explicitement en SQL (`lower()` dépend de la configuration régionale du serveur) ; colonnes des modèles
  restreintes (un membre n'écrit que nom, objet, texte, variables ; type de client et ton figés) ; entrées invalides
  de `save_sequence_steps` refusées avec un message français ; boutons d'enregistrement jamais désactivés (reliés
  au message d'erreur par `aria-describedby`).

### Boîte d'envoi (palier 9)

- **§2.1** : les relances partent de la boîte du client — Gmail (API Gmail), Outlook (Microsoft Graph : brouillon
  puis envoi, identifiants immuables, pour rattacher les réponses) ou son serveur SMTP. Jamais d'un domaine Relia.
  Une seule boîte par organisation ; connexion et déconnexion réservées au propriétaire et aux administrateurs.
- **OAuth** (`lib/mail/oauth.ts`) : PKCE S256, `state` aléatoire, cookie httpOnly limité à `/app/boite-mail`
  (10 min) qui lie le retour au même membre et au même fournisseur ; permission d'envoi vérifiée au retour
  (`canSendWith`) ; Google `access_type=offline` + `prompt=consent` (jeton de rafraîchissement). Portées : envoi et
  lecture (la lecture servira aux réponses, palier 11). Adresse : jeton d'identité Google (reçu en TLS du point
  d'accès ; émetteur, audience, expiration et `email_verified` vérifiés), profil Graph pour Microsoft. Applications OAuth : variables `GOOGLE_OAUTH_*` et
  `MICROSOFT_OAUTH_*` (`.env.example`, URI de retour `/app/boite-mail/retour/{google|microsoft}`) ; absentes, le
  bouton correspondant est désactivé.
- **Secrets** : `public.replace_email_account` (une transaction : secrets dans Vault, ancienne boîte et ses secrets
  effacés, audit), `public.email_account_credentials` (lecture déchiffrée pour l'envoi) et
  `public.store_email_account_tokens` (renouvellement, rotation du jeton Microsoft) — clé de service uniquement.
- **Envoi** (`lib/mail/mailbox-sender.ts`) : renouvelle le jeton d'accès à moins d'une minute de l'expiration ;
  refus d'accès du fournisseur → boîte « à reconnecter » (statut `error`), plus aucun envoi en attendant.
- **SMTP** : garde SSRF (`lib/mail/smtp-guard.ts`) — le nom est résolu, toutes les adresses doivent être publiques
  (liste d'autorisation : plage `unicast` d'ipaddr.js seulement, ce qui écarte aussi les IPv4 cachées dans une IPv6),
  la connexion se fait à l'adresse vérifiée (le nom ne sert qu'au certificat TLS, TLS 1.2 minimum) ; ports 25,
  465, 587, 2525 ; délais de 10 s ; accès vérifié (`verify`) avant l'enregistrement. Préréglages des messageries
  courantes des TPE (OVHcloud, IONOS, Infomaniak, Gandi, Orange, Free, SFR, Zoho UE). `smtp-ports.ts` est séparé
  de la garde (`node:net`) pour rester importable côté client.
- Messages MIME construits par `nodemailer/lib/mail-composer` (texte + HTML, en-têtes encodés).
- E-mail de test envoyé à la boîte elle-même (tout membre) ; tracé.
- **Revue de sécurité du palier 9**, corrections appliquées : garde SSRF réécrite en liste d'autorisation (`::127.0.0.1`,
  `64:ff9b::`, 6to4, Teredo, TEST-NET, 100.64/10 refusés) ; `NEXT_PUBLIC_SITE_URL` obligatoire en production (sinon
  les liens OAuth et e-mail pointeraient vers une URL devinée) ; revendications du jeton d'identité Google vérifiées ;
  adresse du destinataire validée avant tout envoi ; `store_email_account_tokens` exige l'organisation de la boîte ;
  **limitation de débit** par le journal d'audit (`lib/data/rate-limit.ts`) : e-mail de test 5 / 10 min, vérification
  SMTP 10 / 10 min par organisation, chaque essai tracé, refus si le compteur est illisible.

### Moteur de relance (palier 10)

- **Planification** (`lib/reminders/planner.ts`, pur et testé) : une relance à la fois par facture (rien tant qu'une
  relance est planifiée ou à valider), 5 jours au moins après la précédente, première étape non encore envoyée dont
  la date est passée (une étape en échec ou annulée est retentée). Envoi le jour ouvré suivant (samedi, dimanche →
  lundi) à **9 h 30, heure de Paris**. Seules les factures en attente ou en retard sont relancées.
- **Moteur** (`lib/reminders/engine.ts`, clé de service, appelé par le cron ou le bouton « Préparer les relances du
  jour ») : rien sans boîte d'envoi active ; débiteurs sans e-mail comptés et signalés ; 50 relances au plus par
  exécution ; index unique (facture, étape) pour les relances actives, un doublon est ignoré. Tracé `reminder.planned`
  (acteur `ai` si le texte vient de Mistral, `system` sinon).
- **Rédaction** (`lib/reminders/writer.ts`) : le modèle est toujours rendu d'abord ; Mistral (`LLMProvider`,
  `lib/ai/mistral.ts`, température 0,3, réponse JSON, 20 s) le reformule. Réponse gardée seulement si le corps
  contient le numéro et le montant exacts, ne viole aucune règle de contenu (§2.5, §2.6) et ne laisse aucune
  variable `{{…}}` ; sinon repli sur le modèle. Sans `MISTRAL_API_KEY`, modèles seuls.
- **§2.3 validation humaine** : en base, déclencheur `private.guard_first_ai_send` — une relance IA ne peut être
  planifiée ni envoyée sans validation humaine tant que le débiteur n'a aucune relance IA validée. Dans le moteur :
  « à valider » si l'envoi automatique est coupé, ou si le texte est IA et le débiteur jamais validé.
  `organizations.auto_send` (défaut `false`) modifiable par owner/admin seulement. Badge « Message assisté par IA ».
- **Écriture réservée au serveur** : insert / update / delete retirés aux membres sur `reminders`. Un membre passe par
  `public.approve_reminder` (objet et texte retouchés revérifiés par `private.check_reminder_content` selon le type
  de client du débiteur, `approved_by` = membre connecté) et `public.cancel_reminder`.
- **Envoi** (`lib/reminders/dispatch.ts`) : `claim_due_reminders` (`for update skip locked`, réservation de
  10 minutes : deux crons ne prennent jamais la même relance) ; facture et e-mail revérifiés juste avant l'envoi ;
  résultat par `record_reminder_result` (`sent` / `failed`, identifiants du message et du fil pour le palier 11).
  Une relance validée dont l'heure est passée part aussitôt (`claim_reminder`).
- **Crons** : `/api/cron/relances/preparer` et `/api/cron/relances/envoyer` (runtime Node.js, `Authorization: Bearer
  CRON_SECRET` comparé à temps constant, `lib/cron.ts`). **Pas encore déclarés dans `vercel.json`** : le plan Hobby
  refuse les crons plus fréquents qu'une fois par jour ; à faire au palier 15 (Vercel Pro).
- Historique d'une facture : ses entrées de journal plus celles de ses relances (`payload->>invoice_id`).
- Page `/app/relances` : onglets À valider / Planifiées / Envoyées / Échecs, aperçu, retouche avec règles en direct.
- **Revue de sécurité du palier 10** (aucun point critique ni élevé), corrections appliquées : une relance annulée
  pendant son envoi (facture réglée à cet instant) est quand même notée envoyée, avec `after_cancel` dans le journal ;
  une erreur réseau (délai, coupure) devient un échec d'envoi enregistré, et un incident sur une relance n'arrête
  plus le lot du cron.

### Réponses et promesses (palier 11)

- **Lecture dans la boîte du client** (`lib/replies/readers.ts`) : Gmail (liste `after:… -from:me`, puis `format=raw`),
  Outlook (Graph `receivedDateTime ge …`, identifiants immuables, page suivante suivie seulement vers Graph, puis
  `/$value`), IMAP en repli SMTP (`imapflow`, port 993 seulement, TLS 1.2+, même garde SSRF que le SMTP :
  `resolvePublicMailHost`). Chaque lecteur liste d'abord les identifiants, ne garde que les messages des **fils de
  relance** (fil Gmail, conversation Outlook, `In-Reply-To`/`References` en IMAP), puis ne télécharge que ceux-là :
  Relia ne lit jamais le reste de la messagerie.
- **Rattachement IMAP** : une relance SMTP porte désormais un `Message-ID` choisi par Relia sous le domaine de
  l'expéditeur (`lib/mail/message-id.ts`), conservé comme identifiant et fil ; un avis de non-remise est rattaché
  d'après les en-têtes d'origine qu'il joint (`matchInRawText`).
- **Analyse** (`lib/replies/incoming.ts`) : MIME brut → `mailparser` (HTML converti par nos soins, citation et
  signature retirées : `quote.ts`), messages automatiques repérés par leurs en-têtes (`automated.ts`). Classement
  (`classify.ts`) : Mistral si configuré (réponse JSON validée par Zod, date bornée, montant jamais au-delà de la
  facture, le texte du client est une donnée), sinon règles françaises (`promise-date.ts` : « le 30/09 »,
  « vendredi », « sous huitaine », « fin du mois »…). Le classement porte sur le message, jamais sur la personne.
- **Base** (`20260919090000_replies.sql`) : table `replies` (lecture seule pour les membres, écriture par
  `public.record_reply`, clé de service ; dédoublonnage par `(organization_id, provider_message_id)`).
  Minimisation : extrait de 500 caractères de ce que le client a écrit, rien pour un message d'absence ou une
  non-remise, pas d'adresse de l'expéditeur. `export_debtor` inclut les réponses ; effacement en cascade.
- **Effets d'une réponse** : promesse datée → promesse `email_reply` + facture « sous promesse » (relances en attente
  annulées), si la confiance atteint 0,6 et qu'aucune promesse de la facture n'a déjà été rompue (sinon pause, un
  membre décide) ; la réponse reste « à traiter » (« C'est noté », « Corriger la promesse » qui la remplace, ou
  reprise) ; toute autre vraie réponse (contestation, règlement annoncé, question,
  non-remise) → `invoices.reminders_paused_at` posé et relances en attente annulées, réponse « à traiter » ;
  message d'absence → aucun effet. Le moteur ignore les factures en pause, l'envoi les revérifie juste avant.
- **Décisions d'un membre** : `resolve_reply` (garder en pause, reprendre, litige, payée — mêmes transitions que
  `change_invoice_status`), `record_promise` (date dans l'année, montant ≤ facture, depuis une réponse ou la fiche),
  `resume_reminders` (sur une facture sous promesse, la promesse est abandonnée : non tenue). Une facture réglée,
  contestée ou annulée classe d'office ses réponses et perd sa pause.
- **Promesses** : délai de grâce de 3 jours (`PROMISE_GRACE_DAYS` = `private.promise_grace_days()`, parité testée).
  Au règlement, tenue si payée au plus tard à la date + grâce. Passé ce délai sans règlement,
  `settle_due_promises` (cron du matin pour toutes les organisations, et en tête de chaque préparation) la déclare
  non tenue et la facture redevient due.
- **Cron** `/api/cron/reponses` (toutes les 30 min, 30 réponses analysées au plus par organisation et par passage ;
  s'il en reste, la date de lecture n'avance pas). Lecture depuis la précédente moins une marge d'une heure,
  jamais plus de 14 jours en arrière ; relances suivies : 60 derniers jours. **Pas encore déclaré dans
  `vercel.json`** (plan Hobby) : palier 15. Bouton « Vérifier les réponses » : 5 fois par 10 min.
- **Interface** : page `/app/reponses` (À traiter / Traitées, extrait, badge « Analyse assistée par IA »),
  fiche facture (bandeau de pause, réponses, « Noter une promesse », « Reprendre les relances »), état de la lecture
  sur la boîte d'envoi, formulaire SMTP avec serveur IMAP facultatif (préréglages des messageries courantes).
  Démonstration sans base : `/design/reponses`.
- Jointures PostgREST avec indication de clé explicite (`invoices!reminders_invoice_fkey`…) : `replies` et
  `promises` relient désormais `invoices` et `reminders` par plusieurs chemins.
- **Revue de sécurité du palier 11**, corrections appliquées : taille des messages bornée à 1 Mo (Gmail : taille
  lue avant le téléchargement ; Outlook : lecture du flux interrompue ; IMAP : taille lue dans la liste) — au-delà,
  la réponse est enregistrée sans extrait et suspend quand même les relances ; texte et HTML tronqués avant les
  expressions régulières (`maxHtmlLengthToParse` de mailparser est sans effet avec `skipHtmlToText`) ; promesse
  appliquée d'office seulement avec une confiance suffisante et jamais après une promesse rompue (pas de report sans
  fin) ; horizon de 120 jours identique en base et dans l'application (parité testée).
- **Revue de la base** (faite à la main, l'agent n'a pas pu aboutir) : ordre de verrouillage unique facture → relance
  ou réponse (`resolve_reply`, `approve_reminder`) contre les interblocages ; garde `reminders_guard_invoice` : aucune
  relance planifiée ou à valider pour une facture en pause ou sortie du cycle, facture lue `for share` pour attendre
  une réponse en cours d'enregistrement ; index partiel des factures sous promesse.

### Base de développement distante (mis à jour le 20/09/2026)

- Projet `relia-dev` (réf. `dicpllhaxxxdzsdhlxgs`, Paris, PostgreSQL 17) : migrations appliquées **jusqu'à
  `20260919140000_billing.sql`**, vérifié par empreinte MD5 du code des 66 fonctions et des déclencheurs contre
  les fichiers locaux (identiques, fins de ligne mises à part). Jeu de démonstration chargé (3 comptes, 3
  organisations, 8 factures), RLS active sur toutes les tables.
- Les fichiers y avaient été exécutés **sans l'historique de la CLI** (schéma `supabase_migrations` absent) : un
  `supabase db push` aurait tout rejoué. **Historique réparé le 20/09/2026** (`migration repair --status applied`
  sur les 13 versions jusqu'à `20260919140000`) : les migrations suivantes passent par un simple
  `npx supabase db push`.
- **Règle** : une migration appliquée sur `relia-dev` n'est plus jamais modifiée ; toute correction passe par une
  nouvelle migration. **Reste à appliquer** : `20260919150000_maintenance.sql`. Une autre session applique parfois
  les fichiers directement sur `relia-dev` : avant de modifier une migration récente, vérifier qu'elle n'y est pas
  déjà (empreinte MD5 du code des fonctions, comparée par `supabase db query --linked`).
- Vérifier l'état : `npx supabase migration list` (historique) et `npx supabase db query --linked "select …"`
  (lecture), sans Docker. `db dump` exige Docker.

### Tableau de bord et journal (palier 12)

- **Synthèse calculée par la base** : `public.dashboard_summary()` (security invoker : la RLS ne montre que
  l'organisation du membre). Encours, retard (statut effectif), promesses, facturé sur 90 jours, ancienneté des
  retards (1–30, 31–60, 61–90, > 90 jours) et les 5 factures à risque. Montants en **euros seulement** (des
  devises différentes ne s'additionnent pas) ; la liste des factures à risque, elle, montre toutes les devises.
- **DSO** = encours ÷ facturé des 90 derniers jours × 90 (`lib/dashboard/summary.ts`, `computeDso`) ; « — » sans
  facturation sur la période (`StatCard` accepte une valeur nulle).
- **Factures à risque** : les retards les plus anciens, puis les plus élevés — critère transparent. Le badge de
  risque du client n'apparaît que si un score existe (personne morale avec historique, §2.4).
- **Graphique d'ancienneté** (`components/dashboard/AgingChart.tsx`) : barres horizontales d'une seule couleur
  (`--accent`, validé par le script de la compétence dataviz sur les deux fonds), 20 px, bout arrondi de 4 px côté
  donnée, valeur au bout de chaque barre, part du retard au survol et au clavier (et lue par les lecteurs d'écran).
- **À faire** : réponses à traiter, relances à valider, envois en échec, avec liens. **Activité du jour** : journal
  depuis minuit (heure de Paris), sans les vérifications techniques (e-mail de test, lecture demandée).
- **Journal** `/app/journal` : 50 entrées par page, filtres par thème (`lib/audit/categories.ts` : conditions
  PostgREST fixes sur l'action), lien vers la facture ou le client concerné (`entryLink` : jamais vers un client
  effacé, identifiant vérifié), mention d'inaltérabilité. `lib/data/audit.ts` partage la mise en forme entre
  l'historique d'une facture, le journal et l'activité du jour.

### Abonnement (palier 13)

- **§2.1** : Stripe n'encaisse que l'abonnement à Relia. SDK officiel `stripe` 22.x (API `2026-08-26.dahlia` : la fin
  de période est portée par l'élément d'abonnement, `items.data[0].current_period_end`).
- **Offres** (`lib/billing/plans.ts`) : Essentiel 29 €, Pro 49 €, Business 79 € HT par mois, sans engagement.
  Utilisateurs et factures suivies annoncés par offre : **limites pas encore appliquées** (palier 15). TVA : prix HT ;
  `STRIPE_AUTOMATIC_TAX=true` si Stripe Tax est activé, sinon la configurer dans les prix.
- **Essai de 14 jours sans carte** : `organizations.trial_ends_at` (défaut `now() + 14 jours`). **Accès** = abonnement
  `active`, `trialing` ou `past_due` (Stripe relance la carte), ou essai en cours — `private.has_active_access` et
  `hasActiveAccess` (`lib/billing/access.ts`), parité testée. Sans accès : aucune relance préparée (moteur), réservée
  pour l'envoi (`claim_due_reminders`, `claim_reminder`), ni lecture des réponses ; les données restent consultables.
- **Paiement** : Stripe Checkout (`mode: subscription`, `locale: fr`, adresse de facturation et numéro de TVA demandés),
  client Stripe créé une fois par organisation (clé d'idempotence), `organization_id` en métadonnées de l'abonnement.
  **Portail client** Stripe pour changer d'offre, la carte, les factures, résilier. Réservés au propriétaire et aux
  administrateurs. Un abonnement actif ne peut pas en ouvrir un second (passer par le portail).
- **Webhook** `/api/stripe/webhook` (runtime Node.js, région `cdg1`) : signature vérifiée sur le corps brut ;
  `checkout.session.completed` et `customer.subscription.*` → l'abonnement est **relu chez Stripe** puis appliqué par
  `public.apply_stripe_subscription` (clé de service, un client Stripe ne change jamais d'organisation, tracé
  `subscription.updated` seulement quand l'état change) : événements rejoués ou dans le désordre sans danger. Échec →
  500, Stripe réessaie. Prix inconnu → ignoré (200) et journalisé.
- **Paramètres** `/app/parametres` : abonnement (situation en une phrase, offres, portail), organisation (nom, SIREN),
  conservation des données (1, 2, 3, 5 ou 10 ans), équipe (lecture seule ; invitations à venir). Bandeau commun à
  l'application : fin d'essai à 3 jours, relances en pause, paiement en échec.
- Variables : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER|PRO|BUSINESS`,
  `STRIPE_AUTOMATIC_TAX` (`.env.example`). Sans elles, l'essai suit son cours et le bouton explique l'indisponibilité.
- **Conformité** : le balayage des termes interdits couvre désormais aussi `/lib` (hors règles de conformité et
  tests) — il a trouvé « agence » dans un slogan d'offre et « recouvrement » dans un commentaire, corrigés.

### Site public et pages légales (palier 14)

- Groupe de routes `app/(site)` (accueil `/`, `/tarifs`) et `app/(legal)` (`/mentions-legales`, `/cgu`,
  `/confidentialite`, `/dpa`, `/sous-traitants`), même en-tête et pied de page (`components/marketing/SiteChrome.tsx`).
- **Accueil** : accroche, aperçu du produit en HTML (`HeroVisual`, masqué aux lecteurs d'écran, sens repris dans le
  texte), constat, fonctionnement en 4 étapes, cycle de l'anneau (les 4 arcs = les 4 temps d'une facture),
  engagements (§2 : votre adresse, aucun paiement ne transite, aucune menace, B2B/B2C, validation humaine, données à
  Paris), tarifs, questions fréquentes (`<details>` natifs), dernier appel. Textes dans `lib/marketing/content.ts`.
- Offres partagées avec les paramètres (`components/billing/PlanCards.tsx`).
- **Juridique** (`lib/legal/`) : CGU (`terms.ts`, version 2026-09 : outil jamais intermédiaire, aucun encaissement,
  usage pour ses propres factures uniquement, essai, abonnement mensuel sans engagement, IA validée par un humain,
  responsabilité plafonnée à 12 mois), confidentialité (`privacy.ts` : Relia responsable de traitement pour les comptes,
  sous-traitant pour les débiteurs ; aucun traceur publicitaire ni mesure d'audience ; cookies de session et thème
  seulement), mentions légales (`publisher.ts` : **champs de l'éditeur à renseigner**, affichés « à compléter »
  en attendant). Composant commun `components/legal/LegalDocument.tsx` (le DPA l'utilise aussi).
- Inscription : la case d'acceptation couvre désormais les CGU et le DPA (seule la version du DPA est enregistrée en
  base ; si les CGU évoluent séparément, prévoir une colonne de version).
- Sous-traitants : Mistral analyse aussi les réponses reçues (page mise à jour ; le DPA couvrait déjà la lecture
  des réponses).
- `app/sitemap.ts` et `app/robots.ts` : pages publiques indexées ; `/app`, `/api`, `/auth`, `/design` exclus.
- À régler dans le portail Stripe : résiliation **en fin de période** (ce que promettent les CGU et la FAQ).

### Crons, purge et durcissement (palier 15)

- **Crons** déclarés dans `vercel.json` (horaires en UTC, exécution en `cdg1`, **plan Vercel Pro requis** pour les
  crons de moins d'un jour) : `0 7 * * *` préparation (recalcul des scores de risque de tous les débiteurs — ils
  dépendent de la date —, promesses échues soldées, relances du jour), `*/15 * * * *` envoi, `*/30 * * * *` lecture
  des réponses, `0 4 * * 0` purge. Tous exigent `Authorization: Bearer CRON_SECRET`. Pas de cron de synchronisation
  des intégrations (`0 3 * * *` du §9) : aucune intégration comptable n'existe encore.
- **Purge** (`public.purge_expired_data`, §2.2) : pour chaque organisation, factures closes depuis plus que sa durée
  de conservation (relances, réponses, promesses en cascade), débiteurs devenus sans facture, journal plus ancien ;
  tracé `data.purged` avec les seuls nombres.
- **Effacement d'une organisation** (paramètres, propriétaire seulement, nom saisi en confirmation) : abonnement
  Stripe résilié immédiatement s'il court, `public.erase_organization` (tout, journal compris), puis comptes
  d'authentification supprimés par l'API d'administration, session du navigateur effacée.
- **CSP avec nonce** (`lib/security/csp.ts`, `middleware.ts`) : nonce aléatoire par requête sur toutes les pages
  (hors fichiers statiques et préchargements), transmis à Next.js par les en-têtes de la requête et à next-themes
  par le gabarit racine — **toutes les pages sont donc rendues à la demande**. `script-src 'self' 'nonce-…'
  'strict-dynamic'` (plus `'unsafe-eval'` et WebSocket en développement seulement), aucune source tierce sauf
  `form-action` vers `checkout.stripe.com` et `billing.stripe.com`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests`. Vérifié sans aucune violation dans le navigateur. La session n'est rafraîchie que sur
  l'espace client et les pages d'authentification (`needsSession`). Sur les préversions Vercel, la barre d'outils
  Vercel (vercel.live) est bloquée : c'est voulu.
- **Pages d'erreur** : `app/error.tsx`, `app/app/error.tsx` (le cadre reste), `app/global-error.tsx`,
  `app/not-found.tsx` — jamais `error.message`, seulement la référence (`digest`) pour le support.
- **Limitation de débit** de l'import CSV/Factur-X : 20 imports par 10 minutes et par organisation (compte les
  entrées `invoices.imported` du journal).
- **Restent ouverts** : limites d'utilisateurs et de factures par offre (annoncées, non appliquées : décision
  commerciale), invitations d'équipe, captcha à l'inscription (Supabase Auth limite déjà le débit), suivi des
  erreurs (un service tiers serait un nouveau sous-traitant hors UE à évaluer), synchronisation des intégrations.
- **Mise en page mobile** : une grille responsive porte toujours `grid-cols-1` comme base (piste qui peut rétrécir) ;
  sans cela, un texte tronqué (`truncate`, sans retour à la ligne) élargit la piste « auto » et la page déborde sur
  téléphone. Corrigé sur 29 fichiers ; test de bout en bout de non-débordement à 412 px sur 11 écrans. Les captures
  d'Edge sans interface sous ~500 px de large sont rognées par la fenêtre minimale : mesurer avec Playwright plutôt.
- **Tests de bout en bout** (`e2e/`, `npm run test:e2e` après `npm run build`) : site public (accueil, FAQ, tarifs,
  pages légales, termes interdits dans le texte rendu, 404, non-débordement mobile), sécurité (CSP avec nonce
  différent à chaque requête et sans violation dans le navigateur, en-têtes, espace client redirigé, crons et
  webhook refusés sans secret ni signature, inscription vide refusée), démonstrations (réponse et promesse,
  tableau de bord, journal, offres). `workers: 2` : plus d'instances d'Edge en parallèle se ferment en cours de test.
