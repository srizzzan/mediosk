# SIH 2026 PS 26047 — Patient Case-Taking Platform (Foundation)

This repository contains the foundation scaffold for the Patient Case-Taking Platform using Next.js, TypeScript, Tailwind CSS, and Prisma with PostgreSQL. It includes secure authentication (NextAuth with credentials + bcrypt), server-side role-based authorization for three roles: PATIENT, DOCTOR, HOSPITAL.

Key files:
- Prisma schema: `prisma/schema.prisma`
- Auth route: `src/pages/api/auth/[...nextauth].ts`
- Dashboards: `src/pages/dashboard/*`

Environment variables (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — URL of the site (e.g. `http://localhost:3000`)
- `NEXTAUTH_SECRET` — strong random secret

Install and run:

```bash
npm install
npx prisma generate
npx prisma db push # or `npx prisma migrate dev` to create migrations
npm run dev
```
