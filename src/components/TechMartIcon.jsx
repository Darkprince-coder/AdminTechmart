// src/components/TechMartIcon.jsx
// The approved TechMart T-Chart mark.
//
// Geometry (100×100 coordinate grid):
//   Five ascending bars anchored at baseline y=47.
//   Crossbar at y=47, width=60, forming the horizontal stroke of the T.
//   Stem from y=52 to y=85, forming the vertical stroke of the T.
//   The centre bar (x=46) aligns exactly with the stem — the hidden T is
//   revealed only on close inspection.
//
// Usage:
//   <TechMartIcon size={40} color="#00C48C" />
//
// color defaults to "currentColor" so the icon inherits its parent's CSS color.
 
export default function TechMartIcon({ size = 24, color = 'currentColor', style = {} }) {
  const f = color;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Five ascending bars */}
      <rect x="24" y="37" width="8" height="10" rx="2" fill={f} />
      <rect x="35" y="29" width="8" height="18" rx="2" fill={f} />
      <rect x="46" y="21" width="8" height="26" rx="2" fill={f} />
      <rect x="57" y="13" width="8" height="34" rx="2" fill={f} />
      <rect x="68" y="5"  width="8" height="42" rx="2" fill={f} />
      {/* Crossbar — horizontal stroke of the T */}
      <rect x="20" y="47" width="60" height="5" rx="2" fill={f} />
      {/* Stem — vertical stroke of the T */}
      <rect x="46" y="52" width="8"  height="33" rx="2" fill={f} />
    </svg>
  );
}
 