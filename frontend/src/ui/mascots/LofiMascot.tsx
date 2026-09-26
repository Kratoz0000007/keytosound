import { memo } from 'react';

const TAIL = 'M186 94 Q204 100 202 124 Q200 142 208 154';
const BODY = 'M118 100 Q116 80 140 78 Q170 76 188 86 Q196 92 190 100';

/**
 * Lo-Fi: the studio cat. A sleek dark silhouette lounging on a studio
 * monitor, rim-lit in cyan so it sits in the UI rather than on top of it;
 * its eyes, when they open, catch the amber of the desk lamp.
 * Idle it breathes, sways its tail and gazes out at the city; typing, it
 * opens its eyes and nods along; on a beat the monitor cabinet pulses.
 */
export const LofiMascot = memo(function LofiMascot() {
  return (
    // Lounging in the lower-left corner of its space, not centred in it.
    <svg className="mascot-svg m-lofi" viewBox="0 0 240 200" preserveAspectRatio="xMinYMax meet">
      <defs>
        <filter id="m-lofi-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="m-lofi-cabinet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2540" />
          <stop offset="1" stopColor="#0F1626" />
        </linearGradient>
      </defs>

      <ellipse cx="158" cy="197" rx="52" ry="3.5" fill="#000000" opacity="0.45" />

      {/* The monitor, and the aura that pulses around it on a beat. */}
      <rect
        className="m-lofi-aura"
        x="120"
        y="100"
        width="76"
        height="96"
        rx="8"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="2"
        filter="url(#m-lofi-glow)"
      />
      <rect
        x="120"
        y="100"
        width="76"
        height="96"
        rx="7"
        fill="url(#m-lofi-cabinet)"
        stroke="#1E2C48"
        strokeWidth="1.5"
      />
      <rect x="122" y="101" width="72" height="1.5" rx="0.75" fill="#FFFFFF" opacity="0.08" />
      <circle cx="158" cy="124" r="8" fill="#0A0E17" stroke="#1E2C48" />
      <circle cx="158" cy="124" r="3" fill="#131B2E" />
      <circle cx="158" cy="164" r="21" fill="#0A0E17" stroke="#1E2C48" strokeWidth="1.5" />
      <circle
        className="m-lofi-cone"
        cx="158"
        cy="164"
        r="14"
        fill="#101828"
        stroke="#67E8F9"
        strokeOpacity="0.45"
      />
      <circle cx="158" cy="164" r="5" fill="#0A0E17" />
      <circle cx="130" cy="188" r="1.8" fill="#FF7AC6" filter="url(#m-lofi-glow)" />

      <g className="m-lofi-tail">
        <path d={TAIL} fill="none" stroke="#171B33" strokeWidth="6" strokeLinecap="round" />
        <path
          d={TAIL}
          fill="none"
          stroke="#67E8F9"
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>

      <g className="m-lofi-body">
        <path d={`${BODY} Z`} fill="#171B33" />
        <path d={BODY} fill="none" stroke="#67E8F9" strokeOpacity="0.35" strokeWidth="1.2" />
        <ellipse cx="104" cy="99" rx="9" ry="3.5" fill="#171B33" />
        <ellipse cx="117" cy="100" rx="8" ry="3" fill="#171B33" />
      </g>

      <g className="m-hit">
        <g className="m-tap">
          <g className="m-lofi-head">
            <path
              className="m-lofi-ear m-lofi-ear-l"
              d="M98 72 L101 52 L112 64 Z"
              fill="#171B33"
              stroke="#67E8F9"
              strokeOpacity="0.35"
              strokeLinejoin="round"
            />
            <path
              className="m-lofi-ear m-lofi-ear-r"
              d="M118 64 L128 52 L130 72 Z"
              fill="#171B33"
              stroke="#67E8F9"
              strokeOpacity="0.35"
              strokeLinejoin="round"
            />
            <ellipse cx="114" cy="78" rx="18" ry="15" fill="#171B33" />
            <path
              d="M96 78 Q96 63 114 63 Q132 63 132 78"
              fill="none"
              stroke="#67E8F9"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
            <g
              className="m-lofi-sleep"
              stroke="#5B6B8C"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            >
              <path d="M104 79 Q107 81.5 110 79" />
              <path d="M118 79 Q121 81.5 124 79" />
            </g>
            <g className="m-lofi-awake">
              <ellipse cx="107" cy="78.5" rx="2.6" ry="3.4" fill="#FFC58A" filter="url(#m-lofi-glow)" />
              <ellipse cx="121" cy="78.5" rx="2.6" ry="3.4" fill="#FFC58A" filter="url(#m-lofi-glow)" />
            </g>
            <path d="M112.5 85 L115.5 85 L114 87 Z" fill="#5B6B8C" />
          </g>
        </g>
      </g>
    </svg>
  );
});
