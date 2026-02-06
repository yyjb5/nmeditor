import { render, screen } from "@testing-library/react";
import Panels from "../index";
import { describe, expect, it } from "vitest";

const t = (en: string) => en;

const baseProps = {
  showMacroPanel: true,
  showOpsPanel: false,
  showExportPanel: false,
  showFindPanel: true,
  showStatsPanel: false,
  macroOp: "replace" as const,
  macroColumn: "0",
  macroFind: "old",
  macroReplace: "new",
  macroText: "",
  macroScope: "loaded" as const,
  macroOutputPath: null,
  onMacroOpChange: () => {},
  onMacroColumnChange: () => {},
  onMacroFindChange: () => {},
  onMacroReplaceChange: () => {},
  onMacroTextChange: () => {},
  onMacroScopeChange: () => {},
  onRunMacro: () => {},
  rowIndexInput: "",
  columnIndexInput: "",
  columnNameInput: "",
  onRowIndexChange: () => {},
  onColumnIndexChange: () => {},
  onColumnNameChange: () => {},
  onInsertRow: () => {},
  onDeleteRow: () => {},
  onCopySelection: () => {},
  onPasteSelection: () => {},
  pasteMode: "auto" as const,
  onPasteModeChange: () => {},
  columnSearch: "",
  onColumnSearchChange: () => {},
  hiddenCols: [],
  onToggleColumnHidden: () => {},
  onShowAllColumns: () => {},
  onHideAllColumns: () => {},
  onMoveColumnUp: () => {},
  onMoveColumnDown: () => {},
  importSkipRows: "0",
  onImportSkipRowsChange: () => {},
  importFirstRowHeader: false,
  onImportFirstRowHeaderChange: () => {},
  onInsertColumn: () => {},
  onDeleteColumn: () => {},
  onRenameColumn: () => {},
  sortColumnInput: "",
  sortDirection: "asc" as const,
  filterColumnInput: "",
  filterText: "",
  onSortColumnChange: () => {},
  onSortDirectionChange: () => {},
  onFilterColumnChange: () => {},
  onFilterTextChange: () => {},
  onAddSortRule: () => {},
  onAddFilterRule: () => {},
  onClearSortFilter: () => {},
  sortRules: [],
  filterRules: [],
  onRemoveSortRule: () => {},
  onRemoveFilterRule: () => {},
  encodingMode: "UTF-8" as const,
  eolMode: "CRLF" as const,
  includeBom: false,
  dialectDelimiter: ",",
  dialectQuote: "\"",
  dialectEscape: "\"",
  onEncodingModeChange: () => {},
  onEolModeChange: () => {},
  onIncludeBomChange: () => {},
  onDialectDelimiterChange: () => {},
  onDialectQuoteChange: () => {},
  onDialectEscapeChange: () => {},
  findText: "foo",
  replaceText: "bar",
  findScope: "loaded" as const,
  findColumnInput: "",
  findStartRow: "",
  findEndRow: "",
  useRegex: false,
  matchCase: false,
  findOutputPath: null,
  onFindTextChange: () => {},
  onReplaceTextChange: () => {},
  onFindScopeChange: () => {},
  onFindColumnChange: () => {},
  onFindStartRowChange: () => {},
  onFindEndRowChange: () => {},
  onUseRegexChange: () => {},
  onMatchCaseChange: () => {},
  onApplyFindReplace: () => {},
  columnStats: [],
  fullStats: null,
  fullStatsLoading: false,
  onRunFullStats: () => {},
  loading: false,
  sortFilterActive: false,
  sortFilterMemoryLimitMb: 300,
  sortFilterMemoryLimitText: "300",
  onSortFilterMemoryLimitTextChange: () => {},
  onSortFilterMemoryLimitCommit: () => {},
  columnSelectOptions: [],
  hasPreview: true,
  t,
};

describe("Panels scope toggles", () => {
  it("shows macro hint for loaded scope", () => {
    render(<Panels {...baseProps} macroScope="loaded" />);
    expect(
      screen.getAllByText("Loaded rows only. Switch scope to full file for all rows.").length,
    ).toBeGreaterThan(0);
  });

  it("renders macro button label for full file scope", () => {
    const { rerender } = render(<Panels {...baseProps} macroScope="loaded" />);
    expect(screen.getAllByRole("button", { name: "Run on loaded rows" }).length).toBeGreaterThan(0);
    rerender(<Panels {...baseProps} macroScope="file" />);
    expect(screen.getAllByRole("button", { name: "Run on full file" }).length).toBeGreaterThan(0);
  });

  it("shows find hint for full file scope", () => {
    render(<Panels {...baseProps} findScope="file" />);
    expect(
      screen.getAllByText("Full file runs will export to a new file.").length,
    ).toBeGreaterThan(0);
  });

  it("renders find button label for loaded scope", () => {
    const { rerender } = render(<Panels {...baseProps} findScope="file" />);
    expect(screen.getAllByRole("button", { name: "Apply on full file" }).length).toBeGreaterThan(0);
    rerender(<Panels {...baseProps} findScope="loaded" />);
    expect(screen.getAllByRole("button", { name: "Apply find/replace" }).length).toBeGreaterThan(0);
  });
});
