import { useState } from "react";

export default function useCsvPanelVisibilityState() {
  const [showQuickbar, setShowQuickbar] = useState(true);
  const [showFindBar, setShowFindBar] = useState(true);
  const [showMacroPanel, setShowMacroPanel] = useState(false);
  const [showOpsPanel, setShowOpsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showFindPanel, setShowFindPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  return {
    showQuickbar,
    setShowQuickbar,
    showFindBar,
    setShowFindBar,
    showMacroPanel,
    setShowMacroPanel,
    showOpsPanel,
    setShowOpsPanel,
    showExportPanel,
    setShowExportPanel,
    showFindPanel,
    setShowFindPanel,
    showStatsPanel,
    setShowStatsPanel,
  };
}
