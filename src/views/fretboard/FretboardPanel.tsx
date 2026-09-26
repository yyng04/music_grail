import { Panel } from "../../components/panel/Panel.tsx";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import { useShapes } from "./shapeModel.ts";
import { ShowList } from "./ShowList.tsx";

/** The panel under the board, with the Show list in its middle column (on phones it sits above the board). */
export function FretboardPanel() {
  const { built } = useShapes();
  const upright = useMediaQuery("(max-width: 600px)");
  return <Panel show={upright ? undefined : <ShowList built={built} />} />;
}
