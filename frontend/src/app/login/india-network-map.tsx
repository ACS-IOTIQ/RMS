import india from '@svg-maps/india';
import { cn } from '@/lib/utils';

// Map of India: svg-maps (https://github.com/VictorCazanave/svg-maps), CC BY 4.0.
const REGIONS: { id: string; path: string }[] = india.locations;

// The source map is a Mercator projection; these constants were least-squares
// fitted against known region centres (sub-pixel error), so dots land exactly.
function project(lat: number, lon: number) {
  const mercator = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x: 20.9403 * lon - 1427.953, y: -1201.97 * mercator + 837.896 };
}

type Side = 'left' | 'right';

const PLACES = [
  { name: 'Udhampur', lat: 32.93, lon: 75.14, side: 'right' },
  { name: 'Chandimandir', lat: 30.73, lon: 76.88, side: 'right' },
  { name: 'Delhi', lat: 28.61, lon: 77.21, side: 'right' },
  { name: 'Jaipur', lat: 26.91, lon: 75.79, side: 'left' },
  { name: 'Lucknow', lat: 26.85, lon: 80.95, side: 'right' },
  { name: 'Kolkata', lat: 22.57, lon: 88.36, side: 'right' },
  { name: 'Pune', lat: 18.52, lon: 73.86, side: 'left' },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59, side: 'right' },
] satisfies { name: string; lat: number; lon: number; side: Side }[];

const HUB = 'Delhi';

const LINKS: [string, string][] = [
  [HUB, 'Chandimandir'],
  ['Chandimandir', 'Udhampur'],
  [HUB, 'Jaipur'],
  [HUB, 'Lucknow'],
  [HUB, 'Kolkata'],
  [HUB, 'Pune'],
  [HUB, 'Bengaluru'],
];

const points = PLACES.map((p) => ({ ...p, ...project(p.lat, p.lon) }));
const byName = Object.fromEntries(points.map((p) => [p.name, p]));

const arcs = LINKS.map(([from, to]) => {
  const a = byName[from];
  const b = byName[to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bend = 0.18;
  const cx = (a.x + b.x) / 2 - dy * bend;
  const cy = (a.y + b.y) / 2 + dx * bend;
  return { key: `${from}-${to}`, d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}` };
});

const VB = { x: -12, y: -12, w: 636, h: 720 };
const VIEW_BOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;

export function IndiaNetworkMap({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Map of India connecting ${PLACES.length} locations: ${PLACES.map((p) => p.name).join(', ')}`}
      className={cn('flex items-center justify-center [container-type:size]', className)}
    >
      {/* Aspect-locked stage: largest box of the map's ratio that fits, so the
          HTML labels below can be placed in the same percentage space as the SVGs. */}
      <div
        className="relative"
        style={{ width: `min(100cqw, calc(100cqh * ${VB.w} / ${VB.h}))`, aspectRatio: `${VB.w} / ${VB.h}` }}
      >
        {/* Static layer: land, borders and connection lines. */}
        <svg aria-hidden viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="rosterops-land" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="696">
              <stop offset="0" stopColor="#3b82f6" stopOpacity="0.26" />
              <stop offset="1" stopColor="#2563eb" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <g style={{ filter: 'drop-shadow(0 0 22px rgba(59,130,246,0.35))' }}>
            {REGIONS.map((r) => (
              <path
                key={r.id}
                d={r.path}
                fill="url(#rosterops-land)"
                stroke="rgba(147,197,253,0.3)"
                strokeWidth={0.7}
                strokeLinejoin="round"
              />
            ))}
          </g>
          {arcs.map((arc) => (
            <path key={arc.key} d={arc.d} fill="none" stroke="rgba(96,165,250,0.55)" strokeWidth={1.6} strokeLinecap="round" />
          ))}
        </svg>
  
        {/* Animated layer, kept separate so the detailed land layer isn't repainted every frame. */}
        <svg
          aria-hidden
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          style={{ willChange: 'transform' }}
        >
          {arcs.map((arc, i) => (
            <path
              key={arc.key}
              d={arc.d}
              pathLength={1}
              fill="none"
              stroke="#bae6fd"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeDasharray="0.14 0.86"
              className="map-flow"
              style={{ animationDelay: `${i * 0.45}s` }}
            />
          ))}
  
          {points.map((p, i) => {
            const hub = p.name === HUB;
            const r = hub ? 7 : 5;
            return (
              <g key={p.name}>
                <circle cx={p.x} cy={p.y} r={r} fill="#60a5fa" className="map-pulse" style={{ animationDelay: `${i * 0.35}s` }} />
                <circle cx={p.x} cy={p.y} r={r} fill={hub ? '#ffffff' : '#93c5fd'} stroke={hub ? '#3b82f6' : '#ffffff'} strokeWidth={hub ? 3 : 1.5} />
              </g>
            );
          })}
        </svg>
  
        {/* Labels are HTML so they stay a readable size however small the map gets. */}
        {points.map((p) => {
          const hub = p.name === HUB;
          const gap = hub ? 12 : 9;
          return (
            <span
              key={p.name}
              aria-hidden
              className={cn(
                'pointer-events-none absolute whitespace-nowrap leading-none [text-shadow:0_1px_4px_rgba(0,14,48,0.95)]',
                hub ? 'text-[13px] font-bold text-white 2xl:text-[15px]' : 'text-xs font-semibold text-slate-200 2xl:text-[13px]',
              )}
              style={{
                left: `${((p.x - VB.x) / VB.w) * 100}%`,
                top: `${((p.y - VB.y) / VB.h) * 100}%`,
                transform: p.side === 'right' ? `translate(${gap}px, -50%)` : `translate(calc(-100% - ${gap}px), -50%)`,
              }}
            >
              {p.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
