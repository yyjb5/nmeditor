import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { listenEvent } from "../tauriBridge";

type ToggleSetter = Dispatch<SetStateAction<boolean>>;

export type MenuEventBridgeHandlers = {
  fileMode: "none" | "csv" | "text";
  handleOpen: () => void | Promise<void>;
  saveCurrent: () => void | Promise<boolean>;
  saveAsCurrent: () => void | Promise<boolean>;
  runMacroOnFile: () => void | Promise<void>;
  runFindReplaceOnFile: () => void | Promise<void>;
  undo: () => void;
  redo: () => void;
  clearEdits: () => void;
  loadNextWindow: () => void | Promise<void>;
  runFullStats: () => void | Promise<void>;
  applyFindReplace: () => void;
  runMacro: () => void;
  setShowQuickbar: ToggleSetter;
  setShowFindBar: ToggleSetter;
  setShowMacroPanel: ToggleSetter;
  setShowOpsPanel: ToggleSetter;
  setShowExportPanel: ToggleSetter;
  setShowFindPanel: ToggleSetter;
  setShowStatsPanel: ToggleSetter;
  showAboutDialog: () => void | Promise<void>;
};

export default function useMenuEventBridge(handlers: MenuEventBridgeHandlers) {
  const handlersRef = useRef(handlers);
  const menuListenerRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (menuListenerRef.current) return;
    let disposed = false;
    const setup = async () => {
      const unlisten = await listenEvent<string>("menu-event", (event) => {
        const current = handlersRef.current;
        switch (event.payload) {
          case "file_open":
            void current.handleOpen();
            break;
          case "file_save_as":
            void current.saveAsCurrent();
            break;
          case "file_save":
            void current.saveCurrent();
            break;
          case "file_macro":
            if (current.fileMode === "csv") {
              void current.runMacroOnFile();
            }
            break;
          case "file_find_replace":
            if (current.fileMode === "csv") {
              void current.runFindReplaceOnFile();
            }
            break;
          case "edit_undo":
            if (current.fileMode === "csv") {
              current.undo();
            }
            break;
          case "edit_redo":
            if (current.fileMode === "csv") {
              current.redo();
            }
            break;
          case "edit_clear":
            if (current.fileMode === "csv") {
              current.clearEdits();
            }
            break;
          case "view_load_more":
            if (current.fileMode === "csv") {
              void current.loadNextWindow();
            }
            break;
          case "view_stats":
            if (current.fileMode === "csv") {
              void current.runFullStats();
            }
            break;
          case "view_toggle_quickbar":
            current.setShowQuickbar((value) => !value);
            break;
          case "view_toggle_findbar":
            current.setShowFindBar((value) => !value);
            break;
          case "view_toggle_macro":
            current.setShowMacroPanel((value) => !value);
            break;
          case "view_toggle_ops":
            current.setShowOpsPanel((value) => !value);
            break;
          case "view_toggle_export":
            current.setShowExportPanel((value) => !value);
            break;
          case "view_toggle_find_panel":
            current.setShowFindPanel((value) => !value);
            break;
          case "view_toggle_stats_panel":
            current.setShowStatsPanel((value) => !value);
            break;
          case "tools_find_loaded":
            if (current.fileMode === "csv") {
              current.applyFindReplace();
            }
            break;
          case "tools_macro_loaded":
            if (current.fileMode === "csv") {
              current.runMacro();
            }
            break;
          case "help_about":
            void current.showAboutDialog();
            break;
          default:
            break;
        }
      });

      if (disposed) {
        unlisten();
        return;
      }
      menuListenerRef.current = unlisten;
    };

    void setup();
    return () => {
      disposed = true;
      if (menuListenerRef.current) {
        menuListenerRef.current();
        menuListenerRef.current = null;
      }
    };
  }, []);
}
