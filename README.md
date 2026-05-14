# RosterOps - Enterprise Roster Management System

RosterOps is a full-stack workforce roster management platform for project-based operations. It helps teams configure organizations, projects, locations, shifts, designations, employees, roster policies, leave approvals, audit logs, and employee self-service from one system.

The current implementation is designed for operations where employees are mapped to projects and locations, and where roster planning must support both location-level staffing and project-level designation coverage across multiple locations.

## Tech Stack

### Frontend

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Radix UI primitives
- shadcn-style local UI components
- lucide-react icons
- Recharts for analytics visualizations
- xlsx for Excel import/export flows

### Backend

- NestJS 10
- TypeScript
- Prisma ORM
- PostgreSQL 16
- JWT authentication
- Passport JWT strategy
- bcrypt password hashing
- class-validator and class-transformer for DTO validation
- xlsx for Excel exports

### Infrastructure

- Docker Compose
- Node.js 20 Alpine images
- PostgreSQL 16 Alpine
- Prisma `db push` schema sync on backend container startup
- GitHub Actions deployment workflow using SSH password authentication

## Main Features

### Admin Portal

- Dashboard for high-level workforce and roster visibility.
- Organization management.
- Project management with employee assignment support.
- Location management.
- Department management.
- Designation management.
- Shift management.
- Employee management with search, filters, status, project, location, department, designation, and reporting manager mapping.
- Employee bulk upload support with relaxed department/designation handling.
- Roster policy configuration.
- Multi-location designation planning.
- Weekly roster preview and publish flow.
- Leave management and reporting-manager approval flow.
- Audit logs visible to admins.
- Admin password reset for employees.

### Employee Portal

- Employee dashboard.
- Published roster calendar.
- Leave request submission and status tracking.
- Profile page with project, location, designation, department, reporting manager, and account details.
- Self password change.

### Roster Policy

Roster policy is the central place for roster rules:

- Required daily headcount.
- Working days per employee.
- Weekly off count.
- Week start day.
- Minimum rest hours.
- Shift distribution.
- General/buffer rules.
- Overtime and extra-duty flags.
- Designation requirements by shift.
- Excel-style designation requirement upload/download.

Designation staffing counts are configured in Roster Policy, not in Shifts or Designations.

### Multi-Location Designation Planning

The All Locations mode in Roster Policy supports project-level designation planning:

- Locations are shown as grouped headers.
- Morning, Afternoon, and Night appear under every location.
- Designations appear as rows.
- The grid works like an Excel-style planning table.
- Generate Coverage fills computed values directly into the grid.
- Manual edits override generated values.
- Apply to Locations writes effective grid counts into individual location policies.
- Project-level shared coverage allows a designation to be present across shifts somewhere in the project, instead of forcing every location to cover every designation in every shift.

Coverage generation uses active employees by `project + location + designation`:

- 7 employees with 40/40/20 distribution becomes `3 / 3 / 1`.
- 4 employees becomes `2 / 1 / 1`.
- 3 employees becomes `1 / 1 / 1`.
- 2 employees are balanced across the lowest-covered shifts.
- 1 employee is assigned to one shift only.

### Roster Generation

The weekly roster engine uses location-level policy and designation requirements as the source of truth. All Locations planning affects roster generation only after the user applies grid counts to individual locations.

Roster generation considers:

- Active primary employees.
- Project and location mapping.
- Designation requirements.
- Working days and weekly offs.
- Shift distribution.
- Minimum rest hour rules.
- Leave conflicts.
- Published roster visibility for employee portal.
- Validation issues and warning signals.

### Leave Management

- Employees can submit leave requests.
- Each employee can have a reporting manager.
- Leave approval requests are routed for manager/admin decision.
- Approved leave affects roster availability.

### Audit Logs

The system records important actions such as:

- Create/update/delete operations.
- Roster policy changes.
- Multi-location policy generate/save/apply/export events.
- Leave decisions.
- Password changes and resets.

Audit logs include basic tamper-evident metadata for administrative review.

## Current Project Structure

```text
roster-system/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── analytics/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── departments/
│   │   ├── designations/
│   │   ├── employees/
│   │   ├── leaves/
│   │   ├── locations/
│   │   ├── organizations/
│   │   ├── prisma/
│   │   ├── projects/
│   │   ├── roster-policies/
│   │   ├── rosters/
│   │   └── shifts/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/
│   │   │   ├── employee/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── components/
│   │   └── lib/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── deploy.yaml
└── README.md
```

## Quick Start With Docker

Install Docker Desktop or Docker Engine, then run:

```bash
docker compose up -d --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001/api`
- PostgreSQL: `localhost:5432`

The backend container runs:

```bash
npx prisma db push --accept-data-loss --skip-generate
node dist/main.js
```

That means the database schema is synced automatically when the backend starts.

## Clean Database Reset

To remove all database data and rebuild from scratch:

```bash
docker compose down -v
docker compose up -d --build
```

The `-v` flag removes the PostgreSQL Docker volume.

## Local Development Without Docker

### 1. Start PostgreSQL

```bash
docker run -d \
  --name roster_postgres_dev \
  -e POSTGRES_USER=roster \
  -e POSTGRES_PASSWORD=rosterpass \
  -e POSTGRES_DB=roster_db \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Start Backend

```bash
cd backend
npm install
```

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://roster:rosterpass@localhost:5432/roster_db?schema=public"
$env:JWT_SECRET="change-this-in-development"
$env:JWT_EXPIRES_IN="7d"
$env:CORS_ORIGIN="http://localhost:3000"
npx prisma generate
npx prisma db push
npm run start:dev
```

Bash:

```bash
export DATABASE_URL="postgresql://roster:rosterpass@localhost:5432/roster_db?schema=public"
export JWT_SECRET="change-this-in-development"
export JWT_EXPIRES_IN="7d"
export CORS_ORIGIN="http://localhost:3000"
npx prisma generate
npx prisma db push
npm run start:dev
```

Backend runs at:

```text
http://localhost:3001/api
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:3000
```

## Environment Variables

### Backend

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://roster:rosterpass@postgres:5432/roster_db?schema=public` |
| `JWT_SECRET` | JWT signing secret | `change-this-in-production` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `PORT` | Backend port | `3001` |
| `CORS_ORIGIN` | Allowed frontend origins | `http://localhost:3000` |
| `ORG_CODE_PREFIX` | Organization code prefix | `ORG` |
| `ORG_CODE_PAD` | Organization code padding | `4` |
| `PROJECT_CODE_PREFIX` | Project code prefix | `PROJ` |
| `PROJECT_CODE_PAD` | Project code padding | `4` |

### Frontend

| Variable | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Browser API base URL | `http://localhost:3001` |

## Docker Services

### `postgres`

- Image: `postgres:16-alpine`
- Port: `5432`
- Healthcheck enabled.
- Data stored in named volume `postgres_data`.

### `backend`

- Builds from `backend/Dockerfile`.
- Port: `3001`.
- Depends on healthy Postgres.
- Runs Prisma schema sync on startup.

### `frontend`

- Builds from `frontend/Dockerfile`.
- Port: `3000`.
- Uses `NEXT_PUBLIC_API_URL` at build time.

## Useful Commands

```bash
# Start all services
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Stop and remove database volume
docker compose down -v

# Rebuild backend only
docker compose up -d --build backend

# Rebuild frontend only
docker compose up -d --build frontend
```

## Backend Build And Prisma

```bash
cd backend
npm run build
npx prisma generate
npx prisma validate
```

When running Prisma locally, set `DATABASE_URL` first.

## Frontend Build

```bash
cd frontend
npm run build
```

## API Overview

All backend routes are prefixed with `/api`.

Authentication uses:

```text
Authorization: Bearer <token>
```

High-level modules:

| Module | Purpose |
|---|---|
| `/auth` | Login, register, current user, password flows |
| `/organizations` | Organization CRUD |
| `/projects` | Project CRUD and employee assignment |
| `/locations` | Location CRUD and workforce views |
| `/departments` | Department CRUD |
| `/designations` | Designation CRUD |
| `/employees` | Employee CRUD, filters, bulk upload |
| `/shifts` | Shift CRUD |
| `/roster-policies` | Location and all-location roster policy configuration |
| `/roster` | Roster preview, publish, export, coverage, employee roster |
| `/leaves` | Leave requests and approvals |
| `/analytics` | Dashboard and operational analytics |
| `/audit-logs` | Admin audit log review |

## Deployment With GitHub Actions

The repository includes `.github/workflows/deploy.yaml`.

The workflow:

1. Runs backend build.
2. Runs frontend build.
3. SSHs into the server using password authentication.
4. Pulls latest code using token-based Git authentication.
5. Runs:

```bash
docker compose up -d --build
```

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `SERVER_HOST` | Server hostname or IP |
| `SERVER_PORT` | SSH port, usually `22` |
| `SERVER_USER` | SSH username |
| `SERVER_PASSWORD` | SSH password |
| `DEPLOY_PATH` | Absolute path to the repo on the server |
| `GIT_TOKEN` | GitHub token with repository read access |
| `GIT_REPO` | Repository slug, for example `owner/repo` |
| `DEPLOY_BRANCH` | Branch to deploy, for example `main` |

### Server Requirements

The server should have:

- Docker installed.
- Docker Compose plugin installed.
- Git installed.
- The repo already cloned at `DEPLOY_PATH`, or an empty directory ready for the workflow to clone into.
- SSH password login enabled for the deployment user.

## Production Notes

- Change `JWT_SECRET` before production use.
- Use HTTPS and a real domain for the frontend.
- Set `CORS_ORIGIN` to the production frontend URL.
- Keep database backups before running schema changes.
- Review `docker-compose.yml` before using `--accept-data-loss` in a production database.
- Prefer a reverse proxy such as Nginx or Caddy in front of the containers for TLS.

## Troubleshooting

### Frontend cannot reach backend

Check that `NEXT_PUBLIC_API_URL` points to the backend URL reachable from the browser.

For Docker Compose local usage:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend cannot connect to database

Check:

```bash
docker compose ps
docker compose logs postgres
docker compose logs backend
```

Confirm `DATABASE_URL` points to `postgres` inside Docker Compose, not `localhost`.

### Prisma validation fails locally

Set `DATABASE_URL` first:

```powershell
$env:DATABASE_URL="postgresql://roster:rosterpass@localhost:5432/roster_db?schema=public"
npx prisma validate
```

### Need a completely clean environment

```bash
docker compose down -v
docker compose up -d --build
```

## Demo Notes

For the current demo database, the project is `DC-DR-O&M` and the staffed location name is stored as `Banglore`.

The executive demo guide is available at:

```text
docs/EXECUTIVE_DEMO_GUIDE.md
```

## License

Private/internal project unless a license file is added.
