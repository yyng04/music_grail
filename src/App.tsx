import { useEffect } from "react";
import { Background } from "./components/Background.tsx";
import { Header } from "./components/Header.tsx";
import { Panel } from "./components/panel/Panel.tsx";
import { useAmbientPause } from "./hooks/useAmbientPause.ts";
import { columns, stepKey } from "./relations/index.ts";
import { appStore, useAppStore } from "./state/index.ts";
import { CircleOfFifths } from "./views/circle/CircleOfFifths.tsx";
import { Fretboard } from "./views/fretboard/Fretboard.tsx";
import { toggleMetronome } from "./audio/metronome.ts";
import { stepStrip } from "./views/fretboard/shapeModel.ts";

/**
 * Arrow keys move the primary key round the circle; Esc cancels compare.
 * In Progression mode the space bar starts and stops the metronome, from
 * anywhere but a text field.
 */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const state = appStore.getState();
      if (
        e.key === " " &&
        state.view === "fretboard" &&
        state.shapes.mode === "progression" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleMetronome();
        return;
      }
      if (e.key === "Escape") {
        if (state.compareArmed) state.armCompare(false);
        else state.clearCompare();
        return;
      }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      // On the fretboard, ← / → step the strip: positions, or shapes up the neck.
      if (state.view === "fretboard") {
        stepStrip(e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      const cols = columns(state.selection, state.columnSpellings);
      state.setPrimary(
        stepKey(state.selection.primary, e.key === "ArrowRight" ? 1 : -1, cols),
      );
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

export function App() {
  useAmbientPause();
  useKeyboard();
  const view = useAppStore((s) => s.view);
  return (
    <>
      <Background />
      <div className="app">
        <Header />
        {view === "fretboard" ? (
          <main className="main board-view">
            <Fretboard />
            <Panel chords={false} />
          </main>
        ) : (
          <main className="main">
            <div className="stage">
              <CircleOfFifths />
            </div>
            <Panel />
          </main>
        )}
      </div>
    </>
  );
}
