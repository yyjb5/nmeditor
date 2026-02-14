import type { TextFindResultsPanelProps } from "../../components/TextFindResultsPanel/types";
import type { TextModeStatusBarProps } from "../../components/TextModeStatusBar/types";
import type { TextModeWorkspaceProps } from "../../components/TextModeWorkspace/types";

export type TextEditorPageProps = {
  workspaceProps: Omit<TextModeWorkspaceProps, "findResultsPanel">;
  showFindResultsPanel: boolean;
  findResultsProps: TextFindResultsPanelProps;
  statusBarProps: TextModeStatusBarProps;
};
