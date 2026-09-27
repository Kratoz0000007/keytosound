/** One particle, as a theme's effects engine describes it. */
export interface ParticleSpec {
  shape: 'square' | 'dot' | 'puff' | 'glyph';
  color: string;
  /** Side of a square, radius of a dot or of a puff at birth, px size of a glyph. */
  size: number;
  lifeMs: number;
  /** Starting velocity, in px/s. */
  vx: number;
  vy: number;
  /** Downward acceleration in px/s^2; negative floats it up. */
  gravity: number;
  /** A hard four-step fade on a 2px grid, for pixel art. */
  stepped?: boolean;
  /** Glow blur radius. */
  glow?: number;
  /** How many times its starting size a puff has grown by the end. */
  grow?: number;
  glyph?: string;
  font?: string;
}

interface Live extends ParticleSpec {
  x: number;
  y: number;
  born: number;
}

/**
 * Particles on one canvas laid over the page. The canvas draws only while
 * particles are alive, then stops its loop, so an idle page costs nothing.
 */
export class Particles {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private live: Live[] = [];
  private frame = 0;
  private last = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      // 100%, not 100vw: vw counts the scrollbar, and the canvas would overhang the page.
      width: '100%',
      height: '100%',
      zIndex: '10000',
      pointerEvents: 'none',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /** Releases the given particles from (x, y), in viewport pixels. */
  emit(x: number, y: number, specs: ParticleSpec[]): void {
    const now = performance.now();
    for (const spec of specs) this.live.push({ ...spec, x, y, born: now });
    if (!this.frame) {
      this.last = now;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }

  private readonly resize = () => {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(document.documentElement.clientWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private readonly tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, document.documentElement.clientWidth, window.innerHeight);

    this.live = this.live.filter((p) => now - p.born < p.lifeMs);
    for (const p of this.live) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = (now - p.born) / p.lifeMs;
      ctx.globalAlpha = p.stepped ? Math.ceil((1 - t) * 4) / 4 : 1 - t;
      ctx.shadowBlur = p.glow ?? 0;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;

      if (p.shape === 'square') {
        const x = p.stepped ? Math.round(p.x / 2) * 2 : p.x;
        const y = p.stepped ? Math.round(p.y / 2) * 2 : p.y;
        ctx.fillRect(x, y, p.size, p.size);
      } else if (p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'puff') {
        const r = p.size * (1 + ((p.grow ?? 1) - 1) * t);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.shadowBlur = 0;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.font = p.font ?? `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.glyph ?? '', p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    this.frame = this.live.length ? requestAnimationFrame(this.tick) : 0;
  };
}

/** A random number in [min, max). */
export function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Flips data-<name> between a and b on el. A theme's CSS gives the two
 * values identical keyframes, so each flip restarts the animation, with no
 * timer and no forced reflow.
 */
export function flip(el: HTMLElement, name: string): void {
  el.dataset[name] = el.dataset[name] === 'a' ? 'b' : 'a';
}

/** Letters and digits in any script: the keys that make a character. */
export function isCharacter(key: string): boolean {
  return /^[\p{L}\p{N}]$/u.test(key);
}
