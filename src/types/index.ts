/**
 * Type Definitions Index
 * 
 * Central export point for all type definitions.
 */

// CSV types
export type {
    PatchEntry,
    FindMatch,
    FindMatchSource,
    UndoOp,
    CsvTabData,
    DelimiterPreset,
    ResizeState,
    SortRule,
    FilterRule,
    HeaderEditingState,
    CellEditingState,
    AutoIndexMode,
    PasteMode,
} from "./csv.types";

// Text types
export type {
    TextEncoding,
    TextFindHit,
    TextTabData,
    TextFindOptions,
    TextReplaceOptions,
} from "./text.types";

// App types
export type {
    FileMode,
    Locale,
    TabFileData,
    PendingInitialSave,
    PendingImport,
    IndexTrigger,
    TranslationFunction,
} from "./app.types";
