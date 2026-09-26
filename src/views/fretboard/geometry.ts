/**
 * Fretboard layout in pixels (1 SVG unit = 1 CSS pixel). Frets follow real
 * proportions: each fret is 2^(-1/12) the width of the one before (§5.2).
 *
 * Positions are worked out on two axes, "along" the neck (nut to body) and
 * "across" it (string to string), then placed on screen:
 * - lying down (wide screens): along runs left to right and frets 0 to 15 fill
 *   the visible width; higher frets scroll sideways;
 * - upright (phones): along runs down the page, nut at the top, like a chord
 *   diagram, and the page scrolls down the neck.
 */

/** Frets that fit the view before the board scrolls, lying down. */
export const VISIBLE_FRETS = 15;
/** Nut position along the neck; open notes sit before it at half this. */
const NUT = 64;
const END = 28;
/** Board glass overhang past the outer strings. */
export const OVERHANG = 18;
/** Upright: the scale length the low frets follow (nut to bridge, in pixels). */
const UPRIGHT_SCALE = 1150;
/**
 * Upright, no fret is shorter than a dot plus this gap, so high frets never
 * overlap; the neck is to scale only until frets reach that length.
 */
const UPRIGHT_GAP = 6;

export const INLAYS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
export const DOUBLE_INLAYS = new Set([12, 24]);
export const NUMBERED = [0, ...INLAYS];

export type BoardGeometry = {
  upright: boolean;
  width: number;
  height: number;
  /** Screen point for a position along and across the neck. */
  xy: (along: number, across: number) => [number, number];
  /** Along the neck: the nut and each fret wire (fret 0 = nut). */
  fret: (n: number) => number;
  /** Along the neck: where a note at this fret sits (mid-fret; before the nut when open). */
  dot: (n: number) => number;
  /** Across the neck: a string by its place, 0 = first drawn (top, or left when upright). */
  row: (place: number) => number;
  /** Across the neck: the edges of the glass and the fret numbers. */
  firstRow: number;
  lastRow: number;
  numberRow: number;
  spacing: number;
  /** Dot diameter at a fret: shrinks where frets get narrow. */
  dotSize: (fret: number) => number;
};

export function boardGeometry(options: {
  /** Visible width of the board's frame. */
  viewWidth: number;
  strings: number;
  frets: number;
  compact: boolean;
  upright: boolean;
  /** Lying down: nut on the right. (Upright, the string order mirrors instead.) */
  leftHanded: boolean;
}): BoardGeometry {
  const { viewWidth, strings, frets, compact, upright, leftHanded } = options;
  const dot = compact ? 30 : 38;

  // Across the neck.
  const spacing = upright
    ? Math.min(56, Math.floor((viewWidth - 78) / (strings - 1)))
    : compact
      ? 42
      : 56;
  const span = spacing * (strings - 1);
  const firstRow = upright ? Math.max(48, (viewWidth - span) / 2 + 8) : 30;
  const lastRow = firstRow + span;
  const numberRow = upright ? firstRow - OVERHANG - 14 : lastRow + 36;

  // Along the neck.
  const scale = upright
    ? UPRIGHT_SCALE
    : (Math.max(viewWidth, compact ? 860 : 900) - NUT - END) /
      (1 - Math.pow(2, -VISIBLE_FRETS / 12));
  const real = (n: number) => NUT + scale * (1 - Math.pow(2, -n / 12));
  const wires = [NUT];
  for (let n = 1; n <= frets; n++) {
    const length = real(n) - real(n - 1);
    wires.push(
      (wires[n - 1] ?? NUT) +
        (upright ? Math.max(length, dot + UPRIGHT_GAP) : length),
    );
  }
  const wire = (n: number) => wires[n] ?? real(n);
  const length = wire(frets) + END;
  const mirror = (a: number) => (!upright && leftHanded ? length - a : a);
  const mid = (n: number) => (n === 0 ? NUT / 2 : (wire(n - 1) + wire(n)) / 2);

  return {
    upright,
    width: upright ? viewWidth : length,
    height: upright ? length : lastRow + 54,
    xy: (along, across) => (upright ? [across, along] : [along, across]),
    fret: (n) => mirror(wire(n)),
    dot: (n) => mirror(mid(n)),
    row: (place) => firstRow + spacing * place,
    firstRow,
    lastRow,
    numberRow,
    spacing,
    dotSize: (n) =>
      n === 0 ? dot : Math.max(22, Math.min(dot, wire(n) - wire(n - 1) - 6)),
  };
}

/** String thickness from its pitch: thin at the treble end, heavier for bass. */
export function stringWidth(midi: number): number {
  return Math.min(3.2, Math.max(0.8, 0.8 + (64 - midi) * 0.075));
}
