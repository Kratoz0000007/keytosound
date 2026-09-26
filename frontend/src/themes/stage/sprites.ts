/**
 * Offscreen sprites. Anything a stage draws many times a frame that costs a
 * gradient or a blur is drawn once here and stamped with drawImage after,
 * which the browser does as a plain textured copy.
 */

export function sprite(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  return canvas;
}

/**
 * A soft round glow: a radial gradient through the given stops, blurred.
 * Stamp it at any size; the blur scales with it.
 */
export function glowSprite(stops: [offset: number, color: string][], blur = 0, size = 128) {
  return sprite(size, size, (ctx) => {
    const c = size / 2;
    // Leave the blur room to spread inside the sprite's edge.
    const r = c - blur * 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, r);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    if (blur) ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

export const CONE_W = 256;
export const CONE_H = 1024;
/** The cone's triangle stops short of the sprite's sides, so the blur has room. */
export const CONE_INSET = 16;

/**
 * A beam pointing straight down from its apex at the top centre, in the
 * given rgb: full strength at the lamp, fading with distance, with a paler
 * core and edges softened by a blur. Draw it with globalAlpha for the beam's
 * real strength.
 */
export function coneSprite(rgb: string, coreRgb: string) {
  return sprite(CONE_W, CONE_H, (ctx) => {
    ctx.filter = 'blur(10px)';

    const body = ctx.createLinearGradient(0, 0, 0, CONE_H);
    body.addColorStop(0, `rgba(${rgb}, 1)`);
    body.addColorStop(0.55, `rgba(${rgb}, 0.55)`);
    body.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(CONE_W / 2, 0);
    ctx.lineTo(CONE_W - CONE_INSET, CONE_H);
    ctx.lineTo(CONE_INSET, CONE_H);
    ctx.closePath();
    ctx.fill();

    const core = ctx.createLinearGradient(0, 0, 0, CONE_H);
    core.addColorStop(0, `rgba(${coreRgb}, 0.5)`);
    core.addColorStop(0.6, `rgba(${coreRgb}, 0)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(CONE_W / 2, 0);
    ctx.lineTo(CONE_W * 0.68, CONE_H);
    ctx.lineTo(CONE_W * 0.32, CONE_H);
    ctx.closePath();
    ctx.fill();
  });
}

/** Stamps a cone sprite along a beam. The caller sets globalAlpha and the blend mode. */
export function drawCone(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  cone: { x: number; y: number; angle: number; halfAngle: number; length: number },
) {
  const half = Math.tan(cone.halfAngle) * cone.length * (CONE_W / (CONE_W - 2 * CONE_INSET));
  ctx.save();
  ctx.translate(cone.x, cone.y);
  // The sprite points down (+y); canvas rotation turns +y toward -x.
  ctx.rotate(-cone.angle);
  ctx.drawImage(image, -half, 0, half * 2, cone.length);
  ctx.restore();
}
