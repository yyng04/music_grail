import { noteRow, type RowNote } from "../../relations/index.ts";
import { useAppStore } from "../../state/index.ts";
import { HaloNote } from "../HaloNote.tsx";
import { Spelled } from "../Spelled.tsx";
import { isChordTone } from "../spelling.ts";

const ROLE_WORD = {
  root: "root",
  third: "3rd",
  fifth: "5th",
  seventh: "7th",
} as const;
const MEMBERSHIP_WORD = {
  both: "in both keys",
  primary: "",
  compare: "only in the compare key",
  none: "",
} as const;

function Note({
  note,
  hasCompare,
  showDegree,
}: {
  note: RowNote;
  hasCompare: boolean;
  showDegree: boolean;
}) {
  const tone = isChordTone(note.role) && note.membership !== "compare";
  const role = tone ? ROLE_WORD[note.role as keyof typeof ROLE_WORD] : "";
  const where =
    hasCompare && note.membership === "primary"
      ? "only in this key"
      : MEMBERSHIP_WORD[note.membership];
  return (
    <li
      className={`note${tone ? ` r-${note.role}` : ""}`}
      aria-label={[
        note.name,
        role,
        showDegree ? `degree ${note.degree}` : "",
        where,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <HaloNote
        name={note.name}
        membership={note.membership}
        role={note.role}
        hasCompare={hasCompare}
      />
      <span className="note-role" aria-hidden="true">
        {role}
      </span>
      {showDegree && (
        <span className="note-degree" aria-hidden="true">
          <Spelled text={note.degree} />
        </span>
      )}
    </li>
  );
}

/** The key's notes with their roles and degrees; a changed note sits beside its replacement. */
export function NoteRow() {
  const selection = useAppStore((s) => s.selection);
  const hasCompare = Boolean(selection.compare);
  // With a focus chord, colours and role words follow the chord; the key's
  // degree numbers would be a second numbering, so they are left out.
  const showDegree = !selection.primary.chord;
  const row = noteRow(selection);
  const items = [];
  for (let i = 0; i < row.length; i++) {
    const note = row[i];
    if (!note) continue;
    const next = row[i + 1];
    if (note.change && next) {
      items.push(
        <li key={note.name} className="pair">
          <span className="pair-label">
            {note.change.halfStep ? "half step" : "changes"}
          </span>
          <ul className="pair-notes">
            <Note note={note} hasCompare={hasCompare} showDegree={showDegree} />
            <Note note={next} hasCompare={hasCompare} showDegree={showDegree} />
          </ul>
        </li>,
      );
      i++;
    } else
      items.push(
        <Note
          key={note.name}
          note={note}
          hasCompare={hasCompare}
          showDegree={showDegree}
        />,
      );
  }
  return (
    <ul
      className={`notes${row.some((n) => n.change) ? " has-pair" : ""}`}
      aria-label="Notes of the key"
      data-measure="notes"
    >
      {items}
    </ul>
  );
}
