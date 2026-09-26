import { memo } from 'react';
import { drift } from './motion';

const SCALE = '#8A2BE2';
const SCALE_DARK = '#5A1A9E';
const SCALE_LIGHT = '#B14CFF';
const TOXIC = '#39FF14';
const PINK = '#FF0055';
const CYAN = '#00F0FF';
const INK = '#151522';
const STEEL = '#1F1F33';

/** Sparks thrown back off the wheels, and where each streams to. */
const TRAIL = [
  { x: 92, dx: -120, dy: 2, delay: '0s', color: TOXIC },
  { x: 158, dx: -140, dy: -2, delay: '-0.12s', color: CYAN },
  { x: 92, dx: -100, dy: -4, delay: '-0.24s', color: PINK },
  { x: 158, dx: -130, dy: 4, delay: '-0.36s', color: TOXIC },
  { x: 92, dx: -150, dy: 0, delay: '-0.48s', color: CYAN },
  { x: 158, dx: -110, dy: -3, delay: '-0.6s', color: PINK },
];

/** Plasma blobs flung out in the breath. */
const BLOBS = [
  { dx: 70, dy: -14, r: 4, color: CYAN },
  { dx: 88, dy: 6, r: 3, color: PINK },
  { dx: 60, dy: 16, r: 3.5, color: '#FFFFFF' },
  { dx: 96, dy: -4, r: 2.5, color: CYAN },
];

/**
 * Synthwave: the cyber dragon skater. A violet-scaled dragon with a
 * toxic-green belly, bat wings, a helmet with a glowing visor and pink
 * headphones, crouched on a neon skateboard.
 *
 * Idle, it hovers on its board, wings swaying, the headphones pulsing pink.
 * Typing, it carves: board and rider tilt at the typing tempo and the
 * wheels stream neon sparks across the floor; past 80 wpm it kickflips.
 * On a beat its jaws open on a burst of cyan and pink plasma while an RGB
 * split flashes across the whole frame.
 *
 * Everything moves in CSS (mascots.css), off the stage's data-state,
 * data-overdrive, data-tap and data-hit and its --m-tempo.
 */
export const CyberDragonSkaterMascot = memo(function CyberDragonSkaterMascot() {
  return (
    <svg className="mascot-svg m-dragon" viewBox="0 0 240 200">
      <defs>
        <linearGradient id="m-dragon-scales" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SCALE_LIGHT} />
          <stop offset="0.5" stopColor={SCALE} />
          <stop offset="1" stopColor={SCALE_DARK} />
        </linearGradient>
        <linearGradient id="m-dragon-belly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7DFF5C" />
          <stop offset="1" stopColor="#1FB80A" />
        </linearGradient>
        <linearGradient id="m-dragon-plasma" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.25" stopColor={PINK} />
          <stop offset="0.7" stopColor={CYAN} />
          <stop offset="1" stopColor={CYAN} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="m-dragon-deck" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={PINK} />
          <stop offset="1" stopColor={CYAN} />
        </linearGradient>
        <filter id="m-dragon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* The floor, lit where the board passes over it. */}
      <ellipse className="m-dragon-floor" cx="125" cy="192" rx="70" ry="4" fill={PINK} opacity="0.55" filter="url(#m-dragon-glow)" />

      {/* Neon sparks streaming back off the wheels while it rides. */}
      <g filter="url(#m-dragon-glow)">
        {TRAIL.map((t, i) => (
          <rect
            key={i}
            className="m-dragon-spark"
            x={t.x - 2}
            y="180"
            width="5"
            height="3"
            fill={t.color}
            style={{ ...drift(t.dx, t.dy), animationDelay: t.delay }}
          />
        ))}
      </g>

      <g className="m-dragon-hover">
        <g className="m-dragon-tilt">
          {/* The board: pink-to-cyan deck, dark trucks, glowing green wheels. */}
          <g className="m-dragon-board">
            <path
              d="M64 160 Q70 169 84 169 L166 169 Q180 169 186 160 L183 158 Q176 165 164 165 L86 165 Q74 165 67 158 Z"
              fill="url(#m-dragon-deck)"
              filter="url(#m-dragon-glow)"
            />
            <rect x="86" y="169" width="14" height="4" fill={STEEL} />
            <rect x="151" y="169" width="14" height="4" fill={STEEL} />
            <circle className="m-dragon-wheel" cx="93" cy="177" r="5.5" fill={TOXIC} stroke={INK} strokeWidth="1.5" filter="url(#m-dragon-glow)" />
            <circle className="m-dragon-wheel" cx="158" cy="177" r="5.5" fill={TOXIC} stroke={INK} strokeWidth="1.5" filter="url(#m-dragon-glow)" />
            <circle cx="93" cy="177" r="1.6" fill={CYAN} />
            <circle cx="158" cy="177" r="1.6" fill={CYAN} />
          </g>

          <g className="m-dragon-rider">
            <g className="m-tap">
              {/*
                Wings, spread behind: bat wings, a finger bone from the wrist
                to each tip and the membrane scalloped between them. Violet
                skin, toxic-green bones.
              */}
              <g className="m-dragon-wings">
                <path
                  d="M116 96 L86 50 L56 58 Q70 66 62 82 Q78 82 76 98 Q92 96 102 106 Z"
                  fill={SCALE_DARK}
                  fillOpacity="0.88"
                />
                <path
                  d="M116 96 L86 50 M86 50 L56 58 M86 50 L62 82 M86 50 L76 98"
                  fill="none"
                  stroke={TOXIC}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M122 94 L104 38 L80 42 Q92 52 84 64 Q98 66 96 80 Q108 82 114 98 Z"
                  fill={SCALE}
                  fillOpacity="0.92"
                />
                <path
                  d="M122 94 L104 38 M104 38 L80 42 M104 38 L84 64 M104 38 L96 80"
                  fill="none"
                  stroke={TOXIC}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle cx="104" cy="38" r="2.2" fill={TOXIC} />
                <circle cx="86" cy="50" r="2.2" fill={TOXIC} />
              </g>

              {/* Tail: sweeping back and curling up, spiked along its back. */}
              <path
                d="M108 128 Q78 138 60 156 Q48 168 36 160 Q28 152 36 142 Q42 150 50 148 Q66 132 104 120 Z"
                fill="url(#m-dragon-scales)"
                stroke={SCALE_DARK}
                strokeWidth="1"
              />
              <path d="M62 148 l-4 -8 l8 4 Z M76 138 l-3 -9 l8 5 Z M90 130 l-2 -9 l7 6 Z" fill={TOXIC} />
              <path d="M36 142 l-8 -6 l10 -2 Z" fill={TOXIC} />

              {/* Back leg: bent hard, knee pad, clawed foot on the deck. */}
              <path d="M112 132 L98 150 L102 163" fill="none" stroke={SCALE_DARK} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="98" cy="150" r="6.5" fill={STEEL} stroke={PINK} strokeWidth="1.5" />
              <path d="M92 165 L112 165 L114 160 L96 159 Z" fill={SCALE_DARK} />
              <path d="M112 165 l4 -2 M113 162 l4 -1" stroke={TOXIC} strokeWidth="1.6" strokeLinecap="round" />

              {/* Back arm, thrown out for balance. */}
              <path d="M112 106 L96 118 L82 110" fill="none" stroke={SCALE_DARK} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M82 110 l-5 -4 M82 110 l-6 1 M82 110 l-4 5" stroke={TOXIC} strokeWidth="1.6" strokeLinecap="round" />

              {/* Torso, leaning into the ride, with its armoured green belly. */}
              <path d="M110 96 Q126 86 138 96 Q147 116 138 136 Q124 143 107 136 Q99 116 110 96 Z" fill="url(#m-dragon-scales)" />
              <path d="M119 100 Q131 98 135 110 Q137 124 131 134 Q121 137 115 130 Q112 114 119 100 Z" fill="url(#m-dragon-belly)" />
              <path d="M116 110 L136 109 M114 118 L137 118 M115 126 L135 127" stroke="#1FB80A" strokeWidth="1.2" />
              <path d="M110 96 Q104 112 106 128" fill="none" stroke={SCALE_LIGHT} strokeOpacity="0.6" strokeWidth="1.5" />

              {/* Neck, green down the throat. */}
              <path d="M117 99 Q123 80 134 71 L147 78 Q137 88 132 101 Z" fill="url(#m-dragon-scales)" />
              <path d="M132 101 Q137 88 147 78 L143 76 Q133 86 128 100 Z" fill="url(#m-dragon-belly)" />

              {/* Front leg: knee up, pad, foot braced near the nose of the board. */}
              <path d="M126 134 L145 145 L140 163" fill="none" stroke={SCALE} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="145" cy="145" r="6.5" fill={STEEL} stroke={PINK} strokeWidth="1.5" />
              <path d="M132 165 L154 165 L156 160 L136 159 Z" fill={SCALE} />
              <path d="M154 165 l4 -2 M155 162 l4 -1" stroke={TOXIC} strokeWidth="1.6" strokeLinecap="round" />

              <g className="m-dragon-head">
                {/* Horns, swept back off the helmet. */}
                <path d="M132 46 Q118 32 110 22 Q124 28 138 40 Z" fill={SCALE_LIGHT} stroke={SCALE_DARK} strokeWidth="1" />
                <path d="M140 42 Q132 26 128 14 Q140 22 146 38 Z" fill={SCALE_LIGHT} stroke={SCALE_DARK} strokeWidth="1" />

                {/* Skull and upper jaw, snout forward. */}
                <path d="M128 60 Q131 44 150 44 Q164 46 170 55 L187 61 Q192 66 187 70 L171 72 Q160 79 146 79 Q130 77 128 60 Z" fill="url(#m-dragon-scales)" stroke={SCALE_DARK} strokeWidth="1" />
                <path d="M172 72 l3 4 l3 -4 Z M178 71 l3 4 l2 -4 Z M166 73 l3 4 l3 -4 Z" fill="#FFFFFF" />
                <circle cx="184" cy="63" r="1.3" fill={INK} />

                {/* The lower jaw, hinged at the back so it can drop open. */}
                <g className="m-dragon-jaw">
                  <path d="M150 76 L182 72 Q186 75 182 79 L154 83 Q148 81 150 76 Z" fill={SCALE_DARK} />
                  <path d="M154 80 L180 76" stroke="#FF6A9A" strokeWidth="2" strokeLinecap="round" />
                </g>

                {/* The helmet, and the visor glowing where the eye sits behind it. */}
                <path d="M126 62 Q123 38 146 35 Q161 35 167 47 L160 52 Q146 44 134 50 Q130 56 131 63 Z" fill={STEEL} stroke={CYAN} strokeWidth="1.3" />
                <path className="m-dragon-visor" d="M145 50 L172 54 L169 61 L145 58 Z" fill={TOXIC} filter="url(#m-dragon-glow)" />
                <path d="M152 53 L166 55" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.2" />

                {/* Headphones: a band over the helmet, a pink cup over the ear. */}
                <path d="M133 54 Q138 32 158 38" fill="none" stroke={PINK} strokeWidth="3" strokeLinecap="round" />
                <circle className="m-dragon-phones" cx="133" cy="60" r="7.5" fill={PINK} stroke={CYAN} strokeWidth="1.2" filter="url(#m-dragon-glow)" />
                <circle cx="133" cy="60" r="3" fill={INK} />
              </g>

              {/* Front arm, reaching ahead with its wristband lit. */}
              <path d="M132 104 L150 113 L166 104" fill="none" stroke={SCALE} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="157" y="104" width="6" height="7" fill={CYAN} transform="rotate(-30 160 107)" filter="url(#m-dragon-glow)" />
              <path d="M166 104 l6 -3 M166 104 l6 2 M166 104 l3 6" stroke={TOXIC} strokeWidth="1.6" strokeLinecap="round" />

              {/* The breath: a cone of plasma from the open jaws, blobs flung ahead. */}
              <g transform="translate(184 74)">
                <g className="m-dragon-plasma">
                  <path d="M0 0 L78 -20 Q94 0 78 20 Z" fill="url(#m-dragon-plasma)" filter="url(#m-dragon-glow)" />
                  <path d="M0 0 L52 -8 Q60 0 52 8 Z" fill="#FFFFFF" opacity="0.85" />
                  {BLOBS.map((b, i) => (
                    <circle key={i} className="m-dragon-blob" r={b.r} fill={b.color} style={drift(b.dx, b.dy)} />
                  ))}
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
});
