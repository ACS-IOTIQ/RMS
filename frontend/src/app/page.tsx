// 'use client';

// import Link from 'next/link';
// import { useEffect, useState } from 'react';
// import {
//   Activity,
//   ArrowRight,
//   BarChart3,
//   CalendarCheck2,
//   ChevronLeft,
//   ChevronRight,
//   CheckCircle2,
//   ClipboardList,
//   Clock3,
//   FileSpreadsheet,
//   Fingerprint,
//   GitBranch,
//   Layers3,
//   LockKeyhole,
//   MapPinned,
//   Network,
//   Pause,
//   Play,
//   ShieldCheck,
//   Sparkles,
//   Users2,
// } from 'lucide-react';

// const features = [
//   { icon: Users2, title: 'Employee Master Data', text: 'Manage employees, project mapping, location assignment, designation, department, status, reporting manager, and profile details.' },
//   { icon: Layers3, title: 'Organization Setup', text: 'Configure organizations, projects, locations, departments, designations, and shifts with clean operational boundaries.' },
//   { icon: Network, title: 'Multi-Location Coverage', text: 'Plan designation coverage across locations so project-level Morning, Afternoon, and Night availability is visible in one grid.' },
//   { icon: CalendarCheck2, title: 'Weekly Roster Engine', text: 'Preview, validate, publish, and export weekly rosters using policy-driven headcount and designation requirements.' },
//   { icon: ClipboardList, title: 'Roster Policy', text: 'Control daily headcount, working days, weekly offs, rest rules, shift distribution, and designation requirements from one module.' },
//   { icon: FileSpreadsheet, title: 'Excel Workflows', text: 'Download templates, upload bulk employee data, and manage designation requirement matrices with spreadsheet-friendly flows.' },
//   { icon: Clock3, title: 'Leave Approvals', text: 'Employees apply for leave and requests move through reporting-manager or admin approval before affecting roster availability.' },
//   { icon: ShieldCheck, title: 'Audit Trail', text: 'Admin-visible audit logs capture important actions and policy changes for operational accountability.' },
//   { icon: LockKeyhole, title: 'Role-Based Portals', text: 'Admins manage operations while employees view published rosters, submit leave, and maintain account details.' },
// ];

// const flow = [
//   'Create organization, project, and locations',
//   'Upload employees and map designations',
//   'Configure shifts and roster policy',
//   'Generate multi-location coverage',
//   'Preview and publish weekly roster',
// ];

// const stats = [
//   ['58', 'demo employees'],
//   ['8', 'locations'],
//   ['18+', 'designations'],
//   ['3', 'operational shifts'],
// ];

// const heroMatrixRows = [
//   ['T1 EMS', '3', '3', '1', '3', '3', '1'],
//   ['T4 Server Engineer', '1', '1', '1', '1', '0', '1'],
//   ['T4 OSS', '0', '1', '0', '1', '0', '0'],
// ];

// type HeroScreen = {
//   label: string;
//   eyebrow: string;
//   title: string;
//   badge: string;
//   description: string;
//   spotlight: string;
//   stats: string[][];
//   matrix?: boolean;
//   table?: {
//     headers: string[];
//     rows: string[][];
//   };
// };

// const heroScreens: HeroScreen[] = [
//   {
//     label: 'Dashboard',
//     eyebrow: 'Today',
//     title: 'Operations Dashboard',
//     badge: 'Live',
//     description: 'A command view for daily headcount, weekly slot capacity, fairness, and critical roster health signals.',
//     spotlight: 'Executive-ready status, capacity, issue severity, and ownership in one scan.',
//     stats: [['49', 'daily headcount'], ['343', 'weekly slots'], ['100', 'fairness'], ['0', 'critical issues']],
//     table: {
//       headers: ['Signal', 'Status', 'Owner'],
//       rows: [['Coverage health', 'Ready', 'Roster Manager'], ['Leave impact', 'Low', 'Admin'], ['Publish window', 'Open', 'Project Lead']],
//     },
//   },
//   {
//     label: 'Organization',
//     eyebrow: 'Enterprise Setup',
//     title: 'Organization Profile',
//     badge: 'Configured',
//     description: 'Define the operating structure once and keep departments, designations, and workforce ownership consistent.',
//     spotlight: 'Standardize the master setup before projects, locations, policies, and employees are layered in.',
//     stats: [['1', 'organization'], ['4', 'departments'], ['18+', 'designations'], ['464', 'employees']],
//     table: {
//       headers: ['Unit', 'Code', 'Status'],
//       rows: [['Operations', 'OPS', 'Active'], ['Infrastructure', 'INFRA', 'Active'], ['Security', 'SOC', 'Active']],
//     },
//   },
//   {
//     label: 'Projects',
//     eyebrow: 'Project Portfolio',
//     title: 'Project Control Center',
//     badge: 'On track',
//     description: 'Map projects to locations, shifts, and policies so each operational unit has clear coverage expectations.',
//     spotlight: 'Project-level planning keeps location rules, shift patterns, and coverage targets aligned.',
//     stats: [['DC-DR', 'primary project'], ['8', 'mapped locations'], ['3', 'active shifts'], ['24/7', 'coverage']],
//     table: {
//       headers: ['Project', 'Locations', 'Policy'],
//       rows: [['DC-DR-O&M', '8', '49 daily'], ['Infra Support', '3', 'Shared'], ['SOC Monitoring', '2', '24/7']],
//     },
//   },
//   {
//     label: 'Locations',
//     eyebrow: 'Location Network',
//     title: 'Location Coverage Map',
//     badge: 'Balanced',
//     description: 'Compare location staffing, daily targets, and shared coverage readiness across the entire project footprint.',
//     spotlight: 'See where local staffing is sufficient and where project-shared coverage should absorb demand.',
//     stats: [['8', 'locations'], ['58', 'per location'], ['49', 'daily target'], ['9', 'night target']],
//     table: {
//       headers: ['Location', 'Employees', 'Coverage'],
//       rows: [['Banglore', '58', 'Ready'], ['Pune', '58', 'Ready'], ['Delhi', '58', 'Shared']],
//     },
//   },
//   {
//     label: 'Employees',
//     eyebrow: 'Workforce',
//     title: 'Employee Master Data',
//     badge: 'Synced',
//     description: 'Maintain employee assignment, location, designation, status, and skill data from one dependable source.',
//     spotlight: 'Roster quality starts with clean employee records, active status, designation, and location mapping.',
//     stats: [['464', 'employees'], ['58', 'per location'], ['18+', 'skills'], ['0', 'data gaps']],
//     table: {
//       headers: ['Employee', 'Designation', 'Location'],
//       rows: [['Farhan Khan', 'T4 DC-Infra', 'Banglore'], ['Gaurav Saxena', 'T3 SOC', 'Pune'], ['Harish Iyer', 'T1 SOC', 'Delhi']],
//     },
//   },
//   {
//     label: 'Roster Policy',
//     eyebrow: 'DC-DR-O&M',
//     title: 'All Locations Coverage Matrix',
//     badge: 'Ready',
//     description: 'Translate policy rules into shift-wise designation coverage across every location before roster generation.',
//     spotlight: 'Validate shift totals, location totals, and designation coverage before applying policy to all locations.',
//     stats,
//     matrix: true,
//   },
//   {
//     label: 'Roster',
//     eyebrow: 'Weekly Plan',
//     title: 'Published Roster Matrix',
//     badge: 'Preview',
//     description: 'Preview scheduled shifts, weekly offs, shortages, and fairness before publishing the final roster.',
//     spotlight: 'The roster preview turns policy into daily assignments while preserving fairness and exception visibility.',
//     stats: [['343', 'required slots'], ['294', 'scheduled'], ['49', 'daily target'], ['100', 'fairness']],
//     table: {
//       headers: ['Employee', 'Mon', 'Tue'],
//       rows: [['Farhan Khan', 'A', 'B'], ['Gaurav Saxena', 'B', 'C'], ['Harish Iyer', 'OFF', 'A']],
//     },
//   },
//   {
//     label: 'Leaves',
//     eyebrow: 'Approvals',
//     title: 'Leave Approval Queue',
//     badge: '2 pending',
//     description: 'Review leave requests with roster impact visible, then coordinate approval and replacement coverage.',
//     spotlight: 'Leave decisions stay connected to roster impact, replacement planning, and approval accountability.',
//     stats: [['2', 'pending'], ['0', 'critical'], ['5', 'approved'], ['1', 'replacement']],
//     table: {
//       headers: ['Employee', 'Date', 'Action'],
//       rows: [['Irfan Ahmed', '20 May', 'Review'], ['Karthik Rao', '21 May', 'Approve'], ['Meera Nair', '23 May', 'Covered']],
//     },
//   },
// ];

// const defaultHeroIndex = Math.max(0, heroScreens.findIndex((screen) => screen.label === 'Roster Policy'));
// const heroRotationMs = 3000;

// function HeroPreviewTable({ table }: { table: { headers: string[]; rows: string[][] } }) {
//   return (
//     <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
//       <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
//         {table.headers.map((header) => (
//           <div key={header} className="border-r border-slate-200 p-2.5 last:border-r-0">{header}</div>
//         ))}
//       </div>
//       {table.rows.map((row) => (
//         <div key={row.join('-')} className="grid grid-cols-3 border-b border-slate-100 text-sm last:border-b-0">
//           {row.map((value, index) => (
//             <div key={`${value}-${index}`} className={`border-r border-slate-100 p-2.5 last:border-r-0 ${index === 0 ? 'font-medium text-slate-950' : 'text-slate-700'}`}>
//               {value}
//             </div>
//           ))}
//         </div>
//       ))}
//     </div>
//   );
// }

// function HeroCoverageMatrix() {
//   return (
//     <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
//       <div className="grid grid-cols-[160px_repeat(6,minmax(72px,1fr))] border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
//         <div className="border-r border-slate-200 p-3">Designation</div>
//         <div className="col-span-3 border-r border-sky-200 bg-sky-50 p-3 text-center text-sky-900">Banglore</div>
//         <div className="col-span-3 bg-emerald-50 p-3 text-center text-emerald-900">Pune</div>
//       </div>
//       <div className="grid grid-cols-[160px_repeat(6,minmax(72px,1fr))] border-b border-slate-200 text-xs font-medium uppercase">
//         <div className="border-r border-slate-200 p-3" />
//         {['Morning', 'Afternoon', 'Night', 'Morning', 'Afternoon', 'Night'].map((shift, index) => (
//           <div key={`${shift}-${index}`} className={`border-r border-slate-100 p-3 text-center ${shift === 'Morning' ? 'bg-sky-100 text-sky-950' : shift === 'Afternoon' ? 'bg-amber-100 text-amber-950' : 'bg-indigo-100 text-indigo-950'}`}>
//             {shift}
//           </div>
//         ))}
//       </div>
//       {heroMatrixRows.map((row) => (
//         <div key={row[0]} className="grid grid-cols-[160px_repeat(6,minmax(72px,1fr))] border-b border-slate-100 text-sm">
//           <div className="border-r border-slate-200 bg-white p-3 font-medium text-slate-950">{row[0]}</div>
//           {row.slice(1).map((value, index) => (
//             <div key={`${row[0]}-${index}`} className="border-r border-slate-100 bg-slate-50/60 p-2 text-center">
//               <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-md bg-white px-3 font-semibold text-slate-950 shadow-sm">{value}</span>
//             </div>
//           ))}
//         </div>
//       ))}
//     </div>
//   );
// }

// function HeroWorkspacePreview({ compact = false }: { compact?: boolean }) {
//   const [activeIndex, setActiveIndex] = useState(defaultHeroIndex);
//   const [rotationNonce, setRotationNonce] = useState(0);
//   const [isPaused, setIsPaused] = useState(false);
//   const [isHovering, setIsHovering] = useState(false);
//   const [progressActive, setProgressActive] = useState(false);
//   const activeScreen = heroScreens[activeIndex] ?? heroScreens[defaultHeroIndex];
//   const isRotationHeld = isPaused || isHovering;

//   useEffect(() => {
//     setProgressActive(false);
//     if (isRotationHeld) return undefined;

//     const frame = window.requestAnimationFrame(() => setProgressActive(true));
//     const timer = window.setTimeout(() => {
//       setActiveIndex((current) => (current + 1) % heroScreens.length);
//       setRotationNonce((current) => current + 1);
//     }, heroRotationMs);
//     return () => {
//       window.cancelAnimationFrame(frame);
//       window.clearTimeout(timer);
//     };
//   }, [activeIndex, isRotationHeld, rotationNonce]);

//   const showScreen = (index: number) => {
//     setActiveIndex(index);
//     setRotationNonce((current) => current + 1);
//   };

//   const moveScreen = (step: number) => {
//     const nextIndex = (activeIndex + step + heroScreens.length) % heroScreens.length;
//     showScreen(nextIndex);
//   };

//   return (
//     <div
//       className={`${compact ? 'relative mt-10 h-[590px] w-full max-w-full min-w-0' : 'absolute right-6 top-28 h-[620px] w-[700px]'} overflow-hidden rounded-lg border border-white/80 bg-white/90 shadow-2xl shadow-slate-300/40`}
//       onMouseEnter={() => setIsHovering(true)}
//       onMouseLeave={() => setIsHovering(false)}
//     >
//       <div className={`${compact ? 'grid-cols-1 sm:grid-cols-[170px_1fr]' : 'grid-cols-[220px_1fr]'} grid h-full min-w-0`}>
//         <aside className={`${compact ? 'hidden sm:block' : ''} border-r border-slate-800 bg-slate-950 p-5 text-white`}>
//           <div className="mb-7 flex items-center gap-2 font-semibold">
//             <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-300 text-slate-950">
//               <GitBranch className="h-5 w-5" />
//             </div>
//             RosterOps
//           </div>
//           <div className="mb-3 text-[11px] font-semibold uppercase text-slate-500">Feature Tour</div>
//           {heroScreens.map((item, index) => (
//             <button
//               key={item.label}
//               type="button"
//               onClick={() => showScreen(index)}
//               className={`mb-2 w-full rounded-md px-3 py-2 text-left text-sm transition ${item.label === activeScreen.label ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
//               aria-current={item.label === activeScreen.label ? 'page' : undefined}
//             >
//               {item.label}
//             </button>
//           ))}
//         </aside>

//         <div className="min-w-0 overflow-hidden bg-slate-50/80 p-5">
//           {compact && (
//             <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
//               {heroScreens.map((item, index) => (
//                 <button
//                   key={item.label}
//                   type="button"
//                   onClick={() => showScreen(index)}
//                   className={`shrink-0 rounded-md border px-3 py-2 text-xs font-medium ${item.label === activeScreen.label ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
//                   aria-current={item.label === activeScreen.label ? 'page' : undefined}
//                 >
//                   {item.label}
//                 </button>
//               ))}
//             </div>
//           )}
//           <div className="mb-5 flex items-start justify-between gap-4">
//             <div>
//               <div className="text-sm font-medium text-slate-500">{activeScreen.eyebrow}</div>
//               <div data-hero-active-title className={`${compact ? 'text-xl' : 'text-2xl'} font-semibold text-slate-950`}>{activeScreen.title}</div>
//             </div>
//             <div className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">{activeScreen.badge}</div>
//           </div>
//           <p className="mb-5 max-w-2xl text-sm leading-6 text-slate-600">{activeScreen.description}</p>

//           <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
//             <div className="mb-3 flex items-center justify-between gap-3">
//               <div>
//                 <div className="text-[11px] font-semibold uppercase text-slate-500">Feature Spotlight</div>
//                 <div className="mt-1 text-sm leading-5 text-slate-700">{activeScreen.spotlight}</div>
//               </div>
//               <div className="flex shrink-0 items-center gap-1">
//                 <button
//                   type="button"
//                   onClick={() => moveScreen(-1)}
//                   className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
//                   aria-label="Previous feature"
//                   title="Previous"
//                 >
//                   <ChevronLeft className="h-4 w-4" />
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => setIsPaused((current) => !current)}
//                   className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
//                   aria-label={isPaused ? 'Resume feature tour' : 'Pause feature tour'}
//                   title={isPaused ? 'Resume' : 'Pause'}
//                 >
//                   {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => moveScreen(1)}
//                   className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
//                   aria-label="Next feature"
//                   title="Next"
//                 >
//                   <ChevronRight className="h-4 w-4" />
//                 </button>
//               </div>
//             </div>
//             <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
//               <span
//                 key={`${activeIndex}-${rotationNonce}-${isRotationHeld ? 'held' : 'running'}`}
//                 className="block h-full rounded-full bg-slate-950"
//                 style={{
//                   width: progressActive && !isRotationHeld ? '100%' : '0%',
//                   transition: progressActive && !isRotationHeld ? `width ${heroRotationMs}ms linear` : 'none',
//                 }}
//               />
//             </div>
//             <div className="mt-2 flex items-center justify-between text-[11px] font-medium uppercase text-slate-500">
//               <span>{String(activeIndex + 1).padStart(2, '0')} / {String(heroScreens.length).padStart(2, '0')}</span>
//               <span>{isRotationHeld ? 'Paused' : 'Auto advancing'}</span>
//             </div>
//           </div>

//           <div className={`${compact ? 'grid-cols-2' : 'grid-cols-4'} grid gap-3`}>
//             {activeScreen.stats.map(([value, label]) => (
//               <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
//                 <div className="text-2xl font-semibold text-slate-950">{value}</div>
//                 <div className="text-xs uppercase text-slate-500">{label}</div>
//               </div>
//             ))}
//           </div>

//           {activeScreen.matrix ? <HeroCoverageMatrix /> : <HeroPreviewTable table={activeScreen.table ?? { headers: [], rows: [] }} />}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function HomePage() {
//   return (
//     <main className="min-h-screen overflow-x-hidden bg-[#f7f8fb] text-slate-950">
//       <section className="relative min-h-screen overflow-hidden bg-[#eef6f3]">
//         <div className="absolute inset-0 hidden xl:block">
//           <div className="absolute inset-x-0 top-0 h-20 bg-white/70" />
//           <div className="absolute bottom-0 right-0 h-36 w-full bg-white/35" />
//           <HeroWorkspacePreview />
//         </div>

//         <nav className="relative z-20 mx-0 flex w-full max-w-[390px] items-center justify-between gap-4 px-4 py-5 sm:mx-auto sm:max-w-7xl sm:px-6">
//           <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
//             <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
//               <GitBranch className="h-5 w-5" />
//             </span>
//             RosterOps
//           </Link>
//           <div className="flex shrink-0 items-center gap-2 sm:gap-3">
//             <Link href="/login" className="rounded-md border border-slate-300 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-white sm:px-4">
//               Login
//             </Link>
//             <Link href="/admin" className="hidden rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 sm:inline-flex">
//               Open App
//             </Link>
//           </div>
//         </nav>

//         <div className="pointer-events-none relative z-10 mx-0 flex min-h-[calc(100vh-80px)] w-full max-w-[390px] items-center px-4 pb-16 pt-8 sm:mx-auto sm:max-w-7xl sm:px-6">
//           <div className="pointer-events-auto min-w-0 w-full max-w-[358px] sm:max-w-[560px] xl:max-w-[540px]">
//             <div className="mb-5 flex w-fit max-w-full items-center gap-2 rounded-lg border border-teal-200 bg-white/80 px-4 py-2 text-sm font-medium leading-5 text-teal-900 shadow-sm sm:rounded-full">
//               <Sparkles className="h-4 w-4 shrink-0" />
//               <span className="min-w-0">Policy-driven roster management for multi-location operations</span>
//             </div>
//             <h1 className="text-5xl font-semibold leading-tight tracking-normal text-slate-950 md:text-7xl">
//               RosterOps
//             </h1>
//             <p className="mt-6 text-xl leading-8 text-slate-700">
//               Plan shifts, designation coverage, leaves, approvals, employee self-service, and audit-ready roster operations from one modern workforce control plane.
//             </p>
//             <div className="mt-8 flex flex-wrap gap-3">
//               <Link href="/login" className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-400/30 hover:bg-slate-800">
//                 Start Demo <ArrowRight className="h-4 w-4" />
//               </Link>
//               <a href="#features" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white">
//                 View Features
//               </a>
//             </div>
//             <div className="xl:hidden">
//               <HeroWorkspacePreview compact />
//             </div>
//           </div>
//         </div>
//       </section>

//       <section id="features" className="mx-auto max-w-7xl px-6 py-20">
//         <div className="mb-10 max-w-3xl">
//           <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-700">Complete Workforce Operations</div>
//           <h2 className="text-4xl font-semibold tracking-normal">Everything needed to configure, generate, publish, and govern rosters.</h2>
//           <p className="mt-4 text-lg leading-8 text-slate-600">
//             RosterOps connects master data, policy, location coverage, leave workflows, and employee access into one operational rhythm.
//           </p>
//         </div>
//         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
//           {features.map((feature) => {
//             const Icon = feature.icon;
//             return (
//               <div key={feature.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
//                 <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
//                   <Icon className="h-5 w-5" />
//                 </div>
//                 <h3 className="text-lg font-semibold">{feature.title}</h3>
//                 <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
//               </div>
//             );
//           })}
//         </div>
//       </section>

//       <section className="border-y border-slate-200 bg-white">
//         <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
//           <div>
//             <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">Operational Flow</div>
//             <h2 className="text-4xl font-semibold tracking-normal">From setup to published roster.</h2>
//             <p className="mt-4 text-lg leading-8 text-slate-600">
//               Configure the workforce once, tune the policy, generate coverage, preview weekly results, and publish only when the roster is ready.
//             </p>
//           </div>
//           <div className="grid gap-3">
//             {flow.map((item, index) => (
//               <div key={item} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
//                 <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">{index + 1}</div>
//                 <div className="font-medium">{item}</div>
//                 <CheckCircle2 className="ml-auto h-5 w-5 text-teal-600" />
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       <section className="mx-auto max-w-7xl px-6 py-20">
//         <div className="grid gap-5 md:grid-cols-3">
//           {[
//             { icon: MapPinned, label: 'Project-level coverage', value: 'Balance scarce designations across multiple locations and shifts.' },
//             { icon: BarChart3, label: 'Analytics-ready', value: 'Track workforce distribution, leave trends, and roster fairness.' },
//             { icon: Fingerprint, label: 'Governed actions', value: 'Role-aware access and audit logs for operational accountability.' },
//           ].map((item) => {
//             const Icon = item.icon;
//             return (
//               <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-6">
//                 <Icon className="mb-4 h-7 w-7 text-indigo-700" />
//                 <div className="text-xl font-semibold">{item.label}</div>
//                 <p className="mt-2 text-sm leading-6 text-slate-600">{item.value}</p>
//               </div>
//             );
//           })}
//         </div>
//       </section>

//       <section className="bg-slate-950 px-6 py-16 text-white">
//         <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
//           <div>
//             <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-300">
//               <Activity className="h-4 w-4" />
//               Ready for executive demos and operational configuration
//             </div>
//             <h2 className="text-3xl font-semibold tracking-normal">Run roster planning with clean policy, coverage, and employee visibility.</h2>
//           </div>
//           <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100">
//             Enter RosterOps <ArrowRight className="h-4 w-4" />
//           </Link>
//         </div>
//       </section>
//     </main>
//   );
// }
'use client';

/**
 * RosterOps — Landing Page (Blue Theme · Glass Hero)
 * ────────────────────────────────────────────────────────────────────────────
 * Color story matches /login: blue-600 bookend panels + white interior.
 * Preview window mirrors the actual admin shell — white sidebar with the
 * `RosterOps · WORKFORCE SUITE` logo, blue active state, no browser chrome.
 *
 * Glassmorphism is layered into the hero:
 *   · Eyebrow chip — frosted glass with white border
 *   · Preview frame — white card with a white/40 ring and a colored shadow
 *   · Two floating glass cards over the preview corners (status + metric)
 *
 * File map:
 *   1.  Types
 *   2.  Content (screens, features, flow, highlights, brand strings)
 *   3.  Sub-components (DotBackdrop, StatusPill, glass primitives…)
 *   4.  WorkspacePreview (white sidebar + canvas, no browser chrome)
 *   5.  HomePage (default export)
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
  MapPinned,
  Network,
  ShieldCheck,
  Sparkles,
  Users2,
  LockKeyhole,
} from 'lucide-react';

// 1) ── Types ────────────────────────────────────────────────────────────────

type StatTuple = readonly [value: string, label: string];

type PreviewTable = {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
};

type HeroScreen = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  badge: string;
  description: string;
  stats: readonly StatTuple[];
  matrix?: boolean;
  table?: PreviewTable;
};

type Feature = { icon: typeof Users2; title: string; text: string };
type Highlight = { icon: typeof MapPinned; label: string; value: string };

// 2) ── Content ──────────────────────────────────────────────────────────────

const ROTATION_INTERVAL_MS = 4000;
const DEFAULT_SCREEN_ID = 'roster-policy';

const BRAND = 'RosterOps';
const BRAND_TAGLINE = 'Workforce Orchestration Suite';
const BRAND_SHORT = 'Workforce Suite';
const VERSION = 'v2.4';
const HERO_EYEBROW = 'Workforce Operations · 2026';
const HERO_HEADLINE = 'Intelligent workforce scheduling for modern operations.';
const HERO_SUBHEADLINE =
  'Generate fair rosters across thousands of employees, balance designation coverage, handle leaves dynamically, and gain full operational visibility — from one policy-driven control plane.';

const TRUST_STATS: readonly StatTuple[] = [
  ['8', 'Locations'],
  ['18+', 'Designations'],
  ['343', 'Weekly slots'],
  ['100%', 'Audit coverage'],
];

const HERO_BULLETS: readonly string[] = [
  'Auto roster generation with fairness scoring',
  'Multi-project, multi-location workforce',
  'Leave-aware reallocation',
  'Real-time staffing analytics',
];

const HERO_SCREENS: readonly HeroScreen[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    eyebrow: 'Today · 15 May',
    title: 'Operations Dashboard',
    badge: 'Live',
    description:
      'A command view for daily headcount, weekly slot capacity, fairness, and critical roster-health signals.',
    stats: [
      ['49', 'Daily headcount'],
      ['343', 'Weekly slots'],
      ['100', 'Fairness'],
      ['0', 'Critical'],
    ],
    table: {
      headers: ['Signal', 'Status', 'Owner'],
      rows: [
        ['Coverage health', 'Ready', 'Roster Mgr'],
        ['Leave impact', 'Low', 'Admin'],
        ['Publish window', 'Open', 'Project Lead'],
      ],
    },
  },
  {
    id: 'organization',
    label: 'Organization',
    eyebrow: 'Enterprise setup',
    title: 'Organization Profile',
    badge: 'Configured',
    description:
      'Define the operating structure once. Departments, designations, and ownership stay consistent across teams.',
    stats: [
      ['1', 'Organization'],
      ['4', 'Departments'],
      ['18+', 'Designations'],
      ['464', 'Employees'],
    ],
    table: {
      headers: ['Unit', 'Code', 'Status'],
      rows: [
        ['Operations', 'OPS', 'Active'],
        ['Infrastructure', 'INFRA', 'Active'],
        ['Security', 'SOC', 'Active'],
      ],
    },
  },
  {
    id: 'projects',
    label: 'Projects',
    eyebrow: 'Project portfolio',
    title: 'Project Control Center',
    badge: 'On track',
    description:
      'Map projects to locations, shifts, and policies so each unit has clear coverage expectations.',
    stats: [
      ['DC-DR', 'Primary'],
      ['8', 'Locations'],
      ['3', 'Shifts'],
      ['24/7', 'Coverage'],
    ],
    table: {
      headers: ['Project', 'Locations', 'Policy'],
      rows: [
        ['DC-DR-O&M', '8', '49 daily'],
        ['Infra Support', '3', 'Shared'],
        ['SOC Monitoring', '2', '24/7'],
      ],
    },
  },
  {
    id: 'locations',
    label: 'Locations',
    eyebrow: 'Location network',
    title: 'Location Coverage Map',
    badge: 'Balanced',
    description:
      'Compare staffing, daily targets, and shared coverage readiness across the project footprint.',
    stats: [
      ['8', 'Locations'],
      ['58', 'Per loc.'],
      ['49', 'Day target'],
      ['9', 'Night target'],
    ],
    table: {
      headers: ['Location', 'Employees', 'Coverage'],
      rows: [
        ['Bengaluru', '58', 'Ready'],
        ['Pune', '58', 'Ready'],
        ['Delhi', '58', 'Shared'],
      ],
    },
  },
  {
    id: 'employees',
    label: 'Employees',
    eyebrow: 'Workforce',
    title: 'Employee Master Data',
    badge: 'Synced',
    description:
      'Maintain assignment, location, designation, and skill data from one dependable source.',
    stats: [
      ['464', 'Employees'],
      ['58', 'Per loc.'],
      ['18+', 'Skills'],
      ['0', 'Gaps'],
    ],
    table: {
      headers: ['Employee', 'Designation', 'Location'],
      rows: [
        ['Farhan Khan', 'T4 DC-Infra', 'Bengaluru'],
        ['Gaurav Saxena', 'T3 SOC', 'Pune'],
        ['Harish Iyer', 'T1 SOC', 'Delhi'],
      ],
    },
  },
  {
    id: 'roster-policy',
    label: 'Roster Policy',
    eyebrow: 'DC-DR-O&M',
    title: 'All-Locations Coverage Matrix',
    badge: 'Ready',
    description:
      'Translate policy into shift-wise designation coverage across every location — before generation.',
    stats: [
      ['58', 'Employees'],
      ['8', 'Locations'],
      ['18+', 'Designations'],
      ['3', 'Shifts'],
    ],
    matrix: true,
  },
  {
    id: 'roster',
    label: 'Roster',
    eyebrow: 'Weekly plan',
    title: 'Published Roster Matrix',
    badge: 'Preview',
    description:
      'Preview shifts, weekly offs, shortages, and fairness before publishing the final roster.',
    stats: [
      ['343', 'Required'],
      ['294', 'Scheduled'],
      ['49', 'Day target'],
      ['100', 'Fairness'],
    ],
    table: {
      headers: ['Employee', 'Mon', 'Tue'],
      rows: [
        ['Farhan Khan', 'A', 'B'],
        ['Gaurav Saxena', 'B', 'C'],
        ['Harish Iyer', 'OFF', 'A'],
      ],
    },
  },
  {
    id: 'leaves',
    label: 'Leaves',
    eyebrow: 'Approvals',
    title: 'Leave Approval Queue',
    badge: '2 pending',
    description:
      'Review leave requests with roster impact visible, then coordinate approval and replacement coverage.',
    stats: [
      ['2', 'Pending'],
      ['0', 'Critical'],
      ['5', 'Approved'],
      ['1', 'Cover'],
    ],
    table: {
      headers: ['Employee', 'Date', 'Action'],
      rows: [
        ['Irfan Ahmed', '20 May', 'Review'],
        ['Karthik Rao', '21 May', 'Approve'],
        ['Meera Nair', '23 May', 'Covered'],
      ],
    },
  },
];

const DEFAULT_SCREEN_INDEX = Math.max(
  0,
  HERO_SCREENS.findIndex((s) => s.id === DEFAULT_SCREEN_ID),
);

const SCREEN_ICONS: Record<string, typeof Users2> = {
  dashboard: Sparkles,
  organization: Layers3,
  projects: Network,
  locations: MapPinned,
  employees: Users2,
  'roster-policy': ClipboardList,
  roster: CalendarCheck2,
  leaves: ShieldCheck,
};

const COVERAGE_MATRIX_ROWS: readonly (readonly string[])[] = [
  ['T1 EMS', '3', '3', '1', '3', '3', '1'],
  ['T4 Server Engr', '1', '1', '1', '1', '0', '1'],
  ['T4 OSS', '0', '1', '0', '1', '0', '0'],
];

const FEATURES: readonly Feature[] = [
  {
    icon: Users2,
    title: 'Employee Master Data',
    text: 'Manage employees, project mapping, location assignment, designation, department, status, reporting manager, and profile details.',
  },
  {
    icon: Layers3,
    title: 'Organization Setup',
    text: 'Configure organizations, projects, locations, departments, designations, and shifts with clean operational boundaries.',
  },
  {
    icon: Network,
    title: 'Multi-Location Coverage',
    text: 'Plan designation coverage across locations so project-level Morning, Afternoon, and Night availability is visible in one grid.',
  },
  {
    icon: CalendarCheck2,
    title: 'Weekly Roster Engine',
    text: 'Preview, validate, publish, and export weekly rosters using policy-driven headcount and designation requirements.',
  },
  {
    icon: ClipboardList,
    title: 'Roster Policy',
    text: 'Control daily headcount, working days, weekly offs, rest rules, shift distribution, and designation requirements from one module.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel Workflows',
    text: 'Download templates, upload bulk employee data, and manage designation requirement matrices with spreadsheet-friendly flows.',
  },
  {
    icon: Clock3,
    title: 'Leave Approvals',
    text: 'Employees apply for leave and requests move through reporting-manager or admin approval before affecting roster availability.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit Trail',
    text: 'Admin-visible audit logs capture important actions and policy changes for operational accountability.',
  },
  {
    icon: LockKeyhole,
    title: 'Role-Based Portals',
    text: 'Admins manage operations while employees view published rosters, submit leave, and maintain account details.',
  },
];

const FLOW_STEPS: readonly string[] = [
  'Create organization, project, and locations',
  'Upload employees and map designations',
  'Configure shifts and roster policy',
  'Generate multi-location coverage',
  'Preview and publish weekly roster',
];

const HIGHLIGHTS: readonly Highlight[] = [
  {
    icon: MapPinned,
    label: 'Project-level coverage',
    value: 'Balance scarce designations across multiple locations and shifts.',
  },
  {
    icon: BarChart3,
    label: 'Analytics-ready',
    value: 'Track workforce distribution, leave trends, and roster fairness.',
  },
  {
    icon: Fingerprint,
    label: 'Governed actions',
    value: 'Role-aware access and audit logs for operational accountability.',
  },
];

// 3) ── Sub-components ──────────────────────────────────────────────────────

/** Subtle white dot pattern overlay — matches the /login page treatment. */
function DotBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }}
    />
  );
}

function StatusPill({ label, isLive = false }: { label: string; isLive?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        isLive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      }`}
    >
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {label}
    </span>
  );
}

function PreviewStatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="text-[30px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
        {value}
      </div>
      <div className="mt-2.5 font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}

function PreviewTableView({ table }: { table: PreviewTable }) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div
        className="grid border-b border-slate-200 bg-slate-50 font-mono text-[10.5px] uppercase tracking-wider text-slate-500"
        style={{ gridTemplateColumns: `repeat(${table.headers.length}, minmax(0, 1fr))` }}
      >
        {table.headers.map((h) => (
          <div key={h} className="border-r border-slate-200 p-3 last:border-r-0">
            {h}
          </div>
        ))}
      </div>
      {table.rows.map((row, i) => (
        <div
          key={i}
          className="grid border-b border-slate-100 text-[14px] last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, j) => (
            <div
              key={j}
              className={`border-r border-slate-100 p-3 last:border-r-0 ${
                j === 0 ? 'font-medium text-slate-900' : 'text-slate-600'
              }`}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CoverageMatrixView() {
  const shiftClass = (shift: string) => {
    const tone =
      shift === 'Morning'
        ? 'bg-sky-50 text-sky-800'
        : shift === 'Afternoon'
          ? 'bg-amber-50 text-amber-800'
          : 'bg-indigo-50 text-indigo-800';
    return `border-r border-slate-100 p-2.5 text-center ${tone}`;
  };

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[130px_repeat(6,minmax(0,1fr))] border-b border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <div className="border-r border-slate-200 p-2.5">Designation</div>
        <div className="col-span-3 border-r border-sky-200 bg-sky-50 p-2.5 text-center text-sky-800">
          Bengaluru
        </div>
        <div className="col-span-3 bg-emerald-50 p-2.5 text-center text-emerald-800">Pune</div>
      </div>
      <div className="grid grid-cols-[130px_repeat(6,minmax(0,1fr))] border-b border-slate-200 font-mono text-[9px] uppercase tracking-wider">
        <div className="border-r border-slate-200 p-2.5" />
        {['Morning', 'Afternoon', 'Night', 'Morning', 'Afternoon', 'Night'].map((s, i) => (
          <div key={`${s}-${i}`} className={shiftClass(s)}>
            {s.slice(0, 4)}
          </div>
        ))}
      </div>
      {COVERAGE_MATRIX_ROWS.map((row) => (
        <div
          key={row[0]}
          className="grid grid-cols-[130px_repeat(6,minmax(0,1fr))] border-b border-slate-100 text-[13px] last:border-b-0"
        >
          <div className="border-r border-slate-200 p-2.5 text-[12px] font-medium text-slate-900">
            {row[0]}
          </div>
          {row.slice(1).map((value, i) => (
            <div key={i} className="border-r border-slate-100 bg-slate-50/40 p-1.5 text-center">
              <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-white px-2 font-mono text-[12px] font-semibold tabular-nums text-slate-900 shadow-sm">
                {value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-600">
      <span className="h-1 w-1 rounded-full bg-blue-600" />
      {label}
    </div>
  );
}

// 4) ── Workspace preview (white sidebar, no browser chrome) ────────────────

function WorkspacePreview() {
  /**
   * Two-state pattern for buttery crossfades:
   *   • `activeIndex`    — the screen the rotation/click WANTS to show
   *   • `displayedIndex` — the screen the canvas is CURRENTLY rendering
   *   • `isVisible`      — drives the opacity CSS transition
   *
   * When activeIndex differs from displayedIndex, we fade out (visible = false),
   * wait for the fade to finish, then swap the index and fade back in. No DOM
   * remount → no snap, no flicker, smooth as a real app transition.
   */
  const [activeIndex, setActiveIndex] = useState(DEFAULT_SCREEN_INDEX);
  const [displayedIndex, setDisplayedIndex] = useState(DEFAULT_SCREEN_INDEX);
  const [isVisible, setIsVisible] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  const activeScreen = HERO_SCREENS[activeIndex] ?? HERO_SCREENS[DEFAULT_SCREEN_INDEX];
  const displayedScreen =
    HERO_SCREENS[displayedIndex] ?? HERO_SCREENS[DEFAULT_SCREEN_INDEX];
  const rotationHeld = isHovering;

  /** Auto-advance the tour. Pauses on hover and respects reduced motion. */
  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (rotationHeld || reducedMotion) return undefined;
    const advance = window.setTimeout(() => {
      setActiveIndex((i) => (i + 1) % HERO_SCREENS.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearTimeout(advance);
  }, [activeIndex, rotationHeld]);

  /** Crossfade orchestrator: fade out → swap content → fade in. */
  useEffect(() => {
    if (activeIndex === displayedIndex) return undefined;
    setIsVisible(false); // start fade out
    const swap = window.setTimeout(() => {
      setDisplayedIndex(activeIndex); // swap content while invisible
      // Double rAF guarantees the browser paints opacity:0 before transitioning to 1
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => setIsVisible(true)),
      );
    }, 280);
    return () => window.clearTimeout(swap);
  }, [activeIndex, displayedIndex]);

  const goTo = useCallback((i: number) => setActiveIndex(i), []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      goTo((activeIndex + 1) % HERO_SCREENS.length);
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo((activeIndex - 1 + HERO_SCREENS.length) % HERO_SCREENS.length);
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-[24px] bg-white/[0.68] backdrop-blur-[18px]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        boxShadow: '0 24px 70px rgba(15, 23, 42, 0.16)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div className="grid min-w-0 grid-cols-1 sm:grid-cols-[230px_1fr]">
        {/* ── White admin-style sidebar (transparent — glass shows through) ── */}
        <aside
          role="tablist"
          aria-label="Product feature tour"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="hidden bg-transparent p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:block"
        >
          {/* Stacked logo: matches the actual admin sidebar */}
          <div className="mb-7 flex items-center gap-2.5 px-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-slate-900">{BRAND}</span>
              <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {BRAND_SHORT}
              </span>
            </span>
          </div>

          <div className="mb-2.5 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Feature tour
          </div>

          <nav className="flex flex-col gap-0.5">
            {HERO_SCREENS.map((screen, i) => {
              const Icon = SCREEN_ICONS[screen.id] ?? Sparkles;
              const isActive = i === activeIndex;
              return (
                <button
                  key={screen.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => goTo(i)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors duration-300 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-[16px] w-[16px] shrink-0 transition-colors duration-300 ${
                      isActive
                        ? 'text-blue-600'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate font-medium">{screen.label}</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Canvas (transparent — glass shows through) ───────────────── */}
        <div className="min-w-0 overflow-hidden bg-transparent p-6">
          {/* Mobile tab strip — uses activeIndex for instant click feedback */}
          <div
            role="tablist"
            aria-label="Feature tour"
            className="mb-4 flex gap-1.5 overflow-x-auto pb-1 sm:hidden"
          >
            {HERO_SCREENS.map((screen, i) => (
              <button
                key={screen.id}
                role="tab"
                aria-selected={i === activeIndex}
                onClick={() => goTo(i)}
                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-300 ${
                  i === activeIndex
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {screen.label}
              </button>
            ))}
          </div>

          {/* Crossfading screen content — DOM stays mounted, opacity drives the transition */}
          <div
            className="min-w-0"
            style={{
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 380ms cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'opacity',
            }}
          >
            {/* Header */}
            <header className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
                  {displayedScreen.eyebrow}
                </div>
                <h3 className="mt-1.5 text-[24px] font-semibold tracking-tight text-slate-900">
                  {displayedScreen.title}
                </h3>
              </div>
              <StatusPill
                label={displayedScreen.badge}
                isLive={displayedScreen.badge.toLowerCase() === 'live'}
              />
            </header>

            <p className="mb-6 max-w-xl text-[14px] leading-[1.6] text-slate-600">
              {displayedScreen.description}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {displayedScreen.stats.map(([v, l]) => (
                <PreviewStatCard key={l} value={v} label={l} />
              ))}
            </div>

            {/* Body */}
            {displayedScreen.matrix ? (
              <CoverageMatrixView />
            ) : (
              <PreviewTableView
                table={displayedScreen.table ?? { headers: [], rows: [] }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 5) ── HomePage ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  /** Smooth-scroll the "View features" CTA to the features section. */
  const scrollToFeatures = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById('features');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', '#features');
    }
  };

  /**
   * Fade-out → navigate. Used on every CTA that leaves the landing page so
   * the transition to /login (or /admin) feels intentional rather than abrupt.
   * Navigation fires slightly before the fade completes so the next page
   * appears just as this one finishes dimming.
   */
  const smoothNavigate =
    (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (isExiting) return;
      setIsExiting(true);
      window.setTimeout(() => router.push(href), 320);
    };

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-white text-slate-900"
      style={{
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(0.985)' : 'scale(1)',
        transition: 'opacity 420ms ease-out, transform 420ms ease-out',
        willChange: 'opacity, transform',
      }}
    >
      {/* ────────────────────────────────────────────────────────────────────
         SECTION 1 · HERO  (blue panel with glass accents)
      ──────────────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-blue-600 text-white">
        <DotBackdrop />

        {/* Layered ambient gradients — adds depth without breaking the corp look */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 500px at 85% 25%, rgba(255,255,255,0.14), transparent 60%), radial-gradient(700px 400px at 10% 90%, rgba(56,189,248,0.18), transparent 65%)',
          }}
        />

        {/* Top nav */}
        <nav className="relative z-20 mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white backdrop-blur-md">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight">{BRAND}</span>
              <span className="text-[11px] text-blue-100">{BRAND_TAGLINE}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              onClick={smoothNavigate('/login')}
              className="rounded-md border border-white/25 bg-white/10 px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur-md transition hover:bg-white/20"
            >
              Login
            </Link>
            <Link
              href="/admin"
              onClick={smoothNavigate('/admin')}
              className="hidden rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 sm:inline-flex"
            >
              Open App
            </Link>
          </div>
        </nav>

        {/* Hero grid */}
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 pb-20 pt-8 lg:px-10 lg:pb-24 lg:pt-12">
          <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Copy column */}
            <div className="lg:col-span-4">
              {/* Glass eyebrow chip */}
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-white shadow-lg shadow-blue-950/10 backdrop-blur-xl">
                <Sparkles className="h-3 w-3" />
                {HERO_EYEBROW}
              </div>

              <h1 className="text-[40px] font-bold leading-[1.08] tracking-[-0.015em] text-white sm:text-[48px] lg:text-[58px]">
                {HERO_HEADLINE}
              </h1>

              <p className="mt-6 max-w-[520px] text-[16px] leading-7 text-blue-100 lg:text-[17px]">
                {HERO_SUBHEADLINE}
              </p>

              {/* Bullet list */}
              <ul className="mt-6 grid max-w-md gap-2">
                {HERO_BULLETS.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-start gap-2.5 text-[14px] leading-6 text-blue-50"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                    {bullet}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  onClick={smoothNavigate('/login')}
                  className="group inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-[13.5px] font-semibold text-blue-700 shadow-xl shadow-blue-950/30 transition hover:bg-blue-50"
                >
                  Start demo
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#features"
                  onClick={scrollToFeatures}
                  className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-3 text-[13.5px] font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  View features
                </a>
              </div>

              {/* Trust strip */}
              <dl className="mt-12 grid max-w-md grid-cols-4 gap-6 border-t border-white/20 pt-6">
                {TRUST_STATS.map(([value, label]) => (
                  <div key={label}>
                    <dt className="text-[22px] font-bold leading-none tracking-tight tabular-nums text-white">
                      {value}
                    </dt>
                    <dd className="mt-2 font-mono text-[10px] uppercase tracking-wider text-blue-200">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Preview column */}
            <div className="lg:col-span-8">
              <WorkspacePreview />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
         SECTION 2 · FEATURES
      ──────────────────────────────────────────────────────────────────── */}
      <section
        id="features"
        className="relative mx-auto w-full max-w-[1400px] scroll-mt-8 px-6 py-24 lg:px-10 lg:py-32"
      >
        <div className="mb-12 max-w-2xl">
          <SectionEyebrow label="Complete workforce operations" />
          <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-slate-900 lg:text-[44px]">
            Everything needed to configure, generate, publish, and govern rosters.
          </h2>
          <p className="mt-5 max-w-xl text-[16px] leading-7 text-slate-600">
            RosterOps connects master data, policy, location coverage, leave workflows, and employee
            access into one operational rhythm.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <h3 className="text-[15.5px] font-semibold tracking-tight text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">{feature.text}</p>
                <span className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-300/60 to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </div>

      {/* ────────────────────────────────────────────────────────────────────
         SECTION 3 · FLOW
      ──────────────────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-50">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionEyebrow label="Operational flow" />
              <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-slate-900 lg:text-[44px]">
                From setup to published roster.
              </h2>
              <p className="mt-5 max-w-md text-[16px] leading-7 text-slate-600">
                Configure the workforce once, tune the policy, generate coverage, preview weekly
                results, and publish only when the roster is ready.
              </p>
            </div>

            <ol className="relative lg:col-span-7">
              <span
                aria-hidden
                className="absolute left-[18px] bottom-2 top-2 w-px bg-slate-200"
              />
              {FLOW_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="relative flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md [&:not(:last-child)]:mb-3"
                >
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 font-mono text-[12px] font-semibold text-white shadow-sm">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="text-[14.5px] font-medium text-slate-900">{step}</div>
                  <CheckCircle2 className="ml-auto h-4 w-4 text-blue-600" />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
         SECTION 4 · HIGHLIGHTS
      ──────────────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="mb-12 max-w-2xl">
          <SectionEyebrow label="Why teams pick RosterOps" />
          <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.015em] text-slate-900 lg:text-[44px]">
            Built for the work, not the spreadsheet.
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="text-[17px] font-semibold tracking-tight text-slate-900">
                  {item.label}
                </div>
                <p className="mt-2 text-[13.5px] leading-6 text-slate-600">{item.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
         SECTION 5 · FINAL CTA  (blue bookend)
      ──────────────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-blue-600 text-white">
        <DotBackdrop />
        <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20 lg:px-10 lg:py-24">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-blue-100">
                <Activity className="h-3 w-3" />
                Ready for executive demos and operational configuration
              </div>
              <h2 className="text-[28px] font-bold leading-[1.15] tracking-[-0.015em] text-white lg:text-[38px]">
                Run roster planning with clean policy, coverage, and employee visibility.
              </h2>
            </div>
            <Link
              href="/login"
              onClick={smoothNavigate('/login')}
              className="group inline-flex items-center justify-center gap-2 self-start rounded-md bg-white px-5 py-3 text-[13.5px] font-semibold text-blue-700 shadow-xl shadow-blue-950/30 transition hover:bg-blue-50 md:self-auto"
            >
              Enter {BRAND}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white">
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 py-8 md:flex-row">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <span className="text-[13px] font-semibold tracking-tight text-slate-900">
                {BRAND}
              </span>
              <span className="text-[12px] text-slate-500">· {BRAND_TAGLINE}</span>
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
              © 2026 · {VERSION} · Enterprise Edition
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
