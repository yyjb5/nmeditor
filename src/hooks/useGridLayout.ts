/**
 * useGridLayout Hook
 * 
 * Manages grid layout state including column widths, row heights, and related settings.
 */

import { useEffect, useState } from "react";

export interface GridLayoutState {
    columnWidths: number[];
    rowHeaderWidth: number;
    rowHeight: number;
    headerHeightOverride: number | null;
    rowHeightOverrides: Record<number, number>;
    autoFitColumns: boolean;
}

export interface UseGridLayoutOptions {
    layoutStorageKey: string;
    columnCount: number;
    normalizeColumnWidths: (widths: number[]) => number[];
}

export interface UseGridLayoutReturn extends GridLayoutState {
    setColumnWidths: React.Dispatch<React.SetStateAction<number[]>>;
    setRowHeaderWidth: React.Dispatch<React.SetStateAction<number>>;
    setRowHeight: React.Dispatch<React.SetStateAction<number>>;
    setHeaderHeightOverride: React.Dispatch<React.SetStateAction<number | null>>;
    setRowHeightOverrides: React.Dispatch<React.SetStateAction<Record<number, number>>>;
    setAutoFitColumns: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Hook for managing grid layout (column widths, row heights, etc.)
 */
export default function useGridLayout({
    layoutStorageKey,
    columnCount,
    normalizeColumnWidths,
}: UseGridLayoutOptions): UseGridLayoutReturn {
    const [columnWidths, setColumnWidths] = useState<number[]>([]);
    const [rowHeaderWidth, setRowHeaderWidth] = useState(52);
    const [rowHeight, setRowHeight] = useState(28);
    const [headerHeightOverride, setHeaderHeightOverride] = useState<number | null>(null);
    const [rowHeightOverrides, setRowHeightOverrides] = useState<Record<number, number>>({});
    const [autoFitColumns, setAutoFitColumns] = useState(false);

    /**
     * Normalize column widths when column count changes
     */
    useEffect(() => {
        setColumnWidths((current) => {
            return normalizeColumnWidths(current);
        });
    }, [columnCount, normalizeColumnWidths]);

    /**
     * Load layout from localStorage
     */
    useEffect(() => {
        const raw = window.localStorage.getItem(layoutStorageKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as {
                columnWidths?: number[];
                rowHeaderWidth?: number;
                rowHeight?: number;
                headerHeightOverride?: number;
                rowHeightOverrides?: Record<string, number>;
                autoFitColumns?: boolean;
            };
            if (Array.isArray(parsed.columnWidths)) {
                setColumnWidths(parsed.columnWidths.map((value) => Math.max(60, Number(value) || 140)));
            }
            if (typeof parsed.rowHeaderWidth === "number" && Number.isFinite(parsed.rowHeaderWidth)) {
                setRowHeaderWidth(Math.max(36, parsed.rowHeaderWidth));
            }
            if (typeof parsed.rowHeight === "number" && Number.isFinite(parsed.rowHeight)) {
                setRowHeight(Math.max(18, Math.min(300, parsed.rowHeight)));
            }
            if (
                typeof parsed.headerHeightOverride === "number" &&
                Number.isFinite(parsed.headerHeightOverride)
            ) {
                setHeaderHeightOverride(Math.max(18, Math.min(300, parsed.headerHeightOverride)));
            }
            if (parsed.rowHeightOverrides && typeof parsed.rowHeightOverrides === "object") {
                const next: Record<number, number> = {};
                Object.entries(parsed.rowHeightOverrides).forEach(([key, value]) => {
                    const index = Number.parseInt(key, 10);
                    if (Number.isNaN(index)) return;
                    const parsedValue = Number(value);
                    if (!Number.isFinite(parsedValue)) return;
                    const height = Math.max(18, Math.min(300, parsedValue));
                    next[index] = height;
                });
                setRowHeightOverrides(next);
            }
            if (typeof parsed.autoFitColumns === "boolean") {
                setAutoFitColumns(parsed.autoFitColumns);
            }
        } catch {
            // ignore malformed storage
        }
    }, [layoutStorageKey]);

    /**
     * Save layout to localStorage
     */
    useEffect(() => {
        window.localStorage.setItem(
            layoutStorageKey,
            JSON.stringify({
                columnWidths,
                rowHeaderWidth,
                rowHeight,
                headerHeightOverride,
                rowHeightOverrides,
                autoFitColumns,
            }),
        );
    }, [
        columnWidths,
        rowHeaderWidth,
        rowHeight,
        headerHeightOverride,
        rowHeightOverrides,
        autoFitColumns,
        layoutStorageKey,
    ]);

    return {
        columnWidths,
        rowHeaderWidth,
        rowHeight,
        headerHeightOverride,
        rowHeightOverrides,
        autoFitColumns,
        setColumnWidths,
        setRowHeaderWidth,
        setRowHeight,
        setHeaderHeightOverride,
        setRowHeightOverrides,
        setAutoFitColumns,
    };
}
