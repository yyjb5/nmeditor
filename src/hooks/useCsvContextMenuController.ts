import { useState } from "react";
import type { CsvContextMenuState } from "../components/CsvContextMenu/types";
import useCsvContextMenuActions, {
  type UseCsvContextMenuActionsOptions,
} from "./useCsvContextMenuActions";
import useCsvContextMenuShortcuts from "./useCsvContextMenuShortcuts";

export type UseCsvContextMenuControllerOptions = Omit<
  UseCsvContextMenuActionsOptions,
  "setContextMenu" | "contextMenu"
>;

export default function useCsvContextMenuController(
  options: UseCsvContextMenuControllerOptions,
) {
  const [contextMenu, setContextMenu] = useState<CsvContextMenuState | null>(null);

  const { handleRowHeaderContextMenu, handleColumnHeaderContextMenu, runContextAction } =
    useCsvContextMenuActions({
      ...options,
      setContextMenu,
      contextMenu,
    });

  useCsvContextMenuShortcuts({
    contextMenu,
    onCloseMenu: () => setContextMenu(null),
    onRunContextAction: (action) => {
      void runContextAction(action);
    },
  });

  return {
    contextMenu,
    handleRowHeaderContextMenu,
    handleColumnHeaderContextMenu,
    runContextAction,
  };
}
