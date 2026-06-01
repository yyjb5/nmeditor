import StatusBar from "../StatusBar";
import type { CsvModeStatusBarProps } from "./types";
import "./styles.css";

export default function CsvModeStatusBar({
  t,
  loading,
  windowLoading,
  fileMode,
  csvGridFocused,
  csvEditing,
  selectionMode,
  previewPath,
  eof,
  rowsLength,
  patchCount,
  macroAppliedCount,
  findAppliedCount,
  opStatus,
  indexRunning,
  indexProgress,
  indexCanceled,
  findRunning,
  findProgress,
  findCanceled,
  findMatchedCount,
  findScannedRows,
  findElapsedMs,
  globalViewLoading,
  autoIndexMode,
  forceExternalSort,
  lastIndexTrigger,
  totalRows,
  delimiter,
  delimiterApplied,
  refreshTotalRows,
  cancelIndexBuild,
  cancelFindMatchJob,
}: CsvModeStatusBarProps) {
  const hasPreview = Boolean(previewPath);
  const canBuildIndex = fileMode === "csv" && !indexRunning && totalRows === null;
  const onBuildIndex = () => {
    if (!previewPath) return;
    void refreshTotalRows(previewPath, delimiterApplied ?? delimiter, "manual");
  };

  return (
    <div className="csv-mode-status-bar">
      <StatusBar
        loading={loading}
        loadingRows={windowLoading}
        fileMode={fileMode}
        csvGridFocused={csvGridFocused}
        csvEditing={csvEditing}
        csvSelectionMode={selectionMode}
        hasPreview={hasPreview}
        eof={eof}
        rowsLength={rowsLength}
        visibleCount={rowsLength}
        totalRows={totalRows}
        patchCount={patchCount}
        macroAppliedCount={macroAppliedCount}
        findAppliedCount={findAppliedCount}
        opStatus={opStatus}
        indexing={indexRunning}
        indexProgress={indexProgress}
        indexCanceled={indexCanceled}
        findRunning={findRunning}
        findProgress={findProgress}
        findCanceled={findCanceled}
        findMatchedCount={findMatchedCount}
        findScannedRows={findScannedRows}
        findElapsedMs={findElapsedMs}
        globalViewLoading={globalViewLoading}
        autoIndexMode={autoIndexMode}
        forceExternalSort={forceExternalSort}
        indexingTrigger={lastIndexTrigger}
        canBuildIndex={canBuildIndex}
        onBuildIndex={onBuildIndex}
        onCancelIndex={cancelIndexBuild}
        onCancelFind={cancelFindMatchJob}
        t={t}
      />
    </div>
  );
}
