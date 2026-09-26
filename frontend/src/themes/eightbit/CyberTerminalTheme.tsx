import type { StageProps } from '../stage/StageCanvas';
import { TerminalBackgroundCanvas } from './TerminalBackgroundCanvas';

/**
 * The 8-Bit genre's Cyber-Terminal live layer, mounted only while the
 * theme is active. The rest of the theme lives elsewhere: tokens, panels,
 * the CRT scanlines and the glitch in themes/eightbit.css, the hex
 * fragments and the glitch trigger in themes/fx/eightbit.ts, and the
 * invader in ui/mascots/InvaderDaemon.tsx. This adds the binary rain
 * behind the page.
 */
export function CyberTerminalTheme(props: StageProps) {
  return <TerminalBackgroundCanvas {...props} />;
}
