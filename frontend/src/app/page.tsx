import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  Fingerprint,
  GitBranch,
  Layers3,
  LockKeyhole,
  MapPinned,
  Network,
  ShieldCheck,
  Sparkles,
  Users2,
} from 'lucide-react';

const features = [
  { icon: Users2, title: 'Employee Master Data', text: 'Manage employees, project mapping, location assignment, designation, department, status, reporting manager, and profile details.' },
  { icon: Layers3, title: 'Organization Setup', text: 'Configure organizations, projects, locations, departments, designations, and shifts with clean operational boundaries.' },
  { icon: Network, title: 'Multi-Location Coverage', text: 'Plan designation coverage across locations so project-level Morning, Afternoon, and Night availability is visible in one grid.' },
  { icon: CalendarCheck2, title: 'Weekly Roster Engine', text: 'Preview, validate, publish, and export weekly rosters using policy-driven headcount and designation requirements.' },
  { icon: ClipboardList, title: 'Roster Policy', text: 'Control daily headcount, working days, weekly offs, rest rules, shift distribution, and designation requirements from one module.' },
  { icon: FileSpreadsheet, title: 'Excel Workflows', text: 'Download templates, upload bulk employee data, and manage designation requirement matrices with spreadsheet-friendly flows.' },
  { icon: Clock3, title: 'Leave Approvals', text: 'Employees apply for leave and requests move through reporting-manager or admin approval before affecting roster availability.' },
  { icon: ShieldCheck, title: 'Audit Trail', text: 'Admin-visible audit logs capture important actions and policy changes for operational accountability.' },
  { icon: LockKeyhole, title: 'Role-Based Portals', text: 'Admins manage operations while employees view published rosters, submit leave, and maintain account details.' },
];

const flow = [
  'Create organization, project, and locations',
  'Upload employees and map designations',
  'Configure shifts and roster policy',
  'Generate multi-location coverage',
  'Preview and publish weekly roster',
];

const stats = [
  ['58', 'demo employees'],
  ['8', 'locations'],
  ['18+', 'designations'],
  ['3', 'operational shifts'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <section className="relative min-h-[92vh] overflow-hidden bg-[#e9f4f2]">
        <div className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-20 bg-white/70" />
          <div className="absolute left-1/2 top-24 h-[560px] w-[1100px] -translate-x-1/2 rounded-[36px] border border-white/80 bg-white/55 shadow-2xl shadow-slate-300/40 backdrop-blur">
            <div className="grid h-full grid-cols-[240px_1fr]">
              <div className="border-r border-slate-200/80 bg-slate-950 p-5 text-white">
                <div className="mb-8 flex items-center gap-2 font-semibold">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400 text-slate-950">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  RosterOps
                </div>
                {['Dashboard', 'Organization', 'Projects', 'Locations', 'Employees', 'Roster Policy', 'Roster', 'Leaves'].map((item, index) => (
                  <div key={item} className={`mb-2 rounded-md px-3 py-2 text-sm ${index === 5 ? 'bg-white text-slate-950' : 'text-slate-300'}`}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-500">DC-DR-O&M</div>
                    <div className="text-2xl font-semibold">All Locations Coverage Matrix</div>
                  </div>
                  <div className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">Ready to apply</div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {stats.map(([value, label]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white/90 p-4">
                      <div className="text-2xl font-semibold">{value}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[180px_repeat(6,1fr)] border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <div className="border-r border-slate-200 p-3">Designation</div>
                    <div className="col-span-3 border-r border-sky-200 bg-sky-50 p-3 text-center text-sky-900">Banglore</div>
                    <div className="col-span-3 bg-emerald-50 p-3 text-center text-emerald-900">Pune</div>
                  </div>
                  <div className="grid grid-cols-[180px_repeat(6,1fr)] border-b border-slate-200 text-xs font-medium uppercase tracking-wide">
                    <div className="border-r border-slate-200 p-3" />
                    {['Morning', 'Afternoon', 'Night', 'Morning', 'Afternoon', 'Night'].map((shift) => (
                      <div key={shift} className={`border-r border-slate-100 p-3 text-center ${shift === 'Morning' ? 'bg-sky-100 text-sky-950' : shift === 'Afternoon' ? 'bg-amber-100 text-amber-950' : 'bg-indigo-100 text-indigo-950'}`}>
                        {shift}
                      </div>
                    ))}
                  </div>
                  {[
                    ['T1 EMS', '3', '3', '1', '3', '3', '1'],
                    ['T4 Server Engineer', '1', '1', '1', '1', '0', '1'],
                    ['T4 OSS', '0', '1', '0', '1', '0', '0'],
                  ].map((row) => (
                    <div key={row[0]} className="grid grid-cols-[180px_repeat(6,1fr)] border-b border-slate-100 text-sm">
                      <div className="border-r border-slate-200 bg-white p-3 font-medium">{row[0]}</div>
                      {row.slice(1).map((value, index) => (
                        <div key={`${row[0]}-${index}`} className="border-r border-slate-100 bg-slate-50/60 p-2 text-center">
                          <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-md bg-white px-3 font-semibold shadow-sm">{value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <GitBranch className="h-5 w-5" />
            </span>
            RosterOps
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-md border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-white">
              Login
            </Link>
            <Link href="/admin" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              Open App
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[calc(92vh-80px)] max-w-7xl items-center px-6 pb-20 pt-8">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-sm font-medium text-teal-900 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Policy-driven roster management for multi-location operations
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal text-slate-950 md:text-7xl">
              RosterOps
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
              Plan shifts, designation coverage, leaves, approvals, employee self-service, and audit-ready roster operations from one modern workforce control plane.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-400/30 hover:bg-slate-800">
                Start Demo <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white">
                View Features
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 max-w-3xl">
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-700">Complete Workforce Operations</div>
          <h2 className="text-4xl font-semibold tracking-normal">Everything needed to configure, generate, publish, and govern rosters.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            RosterOps connects master data, policy, location coverage, leave workflows, and employee access into one operational rhythm.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">Operational Flow</div>
            <h2 className="text-4xl font-semibold tracking-normal">From setup to published roster.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Configure the workforce once, tune the policy, generate coverage, preview weekly results, and publish only when the roster is ready.
            </p>
          </div>
          <div className="grid gap-3">
            {flow.map((item, index) => (
              <div key={item} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">{index + 1}</div>
                <div className="font-medium">{item}</div>
                <CheckCircle2 className="ml-auto h-5 w-5 text-teal-600" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: MapPinned, label: 'Project-level coverage', value: 'Balance scarce designations across multiple locations and shifts.' },
            { icon: BarChart3, label: 'Analytics-ready', value: 'Track workforce distribution, leave trends, and roster fairness.' },
            { icon: Fingerprint, label: 'Governed actions', value: 'Role-aware access and audit logs for operational accountability.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-6">
                <Icon className="mb-4 h-7 w-7 text-indigo-700" />
                <div className="text-xl font-semibold">{item.label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-300">
              <Activity className="h-4 w-4" />
              Ready for executive demos and operational configuration
            </div>
            <h2 className="text-3xl font-semibold tracking-normal">Run roster planning with clean policy, coverage, and employee visibility.</h2>
          </div>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100">
            Enter RosterOps <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
