import type { MouseEvent as ReactMouseEvent } from "react";

type AnyObject = Record<string, unknown>;

export type CsvEditorPageProps = {
  t: (en: string, zh: string) => string;
  tabBarProps: AnyObject;
  showFindBar: boolean;
  findBarProps: AnyObject;
  showQuickbar: boolean;
  quickbarProps: AnyObject;
  surfaceHeaderProps: AnyObject;
  diagnosticsEnabled: boolean;
  diagnosticState: {
    scrollEvents: number;
    autoDown: number;
    autoUp: number;
    requestCalls: number;
    loadCalls: number;
    cacheHits: number;
    blockedLoading: number;
    blockedSuppress: number;
    blockedEof: number;
    blockedDuplicate: number;
    lastStart: number | null;
    lastRows: number;
    lastEof: boolean;
    lastScrollTop: number;
    lastTotalSize: number;
    lastAction: string;
  };
  onResetDiagnostics: () => void;
  onDisableDiagnostics: () => void;
  showDrawer: boolean;
  drawerCollapsed: boolean;
  sidebarWidth: number;
  onCollapseDrawer: () => void;
  onExpandDrawer: () => void;
  onStartSidebarResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
  showPanels: boolean;
  panelsProps: AnyObject;
  error: string | null;
  previewReady: boolean;
  loading: boolean;
  onOpen: () => void | Promise<void>;
  recentFiles: string[];
  onOpenPath: (path: string) => void | Promise<void>;
  gridViewProps: AnyObject;
};
