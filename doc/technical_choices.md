# Choix Techniques - Projet Kaiju

Ce document justifie les choix technologiques effectués pour les stacks **backend** et **frontend** du projet Kaiju, une application de gestion de ressources et de transactions entre quartiers.

---

## Sommaire

1. [Architecture Globale](#architecture-globale)
2. [Backend](#backend)
   - [Langage & Runtime](#langage--runtime)
   - [Framework Web](#framework-web)
   - [Base de Données & ORM](#base-de-données--orm)
   - [Authentification & Sécurité](#authentification--sécurité)
   - [Temps Réel](#temps-réel)
   - [Validation](#validation)
   - [Gestionnaire de Paquets](#gestionnaire-de-paquets)
   - [Containerisation](#containerisation)
3. [Frontend](#frontend)
   - [Framework](#framework)
   - [UI & Styling](#ui--styling)
   - [Gestionnaire de Paquets](#gestionnaire-de-paquets-1)
   - [Containerisation](#containerisation-1)
4. [Infrastructure](#infrastructure)
5. [Synthèse des Avantages](#synthèse-des-avantages)

---

## Architecture Globale

L'application suit une **architecture client-serveur classique** avec :

- **Backend** : API REST + WebSocket (Express + Socket.io)
- **Frontend** : Application React (Next.js) consommatrice de l'API
- **Base de données** : PostgreSQL avec Prisma ORM
- **Communication** : HTTP/REST pour les opérations CRUD, WebSocket pour le temps réel

Cette séparation claire permet :

- Un **couplage faible** entre frontend et backend
- Une **évolutivité** indépendante des deux parties
- Une **maintenabilité** accrue grâce à la spécialisation des couches
- La possibilité de **changer de frontend** sans impacter le backend (et vice versa)

---

## Backend

### Langage & Runtime

| Technologie | Version | Justification |
| ------------ | --------- | --------------- |
| **Node.js** | 22+ (LTS) | Runtime JavaScript/TypeScript moderne, performant et largement adopté. La version 22 apporte des améliorations significatives en termes de performances (V8 12.4) et de stabilité. |
| **TypeScript** | 5.9+ | Typage statique fort pour une meilleure maintenabilité, détection précoce des erreurs et une meilleure expérience développeur (autocomplétion, refactoring). |

**Pourquoi Node.js et pas Java/Spring, Python/Django, ou Go ?**

- **Écosystème riche** : npm/yarn/pnpm offrent le plus grand écosystème de bibliothèques
- **Full-stack JavaScript** : Permet de partager des types entre frontend et backend (ex: Zod schemas)
- **Performance adaptée** : Suffisante pour une application web classique avec des opérations I/O bound (API, DB)
- **Facilité de déploiement** : Un seul binaire, pas de compilation complexe
- **Communauté active** : Documentation abondante, solutions existantes pour la plupart des problèmes

### Framework Web

| Technologie | Version | Justification |
|------------|---------|---------------|
| **Express** | 5.2.1 | Framework minimaliste et flexible pour créer des APIs REST. La version 5 apporte le support natif des promesses et une meilleure gestion des erreurs. |

**Pourquoi Express et pas NestJS, Fastify, ou Koa ?**

- **Simplicité** : Express offre une API minimaliste et intuitive, idéale pour un projet de taille moyenne
- **Flexibilité** : Middleware-based, permet d'ajouter des fonctionnalités au besoin (CORS, cookies, etc.)
- **Maturity** : Express est stable, largement utilisé en production, avec une vaste documentation
- **Compatibilité** : Excellente intégration avec Prisma, Socket.io et d'autres bibliothèques
- **Courbe d'apprentissage** : Faible, permettant une montée en compétence rapide de l'équipe

**Alternative envisagée - NestJS** :
Bien que NestJS offre une structure plus rigide (DI, modules, decorators) qui serait bénéfique pour un projet très grand, il ajoute une complexité inutile pour ce projet. Express reste plus adapté à la taille et aux besoins actuels.

### Base de Données & ORM

| Technologie | Version | Justification |
| ------------ | --------- | --------------- |
| **PostgreSQL** | - | SGBD relationnel open-source, robuste et performant. Supporte les transactions ACID, les requêtes complexes et le JSON. |
| **Prisma ORM** | 8.0.0-rc.10 | ORM moderne de type "Data Proxy" avec une approche declarative. |
| **Prisma Composer** | 0.19.0 | Outil pour déployer des applications Prisma en tant que services serverless. |
| **@prisma/orm-postgres** | 8.0.0-rc.10 | Driver PostgreSQL pour Prisma ORM v8. |

**Pourquoi PostgreSQL et pas MySQL, MongoDB, ou SQLite ?**

- **Relationnel** : Le domaine métier (quartiers, ressources, transactions, utilisateurs) a des **relations complexes** qui se modélisent naturellement en tables relationnelles
- **ACID Compliance** : Les transactions financières (transfers de ressources) nécessitent des garanties ACID fortes
- **Flexibilité** : PostgreSQL supporte à la fois les requêtes SQL complexes ET le stockage JSON pour des données semi-structurées
- **Performance** : Excellentes performances en lecture/écriture, surtout avec un bon indexing
- **Fiabilité** : Mature, stable, largement utilisé en production

**Pourquoi Prisma et pas Sequelize, TypeORM, ou Drizzle ?**

La stack Prisma utilisée ici est particulièrement moderne et innovante :

1. **Prisma ORM v8 (Data Proxy)** :
   - Nouvelle architecture où Prisma agit comme un **proxy entre l'application et la DB**
   - Génère automatiquement des **types TypeScript** à partir du schéma de données
   - Offre une **API declarative et type-safe** pour les requêtes
   - Gère les **connexions poolées** efficacement
   - Permet des **requêtes complexes** avec une syntaxe intuitive

2. **Approche Contract-First** :
   - Le fichier `contract.ts` définit le schéma de données de manière **explicite et typée**
   - Cette approche est plus robuste que les migrations traditionnelles
   - Permet une **validation à la compilation** des types de données

3. **Prisma Composer + Prisma Cloud** :
   - **Prisma Composer** : Outil pour définir des modules Prisma déployables
   - **Prisma Cloud** : Service managé pour déployer des bases de données Prisma en serverless
   - Permet un **déploiement simplifié** sur des plateformes comme Railway, Vercel, etc.
   - Offre du **scaling automatique** et une gestion simplifiée de l'infrastructure

**Exemple de contract (contract.ts)** :

```typescript
const QuarterCode = enumType("QuarterCode", pgText,
  member("A", "A"), // Apex
  member("E", "E"), // Echo
  ...
);
```

Cette approche moderne de Prisma permet :

- Une **intégration parfaite avec TypeScript**
- Une **réduction des erreurs** grâce au typage fort
- Une **productivité accrue** avec l'autocomplétion IDE
- Une **maintenabilité** meilleure grâce à la déclaration explicite du schéma

### Authentification & Sécurité

| Technologie | Version | Justification |
| ------------ | --------- | --------------- |
| **jsonwebtoken** | 9.0.3 | Bibliothèque standard pour la génération et vérification des JWT. |
| **bcryptjs** | 3.0.3 | Algorithme de hachage sûr pour les mots de passe (bcrypt). |
| **cookie-parser** | 1.4.7 | Middleware Express pour parser les cookies. |
| **cors** | 2.8.6 | Middleware pour gérer les CORS (Cross-Origin Resource Sharing). |
| **dotenv** | 17.4.2 | Chargement des variables d'environnement depuis `.env`. |

**Flux d'authentification implémenté** :

1. L'utilisateur se connecte avec email/mot de passe
2. Le backend vérifie le mot de passe avec `bcryptjs.compare()`
3. Un token JWT est généré avec `jsonwebtoken.sign()`
4. Le token est stocké dans un **cookie HTTP-only** (sécurité contre XSS)
5. Les requêtes suivantes incluent le cookie
6. Le middleware d'authentification vérifie et décode le JWT

**Pourquoi JWT et pas sessions server-side ?**

- **Stateless** : Pas besoin de stocker l'état de session côté serveur, scale horizontalement plus facile
- **Flexibilité** : Les tokens peuvent être utilisés depuis n'importe quel client (web, mobile, etc.)
- **Standard** : JWT est un standard largement supporté (RFC 7519)
- **Sécurité** : Avec un `JWT_SECRET` fort et des cookies HTTP-only, le niveau de sécurité est bon

**Variables de sécurité (`.env`)** :

```env
JWT_SECRET=dhb51:;dzq5d
PEPPER=njo,dzq;:-+6
```

- `JWT_SECRET` : Clé secrète pour signer les tokens JWT
- `PEPPER` : Valeur supplémentaire pour le hachage des mots de passe (en plus du salt bcrypt)

### Temps Réel

| Technologie | Version | Justification |
|------------|---------|---------------|
| **Socket.io** | 4.8.3 | Bibliothèque pour la communication temps réel bidirectionnelle. |

**Pourquoi Socket.io et pas WebSocket natif ?**

- **Fallback automatique** : Socket.io gère automatiquement le fallback vers d'autres protocoles (long polling) si WebSocket n'est pas disponible
- **Reconnexion automatique** : Gère la reconnexion en cas de perte de connexion
- **Rooms & Namespaces** : Offre des fonctionnalités de haut niveau pour organiser les connexions
- **Broadcast** : Permet d'envoyer des messages à tous les clients ou à un sous-ensemble
- **Écosystème** : Large écosystème de middlewares et d'outils

**Cas d'usage dans Kaiju** :

- Notifications en temps réel des transactions
- Mises à jour live du statut des ressources
- Communication instantanée entre utilisateurs

**Implémentation (index.ts)** :

```typescript
const io = new Server(server);
io.on('connection', (socket) => {
  console.log('a user connected');
});
```

### Validation

| Technologie | Version | Justification |
|------------|---------|---------------|
| **Zod** | 4.6.5 | Bibliothèque de validation de schéma avec inférence de types TypeScript. |

**Pourquoi Zod et pas Joi, Yup, ou class-validator ?**

- **TypeScript First** : Zod est conçu pour TypeScript avec une **inférence automatique des types**
- **Schéma déclaratif** : API simple et intuitive pour définir des schémas
- **Performance** : Très performant, pas de dépendances lourdes
- **Validation + Transformation** : Permet à la fois de valider ET de transformer les données
- **Customisabilité** : Possibilité d'ajouter des validations personnalisées

**Exemple d'utilisation** :

```typescript
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type User = z.infer<typeof userSchema>; // Type TypeScript automatiquement généré
```

### Gestionnaire de Paquets

| Technologie | Version | Justification |
|------------|---------|---------------|
| **pnpm** | 11.21.0 | Gestionnaire de paquets rapide et économe en espace disque. |

**Pourquoi pnpm et pas npm ou yarn ?**

- **Espace disque** : pnpm utilise des **hard links** pour partager les dépendances entre projets, économisant jusqu'à 80% d'espace
- **Vitesse** : Installation plus rapide grâce à une meilleure gestion du cache
- **Sécurité** : Fichier lockfile (`pnpm-lock.yaml`) plus strict et déterministe
- **Workspaces** : Support natif des monorepos avec `pnpm-workspace.yaml`
- **Compatibilité** : 100% compatible avec npm, peut utiliser n'importe quel package npm

**Structure pnpm** :

```
backend/
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml

frontend/
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

### Containerisation

| Technologie | Version | Justification |
|------------|---------|---------------|
| **Docker** | 22-alpine | Image officielle Node.js basée sur Alpine Linux (légère). |

**Dockerfile Backend** :

```dockerfile
FROM node:22-alpine
WORKDIR /backend
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
CMD ["pnpm", "dev"]
```

**Pourquoi Alpine et pas Ubuntu ou Debian ?**

- **Taille réduite** : Alpine utilise musl libc et BusyBox, résultant en des images **beaucoup plus légères** (~100Mo vs ~1Go)
- **Sécurité** : Moins de paquets installés = surface d'attaque réduite
- **Compatibilité** : Node.js est parfaitement supporté sur Alpine

**Configuration Docker Compose** :

```yaml
services:
  db:
    image: postgres
    ports: ["9797:5432"]
    env_file: ["./backend/.env"]
    volumes: ["db_data:/var/lib/postgresql"]
  
  nodeback:
    build: ./backend
    ports: ["1919:9292"]
    depends_on: [db]
  
  nodefront:
    build: ./frontend
    ports: ["9001:9393"]
```

**Avantages** :

- **Isolation** : Chaque service (DB, backend, frontend) tourne dans son propre container
- **Portabilité** : L'application peut être déployée n'importe où (local, CI, production)
- **Reproductibilité** : Même environnement de développement pour toute l'équipe
- **Scaling** : Facile à scaler individuellement chaque service

---

## Frontend

### Framework

| Technologie | Version | Justification |
| ------------ | --------- | --------------- |
| **Next.js** | 16.3.5 | Framework React full-stack avec SSR, SSG, et routage file-based. |
| **React** | 19.2.8 | Bibliothèque UI composable pour construire des interfaces dynamiques. |

**Pourquoi Next.js et pas Create React App, Vite, ou Remix ?**

1. **Routing File-Based** :
   - Pas besoin de configurer manuellement les routes
   - Structure claire : `app/page.tsx` = `/`, `app/login/page.tsx` = `/login`
   - Support natif des **dynamic routes** et **nested layouts**

2. **Rendering Hybride** :
   - **SSR (Server-Side Rendering)** : Pour les pages qui nécessitent des données serveurs
   - **SSG (Static Site Generation)** : Pour les pages statiques (meilleur SEO et performance)
   - **Client-Side Rendering** : Pour les interactions dynamiques
   - **Incremental Static Regeneration (ISR)** : Mise à jour des pages statiques sans rebuild complet

3. **API Routes** :
   - Permet de créer des endpoints API directement dans le frontend
   - Utile pour les proxy vers le backend ou les serverless functions

4. **Optimisations Automatisées** :
   - **Code splitting** automatique
   - **Image optimization** (`next/image`)
   - **Font optimization** (`next/font`)
   - **Script optimization**

5. **Écosystème** :
   - Large communauté et documentation
   - Nombreuses intégrations (Tailwind, TypeScript, ESLint, etc.)
   - Support officiel de Vercel (créateurs de Next.js)

**Pourquoi React et pas Vue, Angular, ou Svelte ?**

- **Popularité** : React est le framework le plus utilisé, avec le plus grand écosystème
- **Flexibilité** : Approche composable, choix libre de bibliothèques
- **TypeScript Support** : Excellente intégration avec TypeScript
- **Performance** : Virtual DOM efficace pour les mises à jour
- **Communauté** : Vaste écosystème de hooks, contextes, et patterns

### UI & Styling

| Technologie | Version | Justification |
|------------|---------|---------------|
| **Tailwind CSS** | 4.0 | Framework utility-first CSS pour un stylage rapide et cohérent. |

**Pourquoi Tailwind CSS et pas Bootstrap, Material-UI, ou CSS Modules ?**

1. **Utility-First** :
   - Pas besoin de quitter son HTML/JSX pour écrire du CSS
   - Nommage des classes sémantique et cohérent
   - Exemple : `className="bg-blue-500 text-white p-4 rounded-lg"`

2. **Personnalisation Facile** :
   - Configuration via `tailwind.config.js`
   - Possibilité d'étendre les thèmes (couleurs, tailles, etc.)
   - Support des **design tokens**

3. **Pas de Noms de Classes à Inventer** :
   - Évite le problème de nommage des classes CSS
   - Pas de conflit de noms entre composants

4. **Purge CSS** :
   - Tailwind élimine automatiquement le CSS non utilisé en production
   - Résultat : fichier CSS très petit

5. **Intégration avec Next.js** :
   - Tailwind a une intégration officielle avec Next.js
   - Plugin PostCSS dédié (`@tailwindcss/postcss`)

**Configuration dans globals.css** :

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
```

**Polices** :

- **Geist** (Google Fonts) : Police moderne et lisible, utilisée par Vercel
- **Geist Mono** : Version monospace pour le code

### Gestionnaire de Paquets

| Technologie | Version | Justification |
|------------|---------|---------------|
| **pnpm** | 11.5.2 | Même que le backend, pour la cohérence et les mêmes avantages. |

**Package.json Frontend** :

```json
{
  "dependencies": {
    "next": "16.3.5",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "eslint": "^9",
    "eslint-config-next": "16.3.5"
  }
}
```

### Containerisation

**Dockerfile Frontend** :

```dockerfile
FROM node:22-alpine
WORKDIR /frontend
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
CMD ["pnpm", "dev"]
```

**Configuration Docker Compose** :

```yaml
nodefront:
  build:
    context: ./frontend
    dockerfile: dockerfile
  ports: ["9001:9393"]
  volumes:
    - ./frontend:/frontend
    - /frontend/node_modules
  environment:
    - CHOKIDAR_USEPOLLING=true
    - WATCHPACK_POLLING=true
    - CI=true
```

**Variables d'environnement** :

- `CHOKIDAR_USEPOLLING` et `WATCHPACK_POLLING` : Nécessaires pour le hot-reload dans Docker
- `CI=true` : Optimise certaines bibliothèques pour l'environnement CI

---

## Infrastructure

### Déploiement Base de Données

| Environnement | Configuration | Justification |
|---------------|---------------|---------------|
| **Développement** | PostgreSQL en container Docker | Facile à configurer, isolé, reproductible |
| **Production** | Railway (Prisma Cloud) | Service managé, scaling automatique, maintenance simplifiée |

**Configuration Railway (`.env` backend)** :

```env
DATABASE_URL="postgresql://postgres:MMVSfDJTubryJBxxHqtbTAviIlpzcqer@altaria.proxy.rlwy.net:46750/railway"
POSTGRES_USER=kaijuUser
POSTGRES_PASSWORD=kaijuPass
POSTGRES_DB=kaiju_DB
PORT=9292
```

**Pourquoi Railway ?**

- **Simplicité** : Déploiement en quelques clics depuis GitHub
- **Prisma Cloud Intégration** : Support natif de Prisma Cloud
- **Scaling Automatique** : La base de données scale automatiquement selon la charge
- **Backups Automatiques** : Sauvegardes régulières sans configuration
- **Monitoring** : Dashboard de monitoring intégré
- **Coût** : Gratuit pour les petits projets, puis scaling payant

**Architecture en Production** :

```
Client (Browser) 
  ↓ HTTPS
Frontend (Next.js sur Vercel/Netlify/Railway)
  ↓ HTTP/REST + WebSocket
Backend (Express sur Railway/Heroku)
  ↓ PostgreSQL
Database (Railway Postgres)
```

### Ports

| Service | Port Dev | Port Prod | Justification |
| --------- | ---------- | ----------- | --------------- |
| Backend | 9292 | 1919 (mappé sur 9292) | Port configuré dans `.env` |
| Frontend | 9393 | 9001 (mappé sur 9393) | Port configuré dans `next.config.ts` |
| PostgreSQL | 5432 | 9797 (mappé sur 5432) | Port standard PostgreSQL |

---

## Synthèse des Avantages

### Cohérence Technologique

| Aspect | Backend | Frontend | Bénéfice |
| -------- | --------- | ---------- | ---------- |
| **Langage** | TypeScript | TypeScript | Types partagés, meilleure maintenabilité |
| **Gestionnaire de paquets** | pnpm | pnpm | Cohérence, optimisation du cache |
| **Containerisation** | Docker | Docker | Déploiement uniformisé |
| **Node.js Version** | 22+ | 22+ | Compatibilité garantie |

### Modernité

- **Node.js 22** : Version LTS moderne avec les dernières features
- **TypeScript 5.9+** : Dernières améliorations du typage
- **Prisma ORM v8** : Nouvelle architecture Data Proxy
- **Next.js 16** : Dernières features du framework React
- **Tailwind CSS 4** : Version moderne avec @theme
- **React 19** : Dernière version stable de React

### Performance

- **Backend** : Express léger, Prisma optimisé, Node.js performant
- **Frontend** : Next.js (SSR/SSG), Tailwind (CSS minimal), React (Virtual DOM)
- **Base de données** : PostgreSQL optimisé pour les requêtes complexes
- **Docker** : Images Alpine légères

### Développeur Experience (DX)

- **Hot Reload** : nodemon (backend) + Next.js (frontend) pour un développement fluide
- **Typage Fort** : TypeScript partout, Zod pour la validation
- **Intégration IDE** : Excellente avec VS Code (autocomplétion, linting)
- **Outils Modernes** : ESLint, TypeScript, pnpm

### Production Ready

- **Sécurité** : JWT, bcrypt, cookies HTTP-only, CORS configuré
- **Fiabilité** : PostgreSQL ACID, transactions supportées
- **Scalabilité** : Architecture microservices (backend/DB séparés), Prisma Cloud
- **Monitoring** : Railway offre un dashboard complet

### Évolutivité

- **Ajout de Features** : Architecture modulaire (modules, controllers, services)
- **Changement de Scale** : Facile à passer à Kubernetes si besoin
- **Multi-Client** : API REST peut être consommée par mobile, desktop, etc.
- **Internationalisation** : TypeScript et Next.js supportent naturellement l'i18n

---

## Conclusion

Les choix technologiques pour le projet Kaiju forment une **stack moderne, cohérente et production-ready** :

- **Backend** : Node.js 22 + TypeScript + Express 5 + Prisma ORM v8 + PostgreSQL
- **Frontend** : Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript
- **Infrastructure** : Docker + Docker Compose + Railway
- **Outils** : pnpm, ESLint, TypeScript

Ces technologies ont été choisies pour leur :

1. **Modernité** (versions récentes, features avancées)
2. **Cohérence** (TypeScript partout, pnpm partout)
3. **Productivité** (DX excellente, hot reload, typage fort)
4. **Performance** (runtime optimisés, images Docker légères)
5. **Maintenabilité** (code type-safe, architecture modulaire)
6. **Scalabilité** (architecture adaptée à la croissance)

La combinaison de **Prisma Composer + Prisma Cloud** est particulièrement innovante et permet un déploiement simplifié tout en conservant une grande flexibilité.

La stack **Next.js + Tailwind CSS** pour le frontend offre un excellent compromis entre productivité, performance et personnalisation.

Enfin, l'utilisation de **TypeScript** dans toute la stack garantit une **qualité de code élevée** et réduit significativement le nombre de bugs en production.
