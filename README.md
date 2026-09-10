# MADIS — Backend

API métier de **MADIS (Ma Distribution)**, une application de gestion commerciale
et de suivi des stocks. Ce service centralise les règles de gestion, les accès
aux données et les échanges avec le service de prévision.

## Fonctionnalités

- Authentification par JWT dans des cookies HTTP-only, rôles et permissions.
- Gestion des utilisateurs, fournisseurs, produits et référentiels.
- Gestion des lots, inventaires, mouvements et seuils de stock.
- Grilles tarifaires, promotions et produits offerts.
- Vente, validation, paiement, annulation et remboursement.
- Génération de factures PDF et import de données CSV.
- Tableaux de bord commerciaux et consultation des prévisions de demande et de rupture.

## Technologies et organisation

Le projet utilise **NestJS, TypeScript, Prisma et PostgreSQL**. Les tests reposent
sur Jest ; ESLint et Prettier assurent les contrôles de code.

- `src/` : modules métier, contrôleurs, services, DTO et tests unitaires.
- `prisma/` : schéma de données, migrations et seed.
- `assets/` : ressources utilisées notamment pour les factures.
- `deploy/` : configuration partagée pour le déploiement de toute la stack.
- `.github/workflows/ci.yml` : pipeline CI/CD.

Le [frontend React](https://github.com/Tantelyy/madis-front) appelle cette API.
Le backend lit et écrit dans PostgreSQL et interroge le
[service ML](https://github.com/Tantelyy/madis-fastAPI) pour les prévisions.

## Développement local

Prérequis : Node.js 22.12 ou supérieur dans la branche 22, npm et une base
PostgreSQL de développement accessible. Exécuter les commandes depuis la racine
de ce dépôt. Sous PowerShell, utiliser `npm.cmd` ou `npx.cmd` si l'exécution des
scripts `.ps1` est bloquée.

Installer les dépendances et préparer le fichier de configuration :

```bash
npm ci
cp .env.example .env
```

Sous PowerShell, la copie peut se faire avec `Copy-Item .env.example .env`.
Si un `.env` existe déjà, conserver ses valeurs.

Configurer `DATABASE_URL`, les secrets JWT, `FRONTEND_URL` et
`ML_SERVICE_URL` à partir de [.env.example](.env.example). Pour le premier
administrateur, ajouter `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_USERNAME` et
`INITIAL_ADMIN_PASSWORD` dans le fichier avant le seed.

Sur une base de développement neuve :

```bash
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

L'API écoute par défaut sur `http://localhost:3000`. Le frontend local utilise
`http://localhost:5173` et le service ML `http://localhost:8000`.
Le seed initialise les rôles, permissions, paramètres et le premier compte
administrateur ; il ne doit pas être relancé systématiquement sur une base utilisée.

## Vérifications

Après génération du client Prisma :

```bash
npm test -- --runInBand
npm run lint
npm run build
```

Pour créer une nouvelle migration pendant le développement, utiliser
`npm run prisma:migrate -- --name nom_de_la_modification` sur la base locale.
Les migrations versionnées sont ensuite appliquées en production avec
`prisma migrate deploy`.

## CI/CD et déploiement

La CI vérifie tests, lint et build sur les pull requests et les branches
`dev` et `main`. Elle contrôle aussi le script de déploiement et le démarrage
de l'image backend avec migrations et seed sur une base de test vide.

Un push sur `main` publie l'image `ghcr.io/tantelyy/madis-back`. Le CD met
à jour le backend sur Contabo lorsque `DEPLOY_ENABLED=true`.

Sur le VPS, Nginx transmet les requêtes `/api/*` à Nest ; le port du backend
n'est pas publié sur l'hôte. L'entrypoint applique les migrations avant de
démarrer l'application.

Consulter le **[guide de déploiement Contabo](deploy/README.md)** pour les trois
applications, PostgreSQL, ngrok, SSH et les secrets. Les fichiers `.env` et les
clés privées ne doivent pas être commités.
