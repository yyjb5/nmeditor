/**
 * Application Global Type Definitions
 * 
 * This file contains global type definitions used across the application.
 */

import type { CsvTabData } from "./csv.types";
import type { TextTabData } from "./text.types";

/**
 * File mode type
 */
export type FileMode = "none" | "csv" | "text";

/**
 * Locale/Language options
 */
export type Locale = "en" | "zh";

/**
 * Tab file data - combines CSV and Text data
 */
export type TabFileData = {
    fileType: "csv" | "text";
    csvData?: CsvTabData;
    textData?: TextTabData;
};

/**
 * Pending initial save reference
 */
export type PendingInitialSave = {
    tabId: string;
    type: "csv" | "text";
} | null;

/**
 * Pending import configuration
 */
export type PendingImport = {
    skipRows: number;
    firstRowHeader: boolean;
} | null;

/**
 * Index trigger type
 */
export type IndexTrigger = "auto" | "manual" | null;

/**
 * Translation function type
 */
export type TranslationFunction = (en: string, zh: string) => string;
