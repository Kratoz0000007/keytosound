import { memo, type ReactElement } from 'react';
import { drift } from './motion';

/** One sprite pixel, in viewBox units; the sprite is 14 x 14 of them. */
const CELL = 8;
const LEFT = 64;
const TOP = 60;

const BODY = [
  '....######....',
  '..##########..',
  '.############.',
  '.############.',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
  '##############',
];

/** The two frames of the hem, swapped to make it wiggle. */
const HEM_A = ['###..####..###', '##....##....##'];
const HEM_B = ['#.####..####.#', '....##....##..'];

/** Eye sockets and a small grin, drawn in black over the body. */
const FACE = [
  '..............',
  '..............',
  '..............',
  '..............',
  '...##....##...',
  '...##....##...',
  '...##....##...',
  '..............',
  '..............',
  '....#....#....',
  '.....####.....',
];

/** Yellow pupils, looking right; typing shifts them left, at the text. */
const PUPILS = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '....#.....#...',
  '....#.....#...',
];

/** Where each dancing pixel flies on a keystroke. */
const SPARKS = [
  { dx: -64, dy: -40, color: '#39FF14' },
  { dx: 64, dy: -36, color: '#FFE600' },
  { dx: -76, dy: 8, color: '#FFE600' },
  { dx: 76, dy: 12, color: '#39FF14' },
  { dx: -30, dy: -70, color: '#39FF14' },
  { dx: 34, dy: -66, color: '#FFE600' },
];

/** Horizontal runs of '#' become one rect each, starting at sprite row firstRow. */
function pixels(rows: string[], firstRow = 0) {
  const rects: ReactElement[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let start = -1;
    for (let c = 0; c <= row.length; c++) {
      const on = row[c] === '#';
      if (on && start < 0) start = c;
      if (!on && start >= 0) {
        rects.push(
          <rect
            key={`${r}-${start}`}
            x={LEFT + start * CELL}
            y={TOP + (firstRow + r) * CELL}
            width={(c - start) * CELL}
            height={CELL}
          />,
        );
        start = -1;
      }
    }
  }
  return rects;
}

/**
 * 8-Bit: the chiptune ghost, a 14 x 14 sprite drawn square to the pixel.
 * Idle it bobs in two frames with its hem wiggling; typing, it dances and
 * throws pixels on every keystroke; on a beat it flashes into gold.
 */
export const EightbitMascot = memo(function EightbitMascot() {
  return (
    <svg className="mascot-svg m-pix" viewBox="0 0 240 200" shapeRendering="crispEdges">
      <rect className="m-pix-shadow" x="88" y="188" width="64" height="6" fill="#1F8A0A" />
      <g className="m-float">
        <g className="m-pix-dance">
          <g className="m-tap">
            <g className="m-pix-sprite">
              {pixels(BODY)}
              <g className="m-pix-frame-a">{pixels(HEM_A, 12)}</g>
              <g className="m-pix-frame-b">{pixels(HEM_B, 12)}</g>
            </g>
            <g fill="#050505">{pixels(FACE)}</g>
            <g className="m-pix-pupils" fill="#FFE600">
              {pixels(PUPILS)}
            </g>
          </g>
        </g>
      </g>
      <g transform="translate(117 110)">
        {SPARKS.map((s, i) => (
          <rect
            key={i}
            className="m-pix-spark"
            width="6"
            height="6"
            fill={s.color}
            style={drift(s.dx, s.dy)}
          />
        ))}
      </g>
    </svg>
  );
});
