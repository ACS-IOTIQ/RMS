// Static light-ribbon background for the hero, traced from the reference artwork (254 × 137 units,
// stretched to the section). No animation by design.
export function HeroRibbons() {
  return (
    <svg aria-hidden="true" viewBox="0 0 254 137" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 block h-full w-full">
      <defs>
        <linearGradient id="rb-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#030f2c" />
          <stop offset="1" stopColor="#051337" />
        </linearGradient>
        <linearGradient id="rb-right" x1="150" y1="0" x2="254" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0c1f52" stopOpacity="0" />
          <stop offset="1" stopColor="#0c1f52" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="rb-bandfade" x1="0" y1="0" x2="170" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="rb-band-mask" maskUnits="userSpaceOnUse" x="-10" y="0" width="280" height="137">
          <rect x="-10" width="280" height="137" fill="url(#rb-bandfade)" />
        </mask>
        <radialGradient id="rb-sky" gradientUnits="userSpaceOnUse" cx="232" cy="-14" r="1" gradientTransform="translate(232 -14) scale(135 84) translate(-232 14)">
          <stop offset="0" stopColor="#2f58bc" stopOpacity="1" />
          <stop offset="0.4" stopColor="#20429c" stopOpacity="0.8" />
          <stop offset="0.75" stopColor="#112b6c" stopOpacity="0.42" />
          <stop offset="1" stopColor="#0a1c4c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rb-band" x1="64" y1="62" x2="55" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d5cf5" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#3d62f5" stopOpacity="0.42" />
          <stop offset="1" stopColor="#4a70ff" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="rb-glow" x1="0" y1="0" x2="254" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5a7dff" stopOpacity="0.9" />
          <stop offset="0.2" stopColor="#3f73ff" stopOpacity="0.7" />
          <stop offset="0.42" stopColor="#3a6cf5" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#3566e8" stopOpacity="0.22" />
          <stop offset="0.7" stopColor="#4a86ff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#4a86ff" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="rb-core" x1="0" y1="0" x2="254" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.1" stopColor="#eef4ff" stopOpacity="1" />
          <stop offset="0.18" stopColor="#c4dcff" stopOpacity="0.95" />
          <stop offset="0.38" stopColor="#a4c8ff" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#86b4ff" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#86b8ff" stopOpacity="0.35" />
          <stop offset="0.7" stopColor="#b4e2ff" stopOpacity="0.95" />
          <stop offset="0.85" stopColor="#9fd2ff" stopOpacity="0.65" />
          <stop offset="1" stopColor="#9fd2ff" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="rb-under" x1="0" y1="0" x2="150" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a5cff" stopOpacity="0.42" />
          <stop offset="0.6" stopColor="#2f58f0" stopOpacity="0.3" />
          <stop offset="1" stopColor="#2f58f0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rb-thin" x1="0" y1="0" x2="130" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#cdbdff" stopOpacity="0.6" />
          <stop offset="0.5" stopColor="#8fa6ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6f8cff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rb-low" x1="120" y1="112" x2="225" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1f47c8" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#2a66ee" stopOpacity="0.42" />
          <stop offset="1" stopColor="#3f8dff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="rb-streak" x1="140" y1="0" x2="218" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8fdcff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#8fdcff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#9fe4ff" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="rb-flare" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.45" stopColor="#dfe4ff" stopOpacity="0.65" />
          <stop offset="1" stopColor="#7d86ff" stopOpacity="0" />
        </radialGradient>
        <filter id="rb-b0" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="0.3" /></filter>
        <filter id="rb-b1" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="0.5" /></filter>
        <filter id="rb-b2" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <filter id="rb-b3" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id="rb-b5" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <rect width="254" height="137" fill="url(#rb-base)" />
      <rect width="254" height="137" fill="url(#rb-right)" />
      <rect width="254" height="137" fill="url(#rb-sky)" />
      {/* big translucent sheet on the left: faint body, brighter along its curved edge and the left border */}
      <path d="M0 9 C18 7 32 10 42 19 C55 31 66 50 78 73 C83 82 88 88 100 97 L115 110 C80 100 40 84 0 66 Z" fill="#2c4fd8" fillOpacity="0.28" filter="url(#rb-b1)" />
      <path d="M-2 11 C18 7 32 10 42 19 C55 31 66 50 78 73 C83 82 88 88 100 97" fill="none" stroke="#4c6ff0" strokeOpacity="0.38" strokeWidth="7" filter="url(#rb-b3)" />
      <path d="M0 9 C18 7 32 10 42 19 C55 31 66 50 78 73 C83 82 88 88 100 97" fill="none" stroke="#6d8fff" strokeOpacity="0.25" strokeWidth="0.9" filter="url(#rb-b1)" />
      <path d="M1 12 L1 60" fill="none" stroke="#4a66ee" strokeOpacity="0.45" strokeWidth="7" filter="url(#rb-b3)" />
      {/* band between the thin upper line and the sweep */}
      <path d="M0 45 C22 52 45 64 70 74 C90 82 115 89 170 101 L125 112 C72 104 30 78 -4 62 Z" fill="url(#rb-band)" filter="url(#rb-b2)" mask="url(#rb-band-mask)" />
      <path d="M0 45 C22 52 45 64 70 74 C90 82 110 88 140 96" fill="none" stroke="url(#rb-thin)" strokeWidth="0.7" opacity="0.6" filter="url(#rb-b1)" />
      {/* soft glow just under the sweep */}
      <path d="M-4 62.5 C30 78 72 104 125 111 C140 114 155 116 170 117 C140 118 110 115 70 106 C45 101 20 94 -4 84 Z" fill="url(#rb-under)" filter="url(#rb-b1)" />
      <path d="M-4 84 C20 94 35 99 45 102 C52 112 55 124 59 139 L-4 139 Z" fill="#2c4ee0" fillOpacity="0.05" filter="url(#rb-b1)" />
      <path d="M-4 86 C12 93 25 97 33 101 C42 108 52 120 59 139" fill="none" stroke="#4a66f0" strokeOpacity="0.18" strokeWidth="1.2" filter="url(#rb-b1)" />
      <path d="M-4 67 C30 82 72 107 125 115 C140 117 150 118 160 118" fill="none" stroke="url(#rb-under)" strokeWidth="8" filter="url(#rb-b3)" />
      {/* lower-right ribbon: thin top edge, then a diagonal bright streak into the corner */}
      <path d="M108 110 C135 116 165 121 200 123 C225 124 242 122 256 119 L256 139 L190 139 C165 129 135 118 108 112 Z" fill="url(#rb-low)" filter="url(#rb-b2)" />
      <path d="M118 113 C140 117.5 165 121 200 123 C225 124 242 122 256 119" fill="none" stroke="#7fa8ff" strokeOpacity="0.35" strokeWidth="0.9" filter="url(#rb-b1)" />
      <path d="M140 119 C165 124 188 130 218 141" fill="none" stroke="url(#rb-streak)" strokeWidth="5" filter="url(#rb-b2)" />
      <ellipse cx="212" cy="141" rx="34" ry="10" fill="#4f9dff" fillOpacity="0.5" filter="url(#rb-b5)" />
      {/* main light sweep, its thin continuation and the arc rising on the right */}
      <path d="M-4 62.5 C30 78 72 104 125 111 C140 114 162 115 180 111 C198 107 232 93 258 77" fill="none" stroke="url(#rb-glow)" strokeWidth="6.5" filter="url(#rb-b2)" />
      <path d="M-4 62.5 C30 78 72 104 125 111 C140 114 162 115 180 111 C198 107 232 93 258 77" fill="none" stroke="url(#rb-core)" strokeWidth="0.8" filter="url(#rb-b0)" />
      <path d="M-4 59 C12 66.5 26 75 42 85 C26 77.5 12 71 -4 66.5 Z" fill="#ffffff" fillOpacity="0.55" filter="url(#rb-b1)" />
      <ellipse cx="3" cy="66" rx="13" ry="4.5" fill="url(#rb-flare)" opacity="0.6" transform="rotate(25 3 66)" filter="url(#rb-b2)" />
    </svg>
  );
}
