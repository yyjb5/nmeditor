import { useEffect } from "react";
import type { CsvContextMenuState } from "../components/CsvContextMenu/types";

type CsvContextShortcutAction =
  | "insert_above"
  | "insert_below"
  | "duplicate"
  | "clear"
  | "delete"
  | "insert_left"
  | "insert_right"
  | "copy_name"
  | "rename";

type UseCsvContextMenuShortcutsParams = {
  contextMenu: CsvContextMenuState | null;
  onCloseMenu: () => void;
  onRunContextAction: (action: CsvContextShortcutAction) => void;
};

export default function useCsvContextMenuShortcuts({
  contextMenu,
  onCloseMenu,
  onRunContextAction,
}: UseCsvContextMenuShortcutsParams) {
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => onCloseMenu();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseMenu();
      }
    };
    const handleMenuKey = (event: KeyboardEvent) => {
      if (!contextMenu) return;
      const key = event.key.toLowerCase();
      if (contextMenu.type === "row") {
        if (key === "a") {
          event.preventDefault();
          onRunContextAction("insert_above");
        }
        if (key === "b") {
          event.preventDefault();
          onRunContextAction("insert_below");
        }
        if (key === "d") {
          event.preventDefault();
          onRunContextAction("duplicate");
        }
        if (key === "c") {
          event.preventDefault();
          onRunContextAction("clear");
        }
        if (key === "x") {
          event.preventDefault();
          onRunContextAction("delete");
        }
      } else {
        if (key === "l") {
          event.preventDefault();
          onRunContextAction("insert_left");
        }
        if (key === "r") {
          event.preventDefault();
          onRunContextAction("insert_right");
        }
        if (key === "d") {
          event.preventDefault();
          onRunContextAction("duplicate");
        }
        if (key === "c") {
          event.preventDefault();
          onRunContextAction("clear");
        }
        if (key === "n") {
          event.preventDefault();
          onRunContextAction("copy_name");
        }
        if (key === "e") {
          event.preventDefault();
          onRunContextAction("rename");
        }
        if (key === "x") {
          event.preventDefault();
          onRunContextAction("delete");
        }
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("keydown", handleMenuKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("keydown", handleMenuKey);
    };
  }, [contextMenu, onCloseMenu, onRunContextAction]);
}
