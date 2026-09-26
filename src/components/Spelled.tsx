import { segments } from "./spelling.ts";

/** Text with its accidentals set as ♯/♭ glyphs. */
export function Spelled({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((s, i) =>
        s.accidental ? (
          <span key={i} className="acc">
            {s.text}
          </span>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/** The same, inside SVG text. */
export function SvgSpelled({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((s, i) =>
        s.accidental ? (
          <tspan key={i} className="acc">
            {s.text}
          </tspan>
        ) : (
          <tspan key={i}>{s.text}</tspan>
        ),
      )}
    </>
  );
}
