/**
 * useGridResize Hook
 * 
 * Manages grid resize interactions (column width, row height, etc.).
 */

import { useEffect, useRef } from "react";
import type { ResizeState } from "../types";
import { applyGlobalColumnResize } from "../utils/columnResize";

export interface UseGridResizeOptions {
    columnWidths: number[];
    rowHeaderWidth: number;
    rowHeight: number;
    headerHeightOverride: number | null;
    rowHeightOverrides: Record<number, number>;
    setColumnWidths: React.Dispatch<React.SetStateAction<number[]>>;
    setRowHeaderWidth: React.Dispatch<React.SetStateAction<number>>;
    setRowHeight: React.Dispatch<React.SetStateAction<number>>;
    setHeaderHeightOverride: React.Dispatch<React.SetStateAction<number | null>>;
    setRowHeightOverrides: React.Dispatch<React.SetStateAction<Record<number, number>>>;
    normalizeColumnWidths: (widths: number[]) => number[];
}

export interface UseGridResizeReturn {
    startColumnResize: (index: number, clientX: number) => void;
    startColumnResizeAll: (clientX: number) => void;
    startRowHeaderResize: (clientX: number) => void;
    startRowHeightResizeAll: (clientY: number) => void;
    startHeaderRowHeightResize: (clientY: number) => void;
    startRowHeightResizeRow: (rowIndex: number, clientY: number) => void;
    isResizing: boolean;
}

/**
 * Hook for managing grid resize interactions
 */
export default function useGridResize({
    columnWidths,
    rowHeaderWidth,
    rowHeight,
    headerHeightOverride,
    rowHeightOverrides,
    setColumnWidths,
    setRowHeaderWidth,
    setRowHeight,
    setHeaderHeightOverride,
    setRowHeightOverrides,
    normalizeColumnWidths,
}: UseGridResizeOptions): UseGridResizeReturn {
    const resizeStateRef = useRef<ResizeState>(null);

    /**
     * Start resizing a single column
     */
    const startColumnResize = (index: number, clientX: number) => {
        const startWidth = columnWidths[index] ?? 140;
        resizeStateRef.current = { type: "col", index, startX: clientX, startWidth };
    };

    /**
     * Start globally resizing all columns
     */
    const startColumnResizeAll = (clientX: number) => {
        const startWidths = normalizeColumnWidths(columnWidths);
        resizeStateRef.current = {
            type: "colAll",
            startX: clientX,
            startWidths,
            startRowHeaderWidth: rowHeaderWidth,
        };
    };

    /**
     * Start resizing the row header (index column)
     */
    const startRowHeaderResize = (clientX: number) => {
        resizeStateRef.current = { type: "row", startX: clientX, startWidth: rowHeaderWidth };
    };

    /**
     * Start globally resizing row height
     */
    const startRowHeightResizeAll = (clientY: number) => {
        resizeStateRef.current = { type: "rowHeightAll", startY: clientY, startHeight: rowHeight };
    };

    /**
     * Start resizing the header row height
     */
    const startHeaderRowHeightResize = (clientY: number) => {
        const startHeight = headerHeightOverride ?? rowHeight;
        resizeStateRef.current = { type: "headerRow", startY: clientY, startHeight };
    };

    /**
     * Start resizing a specific row's height
     */
    const startRowHeightResizeRow = (rowIndex: number, clientY: number) => {
        const startHeight = rowHeightOverrides[rowIndex] ?? rowHeight;
        resizeStateRef.current = {
            type: "rowHeightRow",
            rowIndex,
            startY: clientY,
            startHeight,
        };
    };

    /**
     * Handle mouse move and up events for resizing
     */
    useEffect(() => {
        const handleMove = (event: globalThis.MouseEvent) => {
            const state = resizeStateRef.current;
            if (!state) return;
            if (state.type === "col") {
                const delta = event.clientX - state.startX;
                const nextWidth = Math.max(60, state.startWidth + delta);
                setColumnWidths((current) => {
                    const next = normalizeColumnWidths(current);
                    next[state.index] = nextWidth;
                    return next;
                });
            } else if (state.type === "colAll") {
                const delta = event.clientX - state.startX;
                const next = applyGlobalColumnResize(
                    state.startWidths,
                    state.startRowHeaderWidth,
                    delta,
                );
                setRowHeaderWidth(next.rowHeaderWidth);
                setColumnWidths(next.columnWidths);
            } else if (state.type === "row") {
                const delta = event.clientX - state.startX;
                const nextWidth = Math.max(36, state.startWidth + delta);
                setRowHeaderWidth(nextWidth);
            } else if (state.type === "headerRow") {
                const delta = event.clientY - state.startY;
                const nextHeight = Math.max(18, Math.min(300, state.startHeight + delta));
                setHeaderHeightOverride(nextHeight);
            } else if (state.type === "rowHeightAll") {
                const delta = event.clientY - state.startY;
                const nextHeight = Math.max(18, Math.min(300, state.startHeight + delta));
                setRowHeight(nextHeight);
                setRowHeightOverrides({});
                setHeaderHeightOverride(null);
            } else if (state.type === "rowHeightRow") {
                const delta = event.clientY - state.startY;
                const nextHeight = Math.max(18, Math.min(300, state.startHeight + delta));
                setRowHeightOverrides((current) => ({
                    ...current,
                    [state.rowIndex]: nextHeight,
                }));
            }
        };

        const handleUp = () => {
            if (!resizeStateRef.current) return;
            resizeStateRef.current = null;
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, [
        normalizeColumnWidths,
        setColumnWidths,
        setHeaderHeightOverride,
        setRowHeaderWidth,
        setRowHeight,
        setRowHeightOverrides,
    ]);

    return {
        startColumnResize,
        startColumnResizeAll,
        startRowHeaderResize,
        startRowHeightResizeAll,
        startHeaderRowHeightResize,
        startRowHeightResizeRow,
        isResizing: !!resizeStateRef.current,
    };
}
