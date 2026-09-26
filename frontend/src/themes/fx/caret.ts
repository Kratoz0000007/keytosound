/** The textarea styles that decide where its text wraps and sits. */
const MIRRORED = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'wordSpacing',
  'tabSize',
] as const;

let mirror: HTMLDivElement | null = null;

/**
 * Where the caret sits on screen, in viewport pixels. A textarea will not
 * say, so a hidden div copies its box and text up to the caret, and a marker
 * span at the end lands where the caret is. The div is kept and reused.
 */
export function caretPoint(area: HTMLTextAreaElement): { x: number; y: number } {
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    Object.assign(mirror.style, {
      position: 'fixed',
      top: '0',
      left: '-9999px',
      visibility: 'hidden',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
    });
    document.body.appendChild(mirror);
  }

  const style = getComputedStyle(area);
  for (const prop of MIRRORED) mirror.style[prop] = style[prop];

  mirror.textContent = area.value.slice(0, area.selectionStart);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);

  const box = area.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || marker.offsetHeight;
  return {
    x: box.left + Number.parseFloat(style.borderLeftWidth) + marker.offsetLeft - area.scrollLeft,
    y:
      box.top +
      Number.parseFloat(style.borderTopWidth) +
      marker.offsetTop -
      area.scrollTop +
      lineHeight / 2,
  };
}
