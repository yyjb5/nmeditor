import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

type UsePanelDrawerParams = {
  showMacroPanel: boolean;
  showOpsPanel: boolean;
  showExportPanel: boolean;
  showFindPanel: boolean;
  showStatsPanel: boolean;
};

export default function usePanelDrawer({
  showMacroPanel,
  showOpsPanel,
  showExportPanel,
  showFindPanel,
  showStatsPanel,
}: UsePanelDrawerParams) {
  const showPanels =
    showMacroPanel || showOpsPanel || showExportPanel || showFindPanel || showStatsPanel;

  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const showDrawer = showPanels && !drawerCollapsed;
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const startSidebarResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      sidebarDragRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    },
    [sidebarWidth],
  );

  useEffect(() => {
    const handleMove = (event: globalThis.MouseEvent) => {
      const drag = sidebarDragRef.current;
      if (!drag) return;
      const nextWidth = Math.min(520, Math.max(220, drag.startWidth - (event.clientX - drag.startX)));
      setSidebarWidth(nextWidth);
    };
    const handleUp = () => {
      sidebarDragRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  return {
    showPanels,
    drawerCollapsed,
    setDrawerCollapsed,
    showDrawer,
    sidebarWidth,
    startSidebarResize,
  };
}
