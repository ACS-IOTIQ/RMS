# RosterOps — Enterprise Workforce Roster Management System

A full-stack enterprise workforce orchestration platform with intelligent auto-rostering, fairness scoring, leave-aware reallocation, and a modern, clean UI.

> **Stack:** Next.js 14 (App Router, TypeScript) + NestJS 10 + PostgreSQL 16 + Prisma + Tailwind + Radix UI + Recharts — all orchestrated via Docker Compose.

---

## 🚀 Quick Start

You only need **Docker** installed.

```bash
# 1. unzip the project
unzip roster-system.zip
cd roster-system

# 2. start everything
docker compose up -d --build

# 3. wait ~30s for services to boot, then open
# Frontend → http://localhost:3000
# Backend  → http://localhost:3001/api
```

The backend syncs the Prisma schema to Postgres (`prisma db push`) on boot. Fresh database volumes start empty: no demo users, employees, shifts, or organization data are inserted automatically.

---

## 📦 What's included

### Backend (NestJS) — `/backend`
- **Auth**: JWT (bearer token), bcrypt password hashing, `ADMIN` / `EMPLOYEE` roles, route-level role guards
- **Organizations / Projects / Locations / Departments / Designations**: full CRUD
- **Employees**: CRUD, search, status filter, bulk-friendly schema, employee lifecycle states (`ACTIVE`, `ON_LEAVE`, `RESIGNED`, …)
- **Shifts**: CRUD + per-shift designation requirements (e.g. "Night shift needs 1× L4, 2× L3")
- **Roster engine**: auto-generation across a date range, fairness scoring (60-day allocation history), leave-aware exclusion, critical-shift prioritization, designation requirement enforcement, gap reporting
- **Leaves**: apply / approve / reject, cascade-cancel impacted roster entries on approval
- **Analytics**: workforce overview, status & designation breakdowns, shift distribution, fairness (night-shift load), monthly leave trends

### Frontend (Next.js 14) — `/frontend`
- **Login** with split-screen brand panel, **Register** with employee-code linking
- **Admin portal**: Dashboard, Employees, Organizations, Projects, Locations, Designations, Shifts (with requirements editor), Roster (auto-generate + grid + coverage), Leaves (approve/reject), Analytics
- **Employee portal**: Dashboard (today/tomorrow shifts, night-shift count), My Roster (month calendar), My Leaves (apply + history), Profile
- Tailwind + Radix UI + shadcn-style components, Recharts charts, lucide-react icons
- Light/dark color tokens, responsive layout, persistent sidebar with role-aware nav

### Infra — `docker-compose.yml`
- `postgres` — Postgres 16 Alpine, healthchecked, named volume
- `backend` — Node 20 Alpine, multi-stage build, runs `prisma db push` (schema sync) → `node dist/main.js`
- `frontend` — Node 20 Alpine, builds Next.js production bundle, served on port 3000

---

## 🧠 The Roster Engine (in brief)

The auto-generator at `POST /api/roster/generate` does this for each day in the range:

1. Load active employees in the location.
2. Exclude employees with **approved** leaves overlapping the day.
3. Sort shifts: critical shifts first.
4. For each shift's designation requirements (`{ designationId, minCount }`):
   - Find eligible employees (matching designation, not on leave, not yet assigned today).
   - Rank by **fairness**: least allocations to *this* shift in the last 60 days, then least overall.
   - Pick top `minCount`.
5. Report any gaps (e.g. "2025-05-12 C: need 1 of designation, only 0 available").

`mode: "overwrite"` (default) clears existing entries in range; `mode: "fill-gaps"` preserves them.

---

## 🛠️ API Reference (high level)

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

| Resource         | Routes                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| Auth             | `POST /auth/login`, `POST /auth/register`, `GET /auth/me`                 |
| Organizations    | `GET/POST/PUT/DELETE /organizations[/:id]`                                |
| Projects         | `GET/POST/PUT/DELETE /projects[/:id]?organizationId=…`                    |
| Locations        | `GET/POST/PUT/DELETE /locations[/:id]?projectId=…`                        |
| Departments      | `GET/POST/PUT/DELETE /departments[/:id]?projectId=…`                      |
| Designations     | `GET/POST/PUT/DELETE /designations[/:id]`                                 |
| Employees        | `GET/POST/PUT/DELETE /employees[/:id]?q=&status=&projectId=&locationId=`  |
| Shifts           | `GET/POST/PUT/DELETE /shifts[/:id]?locationId=…`                          |
|                  | `PUT /shifts/:id/requirements` — `{ items: [{designationId, minCount}] }` |
| Roster           | `GET /roster?from=&to=&locationId=&employeeId=`                           |
|                  | `GET /roster/my?from=&to=` *(employee scope)*                             |
|                  | `GET /roster/coverage?locationId=&date=`                                  |
|                  | `POST /roster/generate` — `{ locationId, startDate, endDate, mode? }`     |
|                  | `POST /roster/assign` — `{ employeeId, shiftId, date, notes? }`           |
| Leaves           | `GET /leaves?status=&employeeId=`, `GET /leaves/my`                       |
|                  | `POST /leaves` — `{ type, startDate, endDate, reason? }`                  |
|                  | `PUT /leaves/:id/decision` — `{ status: APPROVED \| REJECTED }`           |
| Analytics        | `GET /analytics/{overview,status,designations,shifts,leaves,fairness}`    |

Mutations (POST/PUT/DELETE) on most resources require **ADMIN**.

---

## 🧑‍💻 Local development (without Docker)

If you'd rather run things on the host:

```bash
# 1. Postgres
docker run -d --name pg -e POSTGRES_USER=roster -e POSTGRES_PASSWORD=rosterpass -e POSTGRES_DB=roster_db -p 5432:5432 postgres:16-alpine

# 2. Backend
cd backend
npm install
export DATABASE_URL="postgresql://roster:rosterpass@localhost:5432/roster_db?schema=public"
export JWT_SECRET="dev"
npx prisma db push
npm run start:dev

# 3. Frontend (new terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev
```

---

## ⚙️ Configuration

All wiring is in `docker-compose.yml`. Key envs:

| Variable               | Default                                  | Notes                                      |
| ---------------------- | ---------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`         | `postgresql://roster:rosterpass@…`       | Backend's DB connection                    |
| `JWT_SECRET`           | `change-this-jwt-secret-in-production…`  | **Change for production**                  |
| `JWT_EXPIRES_IN`       | `7d`                                     | JWT lifetime                               |
| `CORS_ORIGIN`          | `http://localhost:3000`                  | Comma-separated allowed origins            |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:3001`                  | What the browser calls (set at build time) |

---

## 🗂️ Project layout

```
roster-system/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   └── schema.prisma     ← 13 models, full enum set
│   └── src/
│       ├── main.ts, app.module.ts
│       ├── prisma/           ← Prisma service (global)
│       ├── auth/             ← JWT strategy, guards, decorators
│       ├── organizations/, projects/, locations/, departments/,
│       │   designations/, employees/, shifts/   ← CRUD modules
│       ├── rosters/          ← Auto-gen engine + coverage
│       ├── leaves/           ← Apply / approve / cascade-cancel
│       └── analytics/        ← Aggregations for charts
└── frontend/
    ├── Dockerfile
    ├── next.config.js, tailwind.config.ts, tsconfig.json, postcss.config.js
    └── src/
        ├── lib/              ← api.ts (fetch + JWT), auth-context.tsx, utils.ts
        ├── components/       ← sidebar, topbar, ui/* (button, card, dialog, …)
        └── app/
            ├── layout.tsx, page.tsx
            ├── login/, register/
            ├── admin/        ← layout + 10 admin pages
            └── employee/     ← layout + 4 employee pages
```

---

## 🧯 Troubleshooting

**"Cannot connect to backend" on frontend**
The frontend talks to `NEXT_PUBLIC_API_URL` from your *browser*. With docker-compose it's set to `http://localhost:3001`, which works because port 3001 is exposed on the host. If you change ports, rebuild the frontend image.

**Backend keeps restarting**
Check `docker compose logs backend`. The backend waits for Postgres to pass its healthcheck, then runs `prisma db push` before starting the API. On slow hardware, Postgres may take longer than usual to become healthy.

**Reset the database**
```bash
docker compose down -v   # the -v drops the database volume
docker compose up -d --build
```

**Port conflicts on 3000/3001/5432**
Edit the `ports:` mappings in `docker-compose.yml`.

---

## 📋 What the PRD called for vs. what's here

This is a substantial first cut covering the **core 10 modules** with shallower coverage of each:

✅ Organization / Project / Location / Department / Designation management
✅ Employee management with lifecycle states
✅ Shift configuration with type, distribution, designation requirements
✅ **Intelligent auto-rostering with fairness scoring**
✅ Leave application & approval with roster cascade
✅ Coverage view (shift staffing per day)
✅ Admin analytics (workforce, fairness, shift distribution)
✅ Employee self-service portal (calendar, leaves, profile)
✅ JWT auth with Admin/Employee roles

🔜 Not yet implemented (from PRD): swap workflow, notifications/SMS/email, geo-based assignment, predictive fatigue detection, full audit log, bulk CSV upload UI, biometric attendance sync, AI/ML forecasting, multi-tenant org isolation. The data model already supports many of these (e.g. `Notification`, `RosterEntry.status = SWAPPED`) — they need UI and service wiring.

---

Built as a starting point for a real enterprise workforce platform — extend confidently.
