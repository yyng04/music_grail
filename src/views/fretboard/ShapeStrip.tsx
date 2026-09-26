// Small chord diagrams of the shapes on the board (§5.2b).
import type { ReactNode } from "react";
import { Spelled } from "../../components/Spelled.tsx";
import type { Shape } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { fretsText, type Built } from "./shapeModel.ts";

function Tile({
  shape,
  window: win,
  strings,
  on,
  label,
  sub,
  onPick,
}: {
  shape?: Shape;
  window?: { from: number; to: number; dots: Shape["dots"] };
  strings: number;
  on: boolean;
  label: ReactNode;
  sub: string;
  onPick: () => void;
}) {
  const dots = shape?.dots ?? win?.dots ?? [];
  const low = shape
    ? Math.max(0, shape.low === 0 ? 0 : shape.low - 1)
    : (win?.from ?? 0);
  const rows = Math.max(4, (shape ? shape.high : (win?.to ?? 4)) - low + 1);
  const W = 56;
  const cell = 14;
  const sx = (s: number) => 6 + ((W - 12) * s) / (strings - 1);
  const fy = (f: number) => 8 + (f - low + 0.5) * cell;
  return (
    <button
      type="button"
      className={`tile${on ? " on" : ""}`}
      aria-pressed={on}
      onClick={onPick}
    >
      <svg
        viewBox={`0 0 ${String(W)} ${String(16 + rows * cell)}`}
        width={W}
        height={16 + rows * cell}
        aria-hidden="true"
      >
        {Array.from({ length: strings }, (_, s) => (
          <line
            key={s}
            x1={sx(s)}
            x2={sx(s)}
            y1={8}
            y2={8 + rows * cell}
            className="t-string"
          />
        ))}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line
            key={r}
            x1={sx(0)}
            x2={sx(strings - 1)}
            y1={8 + r * cell}
            y2={8 + r * cell}
            className={r === 0 && low === 0 ? "t-nut" : "t-fret"}
          />
        ))}
        {dots.map((d) => (
          <circle
            key={`${String(d.string)}-${String(d.fret)}`}
            cx={sx(d.string)}
            cy={fy(d.fret)}
            r={4.6}
            className={`t-dot r-${d.role}`}
          />
        ))}
        {shape?.next
          ?.filter((_, i) => !shape.moves?.[i]?.held)
          .map((d) => (
            <circle
              key={`n${String(d.string)}`}
              cx={sx(d.string)}
              cy={fy(d.fret)}
              r={4.6}
              className="t-dot next"
            />
          ))}
      </svg>
      <span className="tile-name">{label}</span>
      <span className="tile-sub">{sub}</span>
    </button>
  );
}

/**
 * The shape strip: a small chord diagram for each shape in neck order, or for
 * each CAGED position in Scale mode. Picking a tile lights it on the board.
 */
export function ShapeStrip({
  built,
  strings,
  frets,
  scaleDots,
}: {
  built: Built;
  strings: number;
  frets: number;
  /** Scale mode: the key's notes on the whole neck, for the position tiles. */
  scaleDots: Shape["dots"];
}) {
  const st = useAppStore((s) => s.shapes);
  const set = useAppStore((s) => s.setShapes);
  const scale = st.mode === "scale";
  return (
    <div className="strip-wrap">
      <div
        className="strip"
        role="group"
        aria-label={scale ? "Positions" : "Shapes"}
      >
        {scale ? (
          <>
            <button
              type="button"
              className={`tile whole${st.position ? "" : " on"}`}
              aria-pressed={!st.position}
              onClick={() => {
                set({ position: null });
              }}
            >
              <span className="tile-name">Whole neck</span>
              <span className="tile-sub">frets 0 to {frets}</span>
            </button>
            {built.positions.map((p) => (
              <Tile
                key={p.name}
                strings={strings}
                window={{
                  from: p.from,
                  to: p.to,
                  dots: scaleDots.filter(
                    (d) => d.fret >= p.from && d.fret <= p.to,
                  ),
                }}
                on={st.position === p.name}
                label={`${p.name} shape`}
                sub={`frets ${String(p.from)} to ${String(p.to)}`}
                onPick={() => {
                  set({ position: st.position === p.name ? null : p.name });
                }}
              />
            ))}
          </>
        ) : (
          built.shapes.map((s, i) => (
            <Tile
              key={`${String(i)}-${String(s.low)}`}
              shape={s}
              strings={strings}
              on={i === built.lit}
              label={<Spelled text={s.tag} />}
              sub={fretsText(s)}
              onPick={() => {
                set({ shape: i });
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
