import { keyMeta } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { Spelled } from "../Spelled.tsx";
import { kindLabel } from "../spelling.ts";
import { ChordList } from "./ChordList.tsx";
import { CompareBlock } from "./CompareBlock.tsx";
import { NoteRow } from "./NoteRow.tsx";

/** The selection spelled out: key, notes with roles and degrees, compare, chords (§4.4). */
export function Panel() {
  const primary = useAppStore((s) => s.selection.primary);
  const kind = kindLabel(primary.kind);
  return (
    <section className="panel" aria-live="polite" aria-label="Selection">
      <svg className="sparkle" viewBox="0 0 34 34" aria-hidden="true">
        <path d="M17 0v34M0 17h34M5 5l24 24M29 5 5 29" />
      </svg>
      <div className="panel-key">
        <div>
          <h2 className={`key-name${kind.includes(" ") ? " long" : ""}`}>
            <Spelled text={primary.tonic} />{" "}
            <span className="kind">{kind}</span>
          </h2>
          <p className="key-meta">
            <Spelled text={keyMeta(primary)} />
          </p>
        </div>
        <NoteRow />
      </div>
      <CompareBlock />
      <ChordList />
    </section>
  );
}
