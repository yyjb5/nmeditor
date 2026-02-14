import type { CsvContextMenuProps } from "../../components/CsvContextMenu/types";
import type { CsvModeStatusBarProps } from "../../components/CsvModeStatusBar/types";
import type { CsvEditorPageProps } from "../CsvEditorPage/types";

export type CsvWorkspacePageProps = {
  editorProps: CsvEditorPageProps;
  statusBarProps: CsvModeStatusBarProps;
  contextMenuProps: CsvContextMenuProps;
};
