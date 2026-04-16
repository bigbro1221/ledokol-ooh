# OOH Dashboard — Ledokol Group

Outdoor advertising dashboard for Ledokol Group. Manages LED screens, static billboards, bus stops, airport placements, and transit ads across Uzbekistan.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v5 (credentials, JWT)
- **i18n:** next-intl (RU, EN, UZ, TR)
- **Styling:** Tailwind CSS
- **Storage:** MinIO (S3-compatible)
- **Deployment:** Docker + Docker Compose

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone <repo-url>
cd ooh
cp .env.example .env
npm install
```

### 2. Start database and services

```bash
docker compose up db minio -d
```

This starts PostgreSQL on port 5432 and MinIO on ports 9000/9001.

### 3. Set up the database

```bash
npx prisma db push
npx prisma generate
```

### 4. (Optional) Seed an admin user

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@ledokol.uz' },
    update: {},
    create: { email: 'admin@ledokol.uz', passwordHash: hash, role: 'ADMIN' },
  });
  console.log('Admin user created: admin@ledokol.uz / admin123');
}
main().finally(() => prisma.\$disconnect());
"
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Full Docker deployment

```bash
docker compose up --build
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

See [.env.example](.env.example) for all required variables.

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) section 13 for the full file structure convention.

## Build Phases

- **Phase 1** (current): Foundation — Next.js, Prisma, Auth, i18n, Docker, CI
- **Phase 2**: Admin CRM + XLSX parser
- **Phase 3**: Client dashboard charts
- **Phase 4**: Map + screens table
- **Phase 5**: Polish and launch
