import type { StageProps } from '../stage/StageCanvas';
import { JazzBackgroundCanvas } from './JazzBackgroundCanvas';

/**
 * Jazz's live layer, mounted only while the theme is active. The rest of
 * the theme lives elsewhere: tokens and surfaces in themes/jazz.css, caret
 * sparks and the needle scratch in themes/fx/jazz.ts, and the sax cat in
 * ui/mascots/SpeakeasyMascot.tsx. This adds the stage behind the page.
 */
export function JazzTheme(props: StageProps) {
  return <JazzBackgroundCanvas {...props} />;
}
