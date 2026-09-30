// Generated from the calibrated reference layout (scratchpad/exact/export_ts.py). Units are CSS px on the
// 1440 × 810 artwork; the section converts them to container-query units so the whole stage scales together.

export type StageLine = { text: string; left: number; top: number; size: number; tracking: number; weight: number; color: string };

export const STAGE = { width: 1440, height: 810 };

export const PILL = { left: 114.55, top: 31.87, width: 141.24, height: 33.59, dot: 15.50 };

export const PILL_LABEL: StageLine[] = [
  { text: "HOW IT WORKS", left: 141.13, top: 41.85, size: 13.52, tracking: 0.41, weight: 600, color: '#a6e7ff' },
];

export const HEADLINE: StageLine[] = [
  { text: "From setup to a published", left: 112.61, top: 82.20, size: 57.30, tracking: -0.86, weight: 700, color: '#ffffff' },
  { text: "roster in", left: 113.61, top: 135.60, size: 57.30, tracking: -0.86, weight: 700, color: '#ffffff' },
  { text: "four steps.", left: 336.15, top: 135.60, size: 57.30, tracking: -0.86, weight: 700, color: '#069afe' },
];

export const SUBTITLE: StageLine[] = [
  { text: "Onboard your organization, add your workforce, define policies", left: 115.11, top: 206.15, size: 20.50, tracking: -0.21, weight: 400, color: '#dae6fc' },
  { text: "and publish rosters — all in one platform.", left: 115.61, top: 233.02, size: 20.50, tracking: -0.21, weight: 400, color: '#dae6fc' },
];

export const STEPS: { icon: { x: number; y: number; r: number }; title: StageLine[]; body: StageLine[] }[] = [
  {
    icon: { x: 173.97, y: 592.97, r: 25.84 },
    title: [
      { text: "Set up your", left: 223.04, top: 571.90, size: 19.59, tracking: -0.39, weight: 700, color: '#ffffff' },
      { text: "organization", left: 223.54, top: 594.08, size: 19.69, tracking: -0.39, weight: 700, color: '#ffffff' },
    ],
    body: [
      { text: "Create your company,", left: 223.04, top: 624.78, size: 14.13, tracking: -0.35, weight: 400, color: '#dde9f7' },
      { text: "locations and each", left: 223.71, top: 645.80, size: 14.56, tracking: -0.36, weight: 400, color: '#dde9f7' },
      { text: "site’s details.", left: 223.04, top: 666.98, size: 14.88, tracking: -0.37, weight: 400, color: '#dde9f7' },
    ],
  },
  {
    icon: { x: 489.62, y: 592.97, r: 25.84 },
    title: [
      { text: "Add your", left: 538.83, top: 571.23, size: 18.48, tracking: -0.37, weight: 700, color: '#ffffff' },
      { text: "workforce", left: 538.83, top: 594.08, size: 18.08, tracking: -0.36, weight: 700, color: '#ffffff' },
    ],
    body: [
      { text: "Add employees with roles,", left: 538.83, top: 624.11, size: 14.76, tracking: -0.37, weight: 400, color: '#dde9f7' },
      { text: "departments and locations", left: 539.50, top: 645.80, size: 14.70, tracking: -0.37, weight: 400, color: '#dde9f7' },
      { text: "manually or via import.", left: 539.00, top: 667.48, size: 15.02, tracking: -0.38, weight: 400, color: '#dde9f7' },
    ],
  },
  {
    icon: { x: 816.46, y: 592.97, r: 25.84 },
    title: [
      { text: "Define the policy", left: 866.80, top: 581.07, size: 19.15, tracking: -0.38, weight: 700, color: '#ffffff' },
    ],
    body: [
      { text: "Set working hours, shifts,", left: 866.64, top: 623.44, size: 14.77, tracking: -0.37, weight: 400, color: '#dde9f7' },
      { text: "leaves and location-based", left: 867.30, top: 645.13, size: 14.88, tracking: -0.37, weight: 400, color: '#dde9f7' },
      { text: "rules.", left: 866.14, top: 666.82, size: 15.50, tracking: -0.39, weight: 400, color: '#dde9f7' },
    ],
  },
  {
    icon: { x: 1137.27, y: 592.97, r: 25.84 },
    title: [
      { text: "Preview, publish", left: 1186.43, top: 571.73, size: 17.63, tracking: -0.35, weight: 700, color: '#ffffff' },
      { text: "and manage", left: 1186.27, top: 593.58, size: 18.93, tracking: -0.38, weight: 700, color: '#ffffff' },
    ],
    body: [
      { text: "Review rosters, share with", left: 1185.27, top: 624.11, size: 14.56, tracking: -0.36, weight: 400, color: '#dde9f7' },
      { text: "employees and export", left: 1186.27, top: 645.80, size: 14.65, tracking: -0.37, weight: 400, color: '#dde9f7' },
      { text: "in one click.", left: 1185.77, top: 666.98, size: 14.96, tracking: -0.37, weight: 400, color: '#dde9f7' },
    ],
  },
];
