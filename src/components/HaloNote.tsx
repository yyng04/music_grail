import type { Membership, Role } from "../relations/index.ts";
import { Spelled } from "./Spelled.tsx";
import { isChordTone } from "./spelling.ts";

type Props = {
  name: string;
  membership: Membership;
  role: Role;
  /** A compare key is set: primary-only notes become plain rings (§3). */
  hasCompare: boolean;
  /** Fret dots and the note ring: a dark core so no line runs through the letter. */
  core?: boolean;
  small?: boolean;
  /** Label override (degree, interval), shown instead of the name. */
  label?: string;
};

/** A halo-ring note (DESIGN.md): glow = in the key (in both keys), ring = primary only, dashed = compare only. */
export function HaloNote({
  name,
  membership,
  role,
  hasCompare,
  core,
  small,
  label,
}: Props) {
  const classes = ["halo"];
  if (membership === "none") classes.push("off");
  else if (membership === "compare") classes.push("new");
  else {
    const style = membership === "primary" && hasCompare ? "ring" : "lit";
    classes.push(
      ...(isChordTone(role)
        ? [`r-${role}`, style]
        : ["quiet", ...(style === "ring" ? ["ring"] : [])]),
    );
  }
  if (core) classes.push("core");
  if (small) classes.push("small");
  return (
    <span className={classes.join(" ")}>
      <span>
        <Spelled text={label ?? name} />
      </span>
    </span>
  );
}
