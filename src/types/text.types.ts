/**
 * Text Editor Type Definitions
 * 
 * This file contains all type definitions related to text editing functionality.
 */

/**
 * Text encoding options
 */
export type TextEncoding = "UTF-8" | "UTF-16LE" | "GBK" | "SHIFT-JIS";

/**
 * Text find hit result
 */
export type TextFindHit = {
    offset: number;
    length: number
};

/**
 * Text data state for a tab
 */
export type TextTabData = {
    content: string;
    dirty: boolean;
    path: string;
    encoding: TextEncoding;
    readOnlyPreview?: boolean;
    previewOffset?: number;
    previewHasPrev?: boolean;
    previewHasNext?: boolean;
    previewBytes?: number | null;
    totalBytes?: number | null;
    previewReplaceOffset?: number;
    previewReplaceBytes?: number;
};

/**
 * Text find options
 */
export type TextFindOptions = {
    query: string;
    useRegex: boolean;
    matchCase: boolean;
};

/**
 * Text replace options
 */
export type TextReplaceOptions = {
    value: string;
    preserveCase: boolean;
};
