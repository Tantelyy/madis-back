# Déployer MADIS sur un seul VPS Contabo

Ce guide concerne **Ubuntu 24.04 LTS, architecture x86_64/amd64**, avec Docker
Engine et Compose v2. Les images produites par les runners actuels sont Linux
amd64. Vérifier le système avant d'appliquer les commandes Ubuntu :
`cat /etc/os-release` et `uname -m`. Pour Debian ou ARM, adapter l'installation
et les images avant de continuer.

Les blocs « VPS — root » s'exécutent dans la session administrateur Contabo
visible sur votre capture. Les blocs « PC — PowerShell » s'exécutent sur votre
ordinateur Windows. Les blocs « VPS — deploy » s'exécutent après connexion SSH
avec ce compte. Remplacer IP_DU_VPS et les autres valeurs d'exemple.

## Architecture et ordre des opérations

Trois dépôts GitHub construisent trois images, et un seul Compose démarre cinq
conteneurs sur le VPS :

| Conteneur | Image | Fonction |
| --- | --- | --- |
| frontend | ghcr.io/tantelyy/madis-front | React compilé et Nginx |
| backend | ghcr.io/tantelyy/madis-back | Nest et migrations Prisma |
| ml-service | ghcr.io/tantelyy/madis-fastapi | FastAPI et modèle préentraîné |
| postgres | postgres:17-alpine | Base persistante |
| tunnel | ngrok/ngrok:latest | Tunnel HTTPS sortant |

```text
Navigateur -> HTTPS ngrok -> frontend/Nginx -> /api/* -> backend/Nest
                                                        |       |
                                                   PostgreSQL  FastAPI
                                                                 |
                                                            PostgreSQL
```

Aucun port applicatif n'est publié sur l'IP du VPS. Le réseau `edge` relie
ngrok au frontend ; `api`, interne, relie Nginx à Nest ; `private`, interne,
relie Nest, FastAPI et PostgreSQL. Nginx n'appartient pas au réseau de la base.
FastAPI doit lui aussi lire PostgreSQL pour calculer les prévisions.

`https://DOMAINE_NGROK/api/...` est accessible au navigateur : les routes métier
restent protégées par les gardes d'authentification de Nest. « Backend privé »
signifie ici aucune connexion directe à son port ; cela ne rend pas l'API
inaccessible via Nginx. Le réseau Docker n'isole pas les services de root ou
d'un utilisateur membre du groupe Docker sur l'hôte.

Le Compose appartient au dépôt backend mais orchestre toute la stack. Sa copie
opérationnelle est `/opt/madis/compose.yml`.

Ordre à suivre : installer Docker, créer deploy, installer la clé SSH, publier
les trois images, préparer les secrets du VPS, démarrer et initialiser la
stack, vérifier l'URL, puis activer le déploiement automatique.

## 1. Installer et vérifier Docker avant de créer le groupe

**VPS — root, Ubuntu 24.04.** Ne pas continuer après une commande en erreur.
Si Docker fonctionne déjà (`docker version` affiche Client et Server,
`docker compose version` fonctionne), passer à l'étape 2.

Vérifier d'abord la présence d'anciennes installations :
`dpkg -l docker.io docker-compose docker-compose-v2 podman-docker containerd runc`.
Si elles sont installées, suivre la section des conflits de la
[documentation Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
avant de changer les paquets d'un serveur déjà utilisé.

Installation depuis le dépôt officiel :

```bash
apt-get update
apt-get install -y ca-certificates curl openssl util-linux nano
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
  "$(dpkg --print-architecture)" "$VERSION_CODENAME" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version
docker run --rm hello-world
```

Ces commandes supposent un premier ajout du dépôt officiel. S'il existe déjà un
fichier `docker.sources`, utiliser sa configuration existante et ne pas ajouter
en parallèle `docker.list`.

L'erreur `group docker does not exist` signifie que ce groupe manque ; créer le
groupe seul ne fournit ni Docker Engine ni Compose. L'étape suivante ne vient
qu'après la réussite des vérifications ci-dessus.

## 2. Créer deploy sans questionnaire ni mot de passe

**VPS — root :**

```bash
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
passwd --lock deploy
getent group docker >/dev/null || groupadd docker
usermod -aG docker deploy
install -d -m 750 -o deploy -g deploy /opt/madis
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
su - deploy -c 'id && docker version && docker compose version'
```

Cela fonctionne aussi si `adduser` avait déjà créé deploy avant Ctrl+C.
La nouvelle session `su` prend en compte l'appartenance au groupe Docker.
Conserver un shell utilisable (`/bin/bash`) pour les commandes SSH de la CI.
Le verrouillage du mot de passe n'installe pas de clé : effectuer l'étape 3.

Le groupe Docker permet d'administrer l'hôte ; traiter la clé de déploiement
comme un accès privilégié. Voir la
[post-installation Docker](https://docs.docker.com/engine/install/linux-postinstall/).

## 3. Installer la clé SSH depuis votre PC Windows

**PC — PowerShell :**

```powershell
Set-Location D:\IT_Universite\M2\stage_madis
New-Item -ItemType Directory -Force "$env:USERPROFILE/.ssh" | Out-Null
ssh-keygen -t ed25519 -C "github-actions-madis" -f "$env:USERPROFILE/.ssh/madis_deploy_key"
Get-Content "$env:USERPROFILE/.ssh/madis_deploy_key.pub"
```

Laisser la phrase secrète vide aux deux demandes pour cette clé dédiée à
l'automatisation. Si ce nom de clé existe déjà, ne pas l'écraser.
La clé privée reste hors des dépôts Git.

**VPS — root :** ouvrir le fichier suivant, y ajouter sur une nouvelle ligne
la clé **publique** complète affichée sur le PC (`ssh-ed25519 ...`), puis sauver :

```bash
nano /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Cette installation via la session root déjà ouverte fonctionne même si deploy
n'a pas de mot de passe ; `ssh-copy-id deploy@...` ne pourrait pas s'authentifier
avant l'installation de la première clé.

Avant la première connexion, relever l'empreinte directement sur le VPS :
`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.

**PC — PowerShell, nouveau terminal :**

```powershell
ssh -o HostKeyAlgorithms=ssh-ed25519 -o IdentitiesOnly=yes -o PasswordAuthentication=no -i "$env:USERPROFILE/.ssh/madis_deploy_key" deploy@IP_DU_VPS
```

Comparer l'empreinte proposée avec celle du VPS. Dans cette session deploy,
vérifier `docker version` et `docker compose version`.
Pour un port SSH différent, ajouter `-p PORT` aux commandes ssh et `-P PORT`
aux commandes scp de ce guide.

Conserver pour le moment votre accès administrateur root. Ne pas désactiver
`PermitRootLogin` tant qu'un autre accès d'administration avec sudo ou la
console de secours Contabo n'est pas testé : deploy n'a pas été ajouté au
groupe sudo. Pour durcir SSH ensuite, contrôler la configuration effective avec
`sshd -T`, puis `sshd -t` avant `systemctl reload ssh`. Sur Ubuntu, un fichier
cloud-init peut déjà fixer les options : un fichier nommé `99-...` ne les
écrase pas forcément, la première valeur lue prime.

## 4. Pare-feu et domaine ngrok

**VPS — root, port SSH 22 par défaut :**

```bash
apt-get install -y ufw
ufw status verbose
ufw allow 22/tcp
ufw default deny incoming
ufw default allow outgoing
ufw enable
ufw status verbose
```

Adapter 22 au port réel AVANT d'activer UFW. Sur un serveur déjà configuré,
examiner les règles existantes : changer la politique par défaut ne retire pas
les anciennes règles d'autorisation. Vérifier une nouvelle connexion SSH.

Si vous activez un pare-feu réseau Contabo, autoriser aussi ce port SSH pour
votre PC et pour les runners GitHub. Une règle limitée à l'IP de votre PC
bloquerait la CI. Ne pas ouvrir 3000, 8000, 5432, 8080 ou 4040.
Aucun port entrant 80/443 n'est requis. Les sorties DNS/HTTPS doivent fonctionner
pour les téléchargements et la connexion de ngrok.

Créer un compte ngrok, relever le domaine attribué dans le Dashboard et son
authtoken. Utiliser toujours ce même domaine dans `NGROK_DOMAIN`, sans
`https://`, sans chemin ni slash final. Le Compose passe cette URL explicitement
à ngrok. Ne pas utiliser simultanément le même endpoint sur votre PC.

Le domaine gratuit attribué ne permet pas de choisir librement son nom. Les
quotas et la page d'avertissement navigateur s'appliquent :
[limites officielles ngrok](https://ngrok.com/docs/pricing-limits/free-plan-limits).
Le service ngrok peut interrompre l'accès si le compte atteint ses limites.

## 5. Publier les trois images avant le premier démarrage

Dans chacun des trois dépôts GitHub, laisser la variable Actions
`DEPLOY_ENABLED` absente ou à `false`. Commiter les fichiers du projet concerné
(y compris Dockerfile et workflow), puis fusionner sur `main`.

| Dépôt | Image attendue |
| --- | --- |
| Tantelyy/madis-back | ghcr.io/tantelyy/madis-back:sha-COMMIT_BACKEND |
| Tantelyy/madis-front | ghcr.io/tantelyy/madis-front:sha-COMMIT_FRONTEND |
| Tantelyy/madis-fastAPI | ghcr.io/tantelyy/madis-fastapi:sha-COMMIT_ML |

Vérifier dans Actions que les jobs de qualité et de publication réussissent.
La qualité construit aussi les images : Nest est démarré sur une base de test
vide, ses migrations et son seed sont exécutés ; Nginx valide sa configuration ;
l'image Python charge le modèle. Ces contrôles ne touchent pas au VPS.
`dev` et les pull requests lancent la qualité mais ne publient pas les images.
Les tags `sha-...` contiennent les 40 caractères du commit de `main` construit
dans chaque dépôt ; ce sont trois références distinctes. Le tag `latest`
est aussi publié, mais les références SHA rendent le premier démarrage précis.

Le jeton `GITHUB_TOKEN` du workflow publie dans GHCR ; ne pas créer de PAT
d'écriture à cette fin. Si GitHub refuse la publication, vérifier les
permissions Actions/Packages du dépôt et la liaison du paquet à ce dépôt.

## 6. Copier les fichiers et renseigner les secrets

**PC — PowerShell, racine du workspace :**

```powershell
scp -i "$env:USERPROFILE/.ssh/madis_deploy_key" backend/deploy/compose.yml backend/deploy/deploy-service.sh backend/deploy/.env.example backend/deploy/.versions.env.example deploy@IP_DU_VPS:/opt/madis/
```

**VPS — deploy :**

```bash
cd /opt/madis
umask 077
test -f .env || cp .env.example .env
test -f .versions.env || cp .versions.env.example .versions.env
sed -i 's/\r$//' deploy-service.sh
chmod 600 .env .versions.env
chmod 750 deploy-service.sh
nano .env
nano .versions.env
```

Les commandes préservent les fichiers de secrets déjà présents. La normalisation
du script évite les erreurs `/bin/sh^M` après une copie depuis Windows.

Dans `.env`, remplacer TOUS les exemples, notamment :

- `POSTGRES_PASSWORD` et le même mot de passe dans `DATABASE_URL` ;
- les deux secrets JWT, différents ;
- `INITIAL_ADMIN_PASSWORD`, différent des autres secrets ;
- `NGROK_DOMAIN` et `NGROK_AUTHTOKEN`.

Exécuter `openssl rand -hex 32` séparément pour chaque mot de passe ou secret.
L'hexadécimal évite les problèmes d'encodage du mot de passe dans DATABASE_URL.
Son hôte est `postgres:5432`, jamais `localhost`. Si vous changez l'utilisateur
ou le nom de base, adapter aussi DATABASE_URL.

Dans `.versions.env`, remplacer les trois références `latest` par les tags
`sha-...` publiés à l'étape 5. Ne pas utiliser les mots COMMIT_BACKEND, etc.,
littéralement. Ne jamais exécuter `source .env` : c'est un fichier Compose,
certaines valeurs contiennent des espaces.

## 7. Authentifier Docker et démarrer avant d'ouvrir le tunnel

**VPS — deploy**, et non root : les identifiants GHCR doivent appartenir au même
utilisateur que les futures connexions CI. Pour des images privées, créer un
PAT GitHub classique avec `read:packages` et accès aux trois paquets.
[Documentation GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

```bash
read -r -s -p "PAT GitHub read:packages : " GHCR_READ_TOKEN
printf '\n'
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u Tantelyy --password-stdin
unset GHCR_READ_TOKEN
```

Le PAT n'apparaît pas dans l'historique. Docker le conserve dans la configuration
de deploy ; ne pas partager ce fichier. Pour des paquets publics, le login
n'est pas nécessaire.

```bash
cd /opt/madis
docker compose --env-file .env --env-file .versions.env -f compose.yml config --quiet
docker compose --env-file .env --env-file .versions.env -f compose.yml pull
docker compose --env-file .env --env-file .versions.env -f compose.yml up -d --wait --wait-timeout 300 postgres ml-service backend frontend
docker compose --env-file .env --env-file .versions.env -f compose.yml ps
```

Si une étape échoue, consulter les logs avant de continuer. Le tunnel est
volontairement démarré après l'initialisation de la base. La colonne PORTS
ne doit pas afficher de correspondance hôte telle que `0.0.0.0:3000->3000`.

### Base neuve : migrations et seed

PostgreSQL initialise une base vide dans le volume nommé `madis_postgres-data`.
À chaque démarrage, l'entrypoint backend exécute `prisma migrate deploy`,
puis démarre Nest seulement si les migrations réussissent. Elles viennent de
`backend/prisma/migrations` ; cette commande ne crée pas de migration.

Vérifier l'état, puis sur une base neuve exécuter le seed une seule fois :

```bash
docker compose --env-file .env --env-file .versions.env -f compose.yml exec backend npx prisma migrate status
docker compose --env-file .env --env-file .versions.env -f compose.yml exec backend npx prisma db seed
```

Le seed crée rôles, permissions, administrateur et paramètres initiaux. Il ne
réinitialise plus le mot de passe d'un administrateur existant, mais il modifie
d'autres paramètres : ne pas le relancer automatiquement à chaque déploiement.
L'image backend inclut le schéma, la CLI Prisma, le seed et sa configuration
TypeScript. Aucun Node/Python/PostgreSQL supplémentaire à installer sur l'hôte.

### Base existante et modèle ML

Ce démarrage ne transfère PAS votre base locale. Pour conserver vos données,
sauvegarder puis restaurer la base dans PostgreSQL avant de démarrer Nest et
ses migrations. Vérifier la version PostgreSQL source et l'historique
`_prisma_migrations` ; ne pas lancer de reset, de db push ou de seed aveuglément.
Une base déjà peuplée sans historique Prisma nécessite un baseline adapté.

Les variables POSTGRES_* initialisent seulement un volume vide. Modifier
POSTGRES_PASSWORD dans `.env` ne change pas le mot de passe dans un volume
existant. Ne pas supprimer le volume pour corriger une erreur d'authentification.

Le modèle inclus a été entraîné sur des données synthétiques et 15 produits.
Une base neuve n'a ni ces produits ni leur historique ; un service ML healthy
ne garantit donc pas des prévisions pour vos nouveaux produits. Le Compose
utilise les données de production. Valider l'adéquation du modèle et des
identifiants produits avant de compter sur les prévisions métier.

## 8. Ouvrir le tunnel et vérifier l'application

**VPS — deploy :**

```bash
docker compose --env-file .env --env-file .versions.env -f compose.yml exec frontend nginx -t
docker compose --env-file .env --env-file .versions.env -f compose.yml exec frontend wget -qO- http://127.0.0.1:8080/api/
docker compose --env-file .env --env-file .versions.env -f compose.yml up -d tunnel
docker compose --env-file .env --env-file .versions.env -f compose.yml logs --tail=50 tunnel
```

La requête /api/ doit renvoyer `Hello World!`, preuve que Nginx atteint Nest.
Ouvrir ensuite l'URL HTTPS fixe. Vérifier connexion administrateur, rechargement
d'une route React, opérations autorisées et téléchargement d'une facture.
Les cookies de production sont Secure : tester via HTTPS.
La page ngrok « Visit Site » peut apparaître lors de la première visite.

## 9. Activer le CD dans chacun des trois dépôts

Sur le PC, récupérer la clé hôte dans un fichier, puis comparer son empreinte
avec celle relevée sur la console du VPS à l'étape 3 :

```powershell
ssh-keyscan -p 22 -t ed25519 IP_DU_VPS | Set-Content -Encoding ascii "$env:USERPROFILE/.ssh/madis_known_hosts"
ssh-keygen -lf "$env:USERPROFILE/.ssh/madis_known_hosts"
```

Adapter le port. Le résultat de ssh-keyscan seul n'est pas une preuve
d'authenticité : la comparaison indépendante est indispensable.

Dans **Settings > Secrets and variables > Actions > Secrets**, ajouter dans
CHAQUE dépôt :

| Secret | Valeur |
| --- | --- |
| VPS_HOST | IP du VPS, sans protocole |
| VPS_PORT | 22 ou le port SSH réel |
| VPS_USER | deploy |
| VPS_SSH_PRIVATE_KEY | contenu complet de la clé privée madis_deploy_key |
| VPS_KNOWN_HOSTS | contenu vérifié de madis_known_hosts |

Dans l'onglet **Variables**, créer `DEPLOY_ENABLED=true` seulement maintenant.
Le token ngrok et les secrets de base restent dans `/opt/madis/.env`.

Un prochain push sur `main` teste, construit et publie l'image puis déploie
le service correspondant. Pour déployer le commit déjà publié après activation,
relancer le workflow de ce commit de main depuis Actions.
Le backend synchronise aussi Compose et le script sur le VPS.
Un verrou sur le VPS sérialise les déploiements des trois dépôts.

Le CD remplace seulement le service demandé (`--no-deps`). Une modification
globale de réseau ou d'environnement dans Compose nécessite une application
manuelle de la configuration complète :
`docker compose --env-file .env --env-file .versions.env -f compose.yml up -d --wait --wait-timeout 300`.
Planifier une courte interruption ; ce dispositif n'est pas un déploiement
sans interruption.

Protéger main par des pull requests et les statuts `Test, lint and build`
(Nest/React) ou `Test and validate` (Python). Les tests API Python nécessitant
la base synthétique sont ignorés en CI lorsqu'aucune DATABASE_URL n'est fournie.

## 10. Exploitation, sauvegardes et limites du rollback

**VPS — deploy :**

```bash
cd /opt/madis
docker compose --env-file .env --env-file .versions.env -f compose.yml ps
docker compose --env-file .env --env-file .versions.env -f compose.yml logs --tail=100 backend
docker compose --env-file .env --env-file .versions.env -f compose.yml logs --tail=100 ml-service
```

Le CD attend le healthcheck de la nouvelle image. En cas d'échec, il essaie de
remettre l'image réellement utilisée avant le déploiement et attend également
son healthcheck. Cela ne restaure PAS la base ou le fichier Compose précédent.
Une migration irréversible ou incompatible peut empêcher l'ancienne application
de redémarrer. Prévoir des migrations compatibles et une sauvegarde testée.

Sauvegarde depuis Bash sur le VPS, avec le nom de base/utilisateur configurés :

```bash
cd /opt/madis
umask 077
mkdir -p backups
docker compose --env-file .env --env-file .versions.env -f compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/madis-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Vérifier la réussite de pg_dump, tester une restauration sur une base séparée,
et copier les sauvegardes hors du VPS. Le volume Docker n'est pas une sauvegarde.
Ne pas utiliser `docker compose down -v` ni `docker volume prune` sur cette stack.
Conserver les anciennes images utiles au rollback ; leur nettoyage est manuel.

| Symptôme | Vérification |
| --- | --- |
| group docker does not exist | Terminer étape 1, puis étape 2 |
| Permission denied sur docker.sock | Nouvelle session deploy ; vérifier id et service Docker |
| Permission denied (publickey) | Bonne clé -i, authorized_keys et permissions de l'étape 3 |
| unauthorized/denied GHCR | docker login sous deploy, PAT read:packages et accès aux paquets |
| manifest unknown | Les trois publications sur main ont-elles réussi ? Vérifier les tags |
| exec format error | Le VPS est-il amd64 ? Le script a-t-il des fins de ligne LF ? |
| Backend redémarre en boucle | Logs Prisma, DATABASE_URL, migrations et état de PostgreSQL |
| ML unhealthy | Logs de chargement du modèle et compatibilité des dépendances |
| /api renvoie 502 | Santé de Nest, nginx -t, configuration des réseaux |
| ngrok refuse le domaine | Domaine attribué exact, authtoken, endpoint déjà actif ou quota |

Ne pas considérer ce guide comme une validation à distance de votre VPS : la
construction et le démarrage des images doivent effectivement réussir avant
d'activer le CD.
