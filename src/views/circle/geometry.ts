/** Circle drawing helpers: angles in degrees, clockwise from 12 o'clock. */

export const CX = 480;
export const CY = 480;

const f = (n: number) => n.toFixed(2);

export function point(r: number, angle: number): [number, number] {
  const t = ((angle - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
}

/** An annular sector from angle a0 to a1 between radii r0 and r1. */
export function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = point(r1, a0);
  const [x1, y1] = point(r1, a1);
  const [x2, y2] = point(r0, a1);
  const [x3, y3] = point(r0, a0);
  return `M${f(x0)} ${f(y0)}A${String(r1)} ${String(r1)} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${String(r0)} ${String(r0)} 0 0 0 ${f(x3)} ${f(y3)}Z`;
}

/** An arc along radius r from angle a0 to a1. */
export function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = point(r, a0);
  const [x1, y1] = point(r, a1);
  return `M${f(x0)} ${f(y0)}A${String(r)} ${String(r)} 0 0 1 ${f(x1)} ${f(y1)}`;
}

export function line(
  r0: number,
  r1: number,
  angle: number,
): { x1: string; y1: string; x2: string; y2: string } {
  const [x1, y1] = point(r0, angle);
  const [x2, y2] = point(r1, angle);
  return { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2) };
}

/**
 * The key window at angle 0 (§5.1): three columns (±45°) from rMid to rOut,
 * plus the centre column (±15°) from rIn to rMid. Rotated into place.
 */
export function windowPath(rIn: number, rMid: number, rOut: number): string {
  const p = (r: number, a: number) => point(r, a).map(f).join(" ");
  const R = (r: number) => `${String(r)} ${String(r)}`;
  return [
    `M${p(rOut, -45)}`,
    `A${R(rOut)} 0 0 1 ${p(rOut, 45)}`,
    `L${p(rMid, 45)}`,
    `A${R(rMid)} 0 0 0 ${p(rMid, 15)}`,
    `L${p(rIn, 15)}`,
    `A${R(rIn)} 0 0 0 ${p(rIn, -15)}`,
    `L${p(rMid, -15)}`,
    `A${R(rMid)} 0 0 0 ${p(rMid, -45)}`,
    "Z",
  ].join("");
}

export const fmt = f;
