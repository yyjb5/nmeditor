import type { CsvWorkspacePageProps } from "./types";

type CsvWorkspacePageBuildContext = Record<string, any>;

export function buildCsvWorkspacePageProps(
  ctx: CsvWorkspacePageBuildContext,
): CsvWorkspacePageProps {
  return {
    editorProps: ctx.csvEditorPageProps,
    statusBarProps: {
      t: ctx.t,
      loading: ctx.loading,
      windowLoading: ctx.windowLoading,
      fileMode: ctx.fileMode,
      csvGridFocused: ctx.csvGridFocused,
      csvEditing: Boolean(ctx.editingCell),
      selectionMode: ctx.selectionMode,
      previewPath: ctx.previewPath,
      eof: ctx.eof,
      rowsLength: ctx.rowsLength,
      patchCount: ctx.patchCount,
      macroAppliedCount: ctx.macroAppliedCount,
      findAppliedCount: ctx.findAppliedCount,
      opStatus: ctx.opStatus,
      indexRunning: ctx.indexRunning,
      indexProgress: ctx.indexProgress,
      indexCanceled: ctx.indexCanceled,
      findRunning: ctx.findRunning,
      findProgress: ctx.findProgress,
      findCanceled: ctx.findCanceled,
      findMatchedCount: ctx.findMatchedCount,
      findScannedRows: ctx.findScannedRows,
      findElapsedMs: ctx.findElapsedMs,
      globalViewLoading: ctx.globalViewLoading,
      autoIndexMode: ctx.autoIndexMode,
      forceExternalSort: ctx.forceExternalSort,
      lastIndexTrigger: ctx.lastIndexTrigger,
      totalRows: ctx.totalRows,
      delimiter: ctx.delimiter,
      delimiterApplied: ctx.delimiterApplied,
      refreshTotalRows: ctx.refreshTotalRows,
      cancelIndexBuild: ctx.cancelIndexBuild,
      cancelFindMatchJob: ctx.cancelFindMatchJob,
    },
    contextMenuProps: {
      t: ctx.t,
      contextMenu: ctx.contextMenu,
      onRunContextAction: ctx.onRunContextAction,
    },
  };
}
