# RosterOps Executive Demo Guide

## 1. Demo Purpose

This demo shows how RosterOps converts workforce data, shift definitions, designation staffing requirements, leave inputs, and roster policy rules into a validated weekly roster.

The executive story is simple:

- The organization defines operational structure once.
- The project defines where work happens and which employees belong to it.
- The roster policy defines how many people are needed per shift and designation.
- The roster engine generates a weekly plan, validates gaps, suggests replacements, and preserves audit history.
- Admins and employees see the same operational truth from different views.

Recommended live demo week: `2026-05-25` to `2026-05-31`.

This week currently has:

- `58` eligible employees
- `0` critical validation issues
- `4` warning-level replacement gaps

## 2. Current Demo Database Snapshot

Snapshot source: local Docker PostgreSQL database on `2026-05-14`.

| Area | Current Count |
|---|---:|
| Organizations | 1 |
| Projects | 1 |
| Locations | 8 |
| Departments | 1 |
| Designations | 18 |
| Employees | 58 |
| Shifts | 4 |
| Roster Policies | 2 |
| Active Designation Requirements | 42 |

## 3. Demo Organization And Project

| Field | Value |
|---|---|
| Organization | Defense-ARMY |
| Organization Code | ORG-0001 |
| Project | DC-DR-O&M |
| Project Code | PROJ-0001 |
| Client | Open Text |
| Timezone | Asia/Kolkata |
| Project Employees | 58 |
| Project Locations | 8 |
| Project Shifts | 4 |
| Project Departments | 1 |

Locations configured under `DC-DR-O&M`:

| Location | Capacity | Employees | Shifts | Departments | Roster Policy |
|---|---:|---:|---:|---:|---:|
| Banglore | 58 | 58 | 4 | 1 | 1 |
| Chandimandir | 58 | 0 | 0 | 0 | 1 |
| Delhi | 58 | 0 | 0 | 0 | 0 |
| Jaipur | 58 | 0 | 0 | 0 | 0 |
| Kolkata | 58 | 0 | 0 | 0 | 0 |
| Lucknow | 58 | 0 | 0 | 0 | 0 |
| Pune | 58 | 0 | 0 | 0 | 0 |
| Udhampur | 58 | 0 | 0 | 0 | 0 |

Note: `Banglore` is the current spelling stored in the database.

## 4. System Flow

### Step 1: Organization Setup

Create the top-level organization. In this demo, the organization is `Defense-ARMY`.

Purpose:

- Holds one or more operational projects.
- Allows future separation of clients, regions, or business units.

### Step 2: Project Setup

Create the operating project. In this demo, the project is `DC-DR-O&M`.

Purpose:

- Groups locations, employees, departments, and roster policies.
- Keeps employee assignment scoped to the correct project.

### Step 3: Location Setup

Create operational locations under the project. In this demo, `Banglore` is the active staffed location.

Purpose:

- Defines where shifts and employees are rostered.
- Holds location capacity and local operational configuration.

### Step 4: Designation Setup

Create workforce designations such as `T1 OSS`, `T1 EMS`, `T4 Server Engineer`, and `T4 DR/BCP`.

Purpose:

- Defines employee skill or responsibility category.
- Used by the roster policy to require exact coverage by designation.

Current Banglore designation distribution:

| Designation | Employees |
|---|---:|
| T1 EMS | 7 |
| T1 OSS | 7 |
| T1 SOC | 7 |
| T2 EMS | 2 |
| T2 OSS | 2 |
| T2 SOC | 2 |
| T3 EMS | 1 |
| T3 OSS | 1 |
| T3 SOC | 2 |
| T4 DC-Infra (Non -IT) | 6 |
| T4 DR/BCP | 3 |
| T4 EMS | 1 |
| T4 Networking Engineer | 3 |
| T4 OSS | 1 |
| T4 SOC | 4 |
| T4 Server Engineer | 3 |
| T4 Storage & Backup Engineer | 3 |
| T4 Virtualization and Cloud Engineer | 3 |

### Step 5: Shift Setup

Shifts define time windows. Staffing counts are not configured here. Staffing counts are configured only in Roster Policy.

| Code | Display Name | Time | Distribution | Demo Color |
|---|---|---|---:|---|
| A | Morning | 06:00 to 14:00 | 40% | Blue |
| B | Afternoon | 14:00 to 22:00 | 40% | Amber |
| C | Night | 22:00 to 06:00 | 20% | Indigo |
| G | General / Backup | 06:00 to 06:00 | 0% | Green |

### Step 6: Employee Setup

Employees are uploaded or entered with:

- Employee code
- Name and email
- Project
- Location
- Designation
- Optional department
- Workforce category
- Reporting manager

Current Banglore employee status:

| Status | Workforce Category | Count |
|---|---|---:|
| ACTIVE | PRIMARY | 58 |

### Step 7: Roster Policy Setup

Roster Policy is the main control point for weekly roster generation.

Current `Banglore` policy:

| Policy Setting | Value |
|---|---|
| Required Daily Headcount | 49 |
| Working Days Per Employee | 6 |
| Weekly Offs Per Employee | 1 |
| Week Start Day | MONDAY |
| Minimum Rest Hours | 12 |
| Shift Distribution | Morning 40%, Afternoon 40%, Night 20% |
| Rounding Policy | LARGEST_REMAINDER_DESIGNATION_PRIORITY |
| General Buffer Enabled | Yes |
| Extra Duty Allowed | Yes |
| Overtime Allowed | Yes |

Designation requirement summary:

| Shift | Required Per Day | Designation Rows |
|---|---:|---:|
| Morning | 23 | 18 |
| Afternoon | 15 | 14 |
| Night | 11 | 10 |

Full designation requirement matrix:

| Designation | Morning | Afternoon | Night | Total |
|---|---:|---:|---:|---:|
| T1 EMS | 2 | 1 | 1 | 4 |
| T1 OSS | 2 | 1 | 1 | 4 |
| T1 SOC | 2 | 1 | 1 | 4 |
| T2 EMS | 1 | 1 | 0 | 2 |
| T2 OSS | 1 | 1 | 0 | 2 |
| T2 SOC | 1 | 1 | 0 | 2 |
| T3 EMS | 1 | 0 | 0 | 1 |
| T3 OSS | 1 | 0 | 0 | 1 |
| T3 SOC | 1 | 1 | 0 | 2 |
| T4 DC-Infra (Non -IT) | 2 | 2 | 2 | 6 |
| T4 DR/BCP | 1 | 1 | 1 | 3 |
| T4 EMS | 1 | 0 | 0 | 1 |
| T4 Networking Engineer | 1 | 1 | 1 | 3 |
| T4 OSS | 1 | 0 | 0 | 1 |
| T4 SOC | 2 | 1 | 1 | 4 |
| T4 Server Engineer | 1 | 1 | 1 | 3 |
| T4 Storage & Backup Engineer | 1 | 1 | 1 | 3 |
| T4 Virtualization and Cloud Engineer | 1 | 1 | 1 | 3 |

### Step 8: Weekly Roster Generation

For the executive demo:

1. Open `Roster`.
2. Collapse the sidebar to increase workspace.
3. Select project `DC-DR-O&M`.
4. Select location `Banglore`.
5. Select week start `2026-05-25`.
6. Click `Preview`.
7. Show the Weekly Matrix with shift names:
   - Morning
   - Afternoon
   - Night
   - General
   - OFF
8. Show summary:
   - Eligible employees
   - Daily headcount
   - Required slots
   - Available slots
   - Extra or shortage
   - Fairness score
9. Scroll to validation at the bottom.

Latest preview state:

| Week | Status | Eligible Employees | Required Weekly Slots | Available Weekly Slots | Extra Slots | Criticals | Warnings |
|---|---|---:|---:|---:|---:|---:|---:|
| 2026-05-25 to 2026-05-31 | PREVIEWED | 58 | 343 | 348 | 5 | 0 | 4 |
| 2026-05-18 to 2026-05-24 | PREVIEWED | 58 | 343 | 348 | 5 | 0 | 4 |
| 2026-05-11 to 2026-05-17 | VALIDATION_FAILED | 0 | 343 | 0 | -343 | 30 | 349 |

The `2026-05-11` week is useful only as a validation demo. It fails because employees joined on `2026-05-13`, after that week started.

Latest weekly assignment distribution:

| Shift | Weekly Assigned Employees |
|---|---:|
| Morning | 27 |
| Afternoon | 18 |
| Night | 13 |

## 5. Current Warning Explanation

The latest clean demo week has zero criticals and four warnings.

Warnings:

| Date | Warning |
|---|---|
| 2026-05-25 | Morning has unresolved T3 EMS coverage gap |
| 2026-05-26 | Morning has unresolved T3 OSS coverage gap |
| 2026-05-27 | Morning has unresolved T4 OSS coverage gap |
| 2026-05-31 | Morning has unresolved T4 EMS coverage gap |

Executive explanation:

These are not system failures. They are real staffing signals.

Each of these designations has only one employee in the database:

| Designation | Current Employees |
|---|---:|
| T3 EMS | 1 |
| T3 OSS | 1 |
| T4 EMS | 1 |
| T4 OSS | 1 |

The policy requires one person from each of those designations on Morning shift. When the only person in that designation takes a weekly off, the system cannot find another same-designation replacement. It marks the gap as a warning so management can decide whether to:

- Add backup employees for those designations.
- Reduce the requirement on specific shifts.
- Allow equivalent-role substitution.
- Approve overtime or manual replacement.

## 6. What To Show In The Demo

### Opening Narrative

RosterOps gives leadership a single control plane for workforce scheduling. It connects the workforce master data, designation requirements, weekly-off rules, shift timing, leave management, and audit trail into one operational roster.

### Demo Path

1. Dashboard
   - Show the application landing area for operational oversight.

2. Organization and Project
   - Show `Defense-ARMY` and `DC-DR-O&M`.
   - Explain that projects isolate workforce and policy.

3. Locations
   - Show `Banglore` as the active staffed location.
   - Mention other locations are configured for future expansion.

4. Designations
   - Show the skill hierarchy and critical tags.
   - Explain that staffing counts are not managed here.

5. Shifts
   - Show Morning, Afternoon, Night, and General.
   - Explain that shifts define time windows only.

6. Employees
   - Show employees mapped to project, location, and designation.
   - Mention bulk upload supports new designations and optional departments.

7. Roster Policy
   - Show daily headcount, weekly offs, shift distribution, and designation requirements.
   - Explain that this is the source of truth for required staffing.

8. Roster
   - Collapse sidebar.
   - Select `DC-DR-O&M`, `Banglore`, week `2026-05-25`.
   - Preview the roster.
   - Show Morning, Afternoon, Night color coding.
   - Show validation at bottom.

9. Leave Management
   - Explain employee leave request and reporting-manager approval flow.

10. Audit Logs
   - Show that admin can see system actions.
   - Explain basic tamper-evident hash chain.

## 7. Admin And Employee Experience

### Admin

Admin can:

- Configure organizations, projects, locations, departments, designations, shifts, and roster policy.
- Upload employees in bulk.
- Generate and validate rosters.
- Publish rosters after resolving critical issues.
- Reset employee passwords.
- View audit logs.

### Employee

Employee can:

- View assigned roster.
- Apply for leave.
- Track leave status.
- Change own password.
- View profile and reporting structure.

Configured demo accounts:

| Account Type | Count | Login Pattern |
|---|---:|---|
| Admin | 1 | `admin@roster.com` |
| Employee portal users | 58 | Employee email address |

Employee demo password: `Employee@123`

Sample employee logins:

| Employee | Email |
|---|---|
| Aarav Sharma | `aarav.sharma@roster.com` |
| Vivaan Reddy | `vivaan.reddy@roster.com` |
| Aditya Kumar | `aditya.kumar@roster.com` |
| Arjun Verma | `arjun.verma@roster.com` |

## 8. Demo Talking Points For Senior Executives

Use these messages during the demo:

- "The roster is generated from policy, not manually assembled row by row."
- "Critical issues block publishing. Warnings show operational risk without stopping the workflow."
- "Designation requirements are centralized in Roster Policy, making it clear who is needed per shift."
- "The system highlights where the organization has single-person dependency risk."
- "Audit logs create accountability for operational changes."
- "The collapsed sidebar and full-width roster make the schedule easier to review in executive demos."

## 9. Pre-Demo Checklist

Before presenting:

- Start the application with Docker.
- Use a clean browser session or hard refresh.
- Confirm the sidebar can collapse and reopen.
- Open `Roster`.
- Select project `DC-DR-O&M`.
- Select location `Banglore`.
- Use week start `2026-05-25`.
- Click `Preview`.
- Confirm the Weekly Matrix shows Morning, Afternoon, Night, and OFF.
- Scroll to the bottom and explain the four warnings as staffing-risk signals.

## 10. Executive Summary Close

RosterOps demonstrates a policy-driven workforce rostering platform for operational projects. The current demo database contains a complete staffed location with 58 active primary employees, 18 designations, 4 configured shifts, and a roster policy requiring 49 daily operational employees.

The latest roster preview is publish-ready from a critical validation perspective. Remaining warnings are useful management insights: they identify roles where only one employee exists for a required designation, creating weekly-off coverage risk.

This makes the demo strong for senior executives because it shows both automation and decision intelligence: the system can build the roster, explain the gaps, and guide what management should fix next.
