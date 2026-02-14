import CsvContextMenu from "../../components/CsvContextMenu";
import CsvModeStatusBar from "../../components/CsvModeStatusBar";
import CsvEditorPage from "../CsvEditorPage";
import type { CsvWorkspacePageProps } from "./types";

export default function CsvWorkspacePage({
  editorProps,
  statusBarProps,
  contextMenuProps,
}: CsvWorkspacePageProps) {
  return (
    <>
      <CsvEditorPage {...editorProps} />
      <CsvModeStatusBar {...statusBarProps} />
      <CsvContextMenu {...contextMenuProps} />
    </>
  );
}
