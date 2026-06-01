import type { ComponentProps } from "react";
import CSVGrid from "../../components/CSVGrid";
import FindBar from "../../components/FindBar";
import Panels from "../../components/Panels";
import Quickbar from "../../components/Quickbar";
import SurfaceHeader from "../../components/SurfaceHeader";
import TabBar from "../../components/TabBar";
import type { CsvEditorPageProps } from "./types";
import "./styles.css";

export default function CsvEditorPage({
  t,
  tabBarProps,
  showFindBar,
  findBarProps,
  showQuickbar,
  quickbarProps,
  surfaceHeaderProps,
  diagnosticsEnabled,
  diagnosticState,
  onResetDiagnostics,
  onDisableDiagnostics,
  showDrawer,
  drawerCollapsed,
  sidebarWidth,
  onCollapseDrawer,
  onExpandDrawer,
  onStartSidebarResize,
  showPanels,
  panelsProps,
  error,
  previewReady,
  loading,
  onOpen,
  recentFiles,
  onOpenPath,
  gridViewProps,
}: CsvEditorPageProps) {
  const panelState = panelsProps as {
    showFindPanel?: boolean;
    showOpsPanel?: boolean;
    showMacroPanel?: boolean;
    showStatsPanel?: boolean;
    showExportPanel?: boolean;
  };

  return (
    <section className="surface csv-editor-page">
      <TabBar {...(tabBarProps as ComponentProps<typeof TabBar>)} />
      <div className="sticky-bars">
        {showFindBar ? <FindBar {...(findBarProps as ComponentProps<typeof FindBar>)} /> : null}
        {showQuickbar ? <Quickbar {...(quickbarProps as ComponentProps<typeof Quickbar>)} /> : null}
      </div>
      <SurfaceHeader {...(surfaceHeaderProps as ComponentProps<typeof SurfaceHeader>)} />
      {diagnosticsEnabled ? (
        <section className="diagnostic-panel">
          <div className="diagnostic-head">
            <strong>{t("Diagnostics", "诊断")}</strong>
            <span>{t("Toggle: Ctrl+Shift+D", "切换：Ctrl+Shift+D")}</span>
            <button onClick={onResetDiagnostics}>{t("Reset", "重置")}</button>
            <button onClick={onDisableDiagnostics}>{t("Close", "关闭")}</button>
          </div>
          <div className="diagnostic-metrics">
            <span>{t(`scroll ${diagnosticState.scrollEvents}`, `滚动 ${diagnosticState.scrollEvents}`)}</span>
            <span>{t(`auto-down ${diagnosticState.autoDown}`, `下翻自动加载 ${diagnosticState.autoDown}`)}</span>
            <span>{t(`auto-up ${diagnosticState.autoUp}`, `上翻自动加载 ${diagnosticState.autoUp}`)}</span>
            <span>{t(`request ${diagnosticState.requestCalls}`, `请求 ${diagnosticState.requestCalls}`)}</span>
            <span>{t(`load ${diagnosticState.loadCalls}`, `加载 ${diagnosticState.loadCalls}`)}</span>
            <span>{t(`cache-hit ${diagnosticState.cacheHits}`, `缓存命中 ${diagnosticState.cacheHits}`)}</span>
            <span>{t(`blocked-loading ${diagnosticState.blockedLoading}`, `被加载中拦截 ${diagnosticState.blockedLoading}`)}</span>
            <span>{t(`blocked-suppress ${diagnosticState.blockedSuppress}`, `被抑制拦截 ${diagnosticState.blockedSuppress}`)}</span>
            <span>{t(`blocked-eof ${diagnosticState.blockedEof}`, `被EOF拦截 ${diagnosticState.blockedEof}`)}</span>
            <span>{t(`blocked-dup ${diagnosticState.blockedDuplicate}`, `被重复请求拦截 ${diagnosticState.blockedDuplicate}`)}</span>
            <span>{t(`last-start ${diagnosticState.lastStart ?? "-"}`, `最后起点 ${diagnosticState.lastStart ?? "-"}`)}</span>
            <span>{t(`last-rows ${diagnosticState.lastRows}`, `最后行数 ${diagnosticState.lastRows}`)}</span>
            <span>{t(`last-eof ${diagnosticState.lastEof ? "true" : "false"}`, `最后EOF ${diagnosticState.lastEof ? "true" : "false"}`)}</span>
            <span>{t(`scrollTop ${Math.round(diagnosticState.lastScrollTop)}`, `滚动Top ${Math.round(diagnosticState.lastScrollTop)}`)}</span>
            <span>{t(`totalSize ${Math.round(diagnosticState.lastTotalSize)}`, `总高度 ${Math.round(diagnosticState.lastTotalSize)}`)}</span>
            <span>{t(`last-action ${diagnosticState.lastAction}`, `最后动作 ${diagnosticState.lastAction}`)}</span>
          </div>
        </section>
      ) : null}

      <div
        className={`workspace${showDrawer ? " with-drawer" : ""}`}
        style={showDrawer ? { gridTemplateColumns: `minmax(0, 1fr) ${sidebarWidth}px` } : undefined}
      >
        {showDrawer ? (
          <aside className="panel-drawer">
            <div className="panel-header">
              <span>{t("Panels", "面板")}</span>
              <button onClick={onCollapseDrawer}>{t("Collapse", "收起")}</button>
            </div>
            <div className="panel-mode-strip" aria-label={t("Active panel groups", "当前面板组")}>
              <span className={panelState.showFindPanel ? "active" : ""}>{t("Find", "查找")}</span>
              <span className={panelState.showOpsPanel ? "active" : ""}>{t("Columns", "列")}</span>
              <span className={panelState.showMacroPanel ? "active" : ""}>{t("Batch", "批量")}</span>
              <span className={panelState.showStatsPanel ? "active" : ""}>{t("Stats", "统计")}</span>
              <span className={panelState.showExportPanel ? "active" : ""}>{t("Export", "导出")}</span>
            </div>
            <div className="panel-resizer" onMouseDown={onStartSidebarResize} />
            <Panels {...(panelsProps as ComponentProps<typeof Panels>)} />
          </aside>
        ) : null}
        <div className="grid-area">
          {showPanels && drawerCollapsed ? (
            <div className="panel-collapsed">
              <button onClick={onExpandDrawer}>{t("Show panels", "显示面板")}</button>
            </div>
          ) : null}
          {error ? <div className="banner error">{error}</div> : null}
          {!previewReady && !loading ? (
            <div className="empty-state">
              <div className="empty-card">
                <h2>{t("Open a CSV or text file to begin", "打开 CSV 或文本文件开始")}</h2>
                <p>
                  {t(
                    "You can drag and drop a file here or use the open button.",
                    "You can drag and drop a file here or use the open button.",
                  )}
                </p>
                <button onClick={onOpen}>{t("Open file", "打开文件")}</button>
                {recentFiles.length ? (
                  <div className="recent-files">
                    <div className="recent-title">{t("Recent files", "最近文件")}</div>
                    <div className="recent-list">
                      {recentFiles.map((path) => (
                        <button key={path} onClick={() => void onOpenPath(path)}>
                          {path}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <CSVGrid {...(gridViewProps as ComponentProps<typeof CSVGrid>)} />
          )}
        </div>
      </div>
    </section>
  );
}
