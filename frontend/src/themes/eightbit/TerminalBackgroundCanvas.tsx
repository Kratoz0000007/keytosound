import { memo } from 'react';
import { approach, between, HOT_HOLD_MS } from '../stage/motion';
import { StageCanvas, type Scene, type StageProps } from '../stage/StageCanvas';
import { sprite } from '../stage/sprites';
import { makeColumn, RAIN, rainBoost, SHADES, shadeOf, stepColumn, type Column } from './stage';

/** Seconds for the rain to catch up with a change in typing speed. */
const SPEED_TAU = 0.5;
/** Seconds for a beat's disruption to die away by 63%. */
const GLITCH_TAU = 0.28;
/** Half the height of the band of rain a beat's laser tears through, px. */
const LASER_BAND = 56;
const FONT = "'VT323', monospace";

/**
 * Bitmap text wants every device pixel, so unlike the soft stages this one
 * draws at screen resolution, capped at 2x.
 */
function deviceScale(): number {
  return Math.min(2, window.devicePixelRatio || 1);
}

/** Mixes #00FF41 toward #008F11 by t, at the given alpha. */
function trailColor(t: number, alpha: number): string {
  const g = Math.round(255 + (143 - 255) * t);
  const b = Math.round(65 + (17 - 65) * t);
  return `rgba(0, ${g}, ${b}, ${alpha})`;
}

/**
 * The glyph atlas: a 0 and a 1 in every shade of the trail, drawn once at
 * device resolution. Column s is shade s; row 0 holds the 0s, row 1 the 1s.
 */
function glyphAtlas(scale: number): HTMLCanvasElement {
  const cell = RAIN.cell * scale;
  return sprite(cell * SHADES, cell * 2, (ctx) => {
    ctx.font = `${Math.round(cell * 1.15)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let s = 0; s < SHADES; s++) {
      if (s === 0) {
        // The head: white-hot, haloed in phosphor green.
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#00FF41';
        ctx.shadowBlur = 6 * scale;
      } else {
        const t = (s - 1) / (SHADES - 2);
        ctx.fillStyle = trailColor(t, 1 - t * 0.9);
        ctx.shadowBlur = 0;
      }
      for (let bit = 0; bit < 2; bit++) {
        ctx.fillText(String(bit), s * cell + cell / 2, bit * cell + cell / 2);
      }
    }
  });
}

/** Where the mascot sits on screen, for the laser; the caret, or mid-screen, failing that. */
function laserLine(fallback: number, height: number): number {
  const stage = document.querySelector('.mascot-stage');
  if (stage) {
    const box = stage.getBoundingClientRect();
    const y = box.top + box.height / 2;
    if (y >= 0 && y <= height) return y;
  }
  return Number.isNaN(fallback) ? height / 2 : fallback;
}

function createTerminalScene(): Scene {
  const scale = deviceScale();
  let atlas = glyphAtlas(scale);
  // VT323 may still be downloading; redraw the atlas once it lands.
  void document.fonts?.load(`${RAIN.cell}px ${FONT}`).then(() => {
    atlas = glyphAtlas(scale);
  });

  const src = RAIN.cell * scale;
  let width = 0;
  let height = 0;
  let rows = 0;
  let columns: Column[] = [];
  let speed = 1;
  let glitch = 0;
  let laserY = 0;
  let flicker = 1;
  let frame = 0;

  return {
    resize(w, h) {
      width = w;
      height = h;
      const nextRows = Math.ceil(h / RAIN.cell) + 1;
      const count = Math.ceil(w / RAIN.cell);
      // Rebuilt only when the grid changes; between resizes the columns recycle in place.
      if (nextRows !== rows || count !== columns.length) {
        rows = nextRows;
        columns = Array.from({ length: count }, (_, i) => makeColumn(i * RAIN.cell, rows, Math.random));
      }
    },

    draw(ctx, now, dt, input) {
      frame++;
      ctx.imageSmoothingEnabled = false;

      const typing = now - input.lastKeyAt < HOT_HOLD_MS;
      speed = approach(speed, typing ? rainBoost(input.wpm) : 1, dt, SPEED_TAU);
      glitch = approach(glitch, 0, dt, GLITCH_TAU);

      for (const e of input.events) {
        if (!e.beat) continue;
        // The laser tears through the rain: every head jolts forward.
        glitch = 1;
        laserY = laserLine(e.y, height);
        for (const c of columns) c.head += between(Math.random, 2, 6);
      }

      // An old tube: the whole picture's brightness wavers a few percent.
      if (frame % 4 === 0) flicker = 0.97 + Math.random() * 0.03;

      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);

      const tearing = glitch > 0.02;
      const flipChance = RAIN.flipRate * dt;
      for (const c of columns) {
        stepColumn(c, dt, speed, rows, Math.random);
        const head = Math.floor(c.head);
        if (head < 0) continue;
        ctx.globalAlpha = c.depth * flicker;
        if (Math.random() < flipChance) {
          const r = head - Math.floor(Math.random() * c.length);
          if (r >= 0 && r < rows) c.glyphs[r] ^= 1;
        }
        for (let k = 0; k < c.length; k++) {
          const r = head - k;
          if (r < 0) break;
          if (r >= rows) continue;
          const y = r * RAIN.cell;
          let x = c.x;
          let bit = c.glyphs[r];
          // Inside the laser's band the rain is thrown sideways and scrambled.
          if (tearing && Math.abs(y - laserY) < LASER_BAND) {
            x += Math.round((Math.random() - 0.5) * 4 * glitch) * (RAIN.cell / 2);
            bit = Math.random() < 0.5 ? 1 : 0;
          }
          ctx.drawImage(atlas, shadeOf(k, c.length) * src, bit * src, src, src, x, y, RAIN.cell, RAIN.cell);
        }
      }

      // The beat's laser: a pixelated beam across the whole screen, and a
      // shockwave of two dashed lines racing away from it.
      if (tearing) {
        const y = Math.round(laserY / 4) * 4;
        const spread = Math.round(((1 - glitch) * 120) / 4) * 4;
        ctx.globalAlpha = glitch;
        ctx.fillStyle = '#00FF41';
        ctx.fillRect(0, y - 4, width, 2);
        ctx.fillRect(0, y + 2, width, 2);
        ctx.fillStyle = '#FFF500';
        for (let x = (frame * 8) % 12; x < width; x += 12) ctx.fillRect(x, y - 2, 8, 4);
        ctx.fillStyle = '#00FF41';
        for (let x = 0; x < width; x += 16) {
          ctx.fillRect(x, y - spread, 8, 2);
          ctx.fillRect(x + 8, y + spread, 8, 2);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * The mainframe behind the page: dense columns of falling 0s and 1s, each
 * with a white-hot head and a trail fading through phosphor green, at
 * random speeds and lengths. The rain speeds up exponentially as the typing
 * does; a beat fires a pixel laser across the screen that tears the rain
 * sideways and jolts every column forward. The whole tube flickers a few
 * percent, the way old phosphor does.
 */
export const TerminalBackgroundCanvas = memo(function TerminalBackgroundCanvas(props: StageProps) {
  return (
    <StageCanvas
      createScene={createTerminalScene}
      scale={deviceScale()}
      caret
      className="stage-canvas"
      {...props}
    />
  );
});
