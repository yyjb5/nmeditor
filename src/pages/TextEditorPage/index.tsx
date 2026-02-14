import TextFindResultsPanel from "../../components/TextFindResultsPanel";
import TextModeStatusBar from "../../components/TextModeStatusBar";
import TextModeWorkspace from "../../components/TextModeWorkspace";
import type { TextEditorPageProps } from "./types";

export default function TextEditorPage({
  workspaceProps,
  showFindResultsPanel,
  findResultsProps,
  statusBarProps,
}: TextEditorPageProps) {
  return (
    <>
      <TextModeWorkspace
        {...workspaceProps}
        findResultsPanel={showFindResultsPanel ? <TextFindResultsPanel {...findResultsProps} /> : null}
      />
      <TextModeStatusBar {...statusBarProps} />
    </>
  );
}
