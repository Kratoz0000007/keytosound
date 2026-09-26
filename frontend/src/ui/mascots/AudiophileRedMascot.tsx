import { memo } from 'react';
import { drift } from './motion';

const RED = '#D42320';
const GOLD = '#D4AF37';
const PALE_GOLD = '#E5C158';
const BROW = '#2A0F0A';

/** Centre and radius of the round body, in viewBox units. */
const CX = 152;
const CY = 128;
const R = 46;

/**
 * Where the ear canal opens, in viewBox units: the stave, the notes, the
 * drifting sparks and the beat's soundwaves all aim here. It follows from
 * the ear's transform below (translate 138 118, rotate -18) applied to the
 * canal's local position (-10, -34).
 */
const CANAL = { x: 118, y: 88.75 };

/**
 * The stave pouring down from above the card, where the terminal is, and
 * funnelling into the ear: five lines fanned wide at the top, drawn in to
 * the canal.
 */
const STAVE = [0, 1, 2, 3, 4].map((i) => {
  const x0 = -6 + i * 10;
  const x1 = CANAL.x - 3 + i * 1.5;
  const y1 = CANAL.y - 3 + i * 1.5;
  return `M${x0} -34 C${x0 + 6} 6 ${x0 + 40 - i * 4} 50 ${x1} ${y1}`;
});

/** Notes riding the stream from above the card into the ear, one after another. */
const RIDERS = ['♩', '♪', '♫', '♪', '♬'].map((glyph, i) => ({ glyph, delay: `${-i * 0.36}s` }));
const RIDE_FROM = { x: 20, y: -24 };

/** Gold motes drifting in from the air around the ear, and where each starts. */
const MOTES = [
  { x: 40, y: 40, delay: '0s' },
  { x: 72, y: 4, delay: '-0.5s' },
  { x: 18, y: 70, delay: '-1s' },
  { x: 90, y: 28, delay: '-1.5s' },
  { x: 54, y: 60, delay: '-2s' },
];

/** Glints twinkling inside the lit bowl of the ear, in the ear's own coordinates. */
const GLINTS = [
  { x: -22, y: -70, delay: '0s' },
  { x: -30, y: -52, delay: '0.4s' },
  { x: -14, y: -58, delay: '0.9s' },
  { x: -20, y: -42, delay: '1.3s' },
];

/**
 * Classical: the angry bird listening meme, with Red in the starring role.
 * A round red bird leaning toward the typing, delighted, an enormous human
 * ear sprouting from the top of its head and turned up to catch every note,
 * the inside of the ear lit gold. A golden stave pours into the canal from
 * above, notes riding it in.
 *
 * Idle, the ear pulses as it listens and gold motes drift into the canal.
 * Typing, the notes pour in faster as wpm climbs, the ear vibrates and the
 * brows furrow in concentration. On a beat the ear swells in a comic pulse
 * and fires rings of gold sound out of the canal.
 *
 * Everything moves in CSS (mascots.css), off the stage's data-state,
 * data-tap and data-hit and its --m-tempo. The canal is .m-red-canal, which
 * themes/fx/classical.ts aims the caret's notes at.
 */
export const AudiophileRedMascot = memo(function AudiophileRedMascot() {
  return (
    <svg className="mascot-svg m-red" viewBox="0 0 240 200">
      <defs>
        <radialGradient id="m-red-aura" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={PALE_GOLD} stopOpacity="0.35" />
          <stop offset="0.6" stopColor={GOLD} stopOpacity="0.1" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="m-red-body" cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#F2473B" />
          <stop offset="0.5" stopColor={RED} />
          <stop offset="1" stopColor="#7E0A0E" />
        </radialGradient>
        <radialGradient id="m-red-skin" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#F0503F" />
          <stop offset="1" stopColor="#A5171A" />
        </radialGradient>
        {/* The inside of the ear, lit gold from the canal outward. */}
        <radialGradient id="m-red-bowl" gradientUnits="userSpaceOnUse" cx="-12" cy="-40" r="54">
          <stop offset="0" stopColor="#FFF3C4" />
          <stop offset="0.3" stopColor={PALE_GOLD} />
          <stop offset="0.7" stopColor="#B7791F" />
          <stop offset="1" stopColor="#6E2A0A" />
        </radialGradient>
        <radialGradient id="m-red-hole" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1A0402" />
          <stop offset="0.7" stopColor="#4A1206" />
          <stop offset="1" stopColor="#B7791F" />
        </radialGradient>
        <linearGradient id="m-red-stave" gradientUnits="userSpaceOnUse" x1="10" y1="-34" x2={CANAL.x} y2={CANAL.y}>
          <stop offset="0" stopColor={GOLD} stopOpacity="0" />
          <stop offset="0.35" stopColor={GOLD} stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFF3C4" stopOpacity="1" />
        </linearGradient>
        <clipPath id="m-red-clip">
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
        <filter id="m-red-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="m-red-aura" cx={CX - 14} cy={CY - 30} r="96" fill="url(#m-red-aura)" />
      <ellipse cx={CX} cy="190" rx="42" ry="5" fill="#000" opacity="0.35" />

      {/* The whole bird leans in toward the terminal above. */}
      <g className="m-red-lean">
        {/* Tail: three black feathers flicked out behind. */}
        <path d={`M${CX - 40} ${CY + 22} l-22 3 l20 4 l-18 9 l22 -3 l-12 12 l20 -11 Z`} fill="#141014" />

        <g className="m-red-body">
          {/* Crest: two rounded red feathers on top. */}
          <path d={`M${CX + 4} ${CY - 42} C${CX - 2} ${CY - 60} ${CX + 14} ${CY - 70} ${CX + 24} ${CY - 64} C${CX + 16} ${CY - 58} ${CX + 16} ${CY - 50} ${CX + 16} ${CY - 44} Z`} fill={RED} />
          <path d={`M${CX + 16} ${CY - 44} C${CX + 16} ${CY - 58} ${CX + 30} ${CY - 64} ${CX + 38} ${CY - 56} C${CX + 28} ${CY - 54} ${CX + 26} ${CY - 48} ${CX + 24} ${CY - 40} Z`} fill="#B81A1A" />

          <circle cx={CX} cy={CY} r={R} fill="url(#m-red-body)" />
          {/* A pale belly, clipped to the round of the body. */}
          <ellipse cx={CX + 6} cy={CY + 40} rx="36" ry="20" fill="#F1D9BC" clipPath="url(#m-red-clip)" />
          {/* Gold rim light, as if the whole bird glows with the music. */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={PALE_GOLD} strokeOpacity="0.55" strokeWidth="1.6" filter="url(#m-red-glow)" />
          <path
            d={`M${CX - 26} ${CY - 34} A${R} ${R} 0 0 1 ${CX + 22} ${CY - 40}`}
            fill="none"
            stroke="#FF9A7A"
            strokeOpacity="0.5"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Big eyes, glancing up toward the music. */}
          <ellipse cx={CX + 8} cy={CY - 8} rx="12" ry="13.5" fill="#FFFFFF" />
          <ellipse cx={CX + 34} cy={CY - 4} rx="11" ry="12.5" fill="#FFFFFF" />
          <circle cx={CX + 5} cy={CY - 11} r="5.2" fill="#2A1208" />
          <circle cx={CX + 31} cy={CY - 7} r="4.8" fill="#2A1208" />
          <circle cx={CX + 3.4} cy={CY - 13} r="1.5" fill="#FFFFFF" />
          <circle cx={CX + 29.5} cy={CY - 9} r="1.4" fill="#FFFFFF" />

          {/* The brows: two thick dark bars, angled into a scowl of concentration. */}
          <g className="m-tap">
            <g className="m-red-brows">
              <path d={`M${CX - 8} ${CY - 30} L${CX + 20} ${CY - 20} L${CX + 20} ${CY - 13} L${CX - 7} ${CY - 22} Z`} fill={BROW} />
              <path d={`M${CX + 24} ${CY - 18} L${CX + 50} ${CY - 26} L${CX + 50} ${CY - 18} L${CX + 25} ${CY - 11} Z`} fill={BROW} />
            </g>
          </g>

          {/* The beak, flung open in delight: dark mouth, a red tongue, a gold lower rim. */}
          <path d={`M${CX + 16} ${CY + 18} Q${CX + 38} ${CY + 18} ${CX + 54} ${CY + 14} Q${CX + 48} ${CY + 40} ${CX + 28} ${CY + 44} Q${CX + 14} ${CY + 42} ${CX + 12} ${CY + 28} Z`} fill="#4A0806" />
          <path d={`M${CX + 18} ${CY + 36} Q${CX + 30} ${CY + 28} ${CX + 44} ${CY + 34} Q${CX + 38} ${CY + 44} ${CX + 26} ${CY + 43} Q${CX + 18} ${CY + 41} ${CX + 18} ${CY + 36} Z`} fill="#E4574B" />
          <path d={`M${CX + 54} ${CY + 14} Q${CX + 48} ${CY + 40} ${CX + 28} ${CY + 44} Q${CX + 14} ${CY + 42} ${CX + 12} ${CY + 28}`} fill="none" stroke="#F0A812" strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${CX + 12} ${CY + 4} Q${CX + 36} ${CY - 4} ${CX + 62} ${CY + 12} Q${CX + 38} ${CY + 20} ${CX + 12} ${CY + 20} Z`} fill="#F6C21C" stroke="#C88A06" strokeWidth="1" />
        </g>

        {/*
          The giant ear, sprouting from the top left of the head and turned
          up toward the terminal. Drawn upright in its own coordinates, the
          join to the head at the bottom. Two wrappers so the beat's pulse
          and the idle/typing motion never fight over one transform.
        */}
        <g className="m-red-ear-hit">
          <g className="m-red-ear-live">
            <g transform="translate(138 118) rotate(-18)">
              {/* The outer ear: a tall leaf, broad and round at the top, narrowing to the lobe. */}
              <path
                d="M6 0 C10 -30 14 -70 -6 -96 C-18 -110 -44 -104 -48 -78 C-52 -52 -40 -34 -30 -18 C-22 -6 -8 2 6 0 Z"
                fill="url(#m-red-skin)"
                stroke="#7E0B0D"
                strokeWidth="1.2"
              />
              {/* The bowl, lit gold from within. */}
              <path
                d="M0 -8 C4 -34 6 -68 -10 -88 C-20 -98 -38 -92 -40 -74 C-42 -54 -32 -40 -24 -26 C-18 -16 -8 -8 0 -8 Z"
                fill="url(#m-red-bowl)"
              />
              {/* The helix, rolled over along the rim. */}
              <path d="M-4 -92 C-18 -102 -42 -96 -44 -76 C-46 -56 -36 -40 -28 -26" fill="none" stroke="#FF8468" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
              {/* The antihelix, a ridge of shadow inside the glow. */}
              <path d="M-6 -80 C-22 -82 -30 -64 -24 -48 C-20 -38 -12 -32 -10 -22" fill="none" stroke="#8E3A12" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
              {GLINTS.map((g, i) => (
                <circle key={i} className="m-red-glint" cx={g.x} cy={g.y} r="1.4" fill="#FFFBEA" style={{ animationDelay: g.delay }} />
              ))}
              {/* The canal: the hole everything pours into. */}
              <ellipse className="m-red-canal" cx="-10" cy="-34" rx="5.5" ry="7" fill="url(#m-red-hole)" />
              {/* The tragus, a little flap guarding the canal. */}
              <path d="M1 -42 Q8 -34 1 -25" fill="#E24A3E" stroke="#8E1012" strokeWidth="1.2" />
            </g>
          </g>
        </g>

        {/*
          The stream of sound: stave lines, and pulses of light running down
          them. Drawn over the ear, so they visibly pour into the canal.
        */}
        <g fill="none" stroke="url(#m-red-stave)" strokeLinecap="round" filter="url(#m-red-glow)">
          {STAVE.map((d, i) => (
            <path key={i} d={d} strokeWidth="0.9" />
          ))}
          {STAVE.map((d, i) => (
            <path key={`p${i}`} className="m-red-pulse" d={d} strokeWidth="2" />
          ))}
        </g>

        {/* Gold motes on the air, drifting into the canal. */}
        {MOTES.map((m, i) => (
          <circle
            key={i}
            className="m-red-mote"
            cx={m.x}
            cy={m.y}
            r="1.8"
            fill="#FFF3C4"
            filter="url(#m-red-glow)"
            style={{ ...drift(CANAL.x - m.x, CANAL.y - m.y), animationDelay: m.delay }}
          />
        ))}

        {/* Notes riding the stream down into the canal. */}
        <g filter="url(#m-red-glow)">
          {RIDERS.map((r, i) => (
            <text
              key={i}
              className="m-red-rider"
              x={RIDE_FROM.x}
              y={RIDE_FROM.y}
              fill={i % 2 ? '#F7F1E5' : PALE_GOLD}
              fontSize="14"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ ...drift(CANAL.x - RIDE_FROM.x, CANAL.y - RIDE_FROM.y), animationDelay: r.delay }}
            >
              {r.glyph}
            </text>
          ))}
        </g>

        {/* On a beat, rings of gold sound fire out of the canal. */}
        {['', ' m-red-ring-late', ' m-red-ring-later'].map((late) => (
          <circle
            key={late}
            className={`m-red-ring${late}`}
            cx={CANAL.x}
            cy={CANAL.y}
            r="6"
            fill="none"
            stroke={GOLD}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            filter="url(#m-red-glow)"
          />
        ))}
      </g>
    </svg>
  );
});
