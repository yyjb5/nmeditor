/**
 * useEditingState Hook
 * 
 * Manages cell and header editing state.
 */

import { useCallback, useState } from "react";
import type { CellEditingState, HeaderEditingState } from "../types";

export interface UseEditingStateOptions {
    getCellValue: (row: number, col: number) => string;
    applyPatchWithUndo: (row: number, col: number, value: string) => void;
    renameColumnAtIndex: (index: number, name: string) => void;
}

export interface UseEditingStateReturn {
    editingCell: CellEditingState;
    editingHeader: HeaderEditingState;
    setEditingCell: React.Dispatch<React.SetStateAction<CellEditingState>>;
    setEditingHeader: React.Dispatch<React.SetStateAction<HeaderEditingState>>;
    startEditing: (row: number, col: number) => void;
    commitEditing: () => void;
    cancelEditing: () => void;
    startHeaderEditing: (index: number, value: string) => void;
    commitHeaderEditing: () => void;
    cancelHeaderEditing: () => void;
}

/**
 * Hook for managing cell and header editing state
 */
export default function useEditingState({
    getCellValue,
    applyPatchWithUndo,
    renameColumnAtIndex,
}: UseEditingStateOptions): UseEditingStateReturn {
    const [editingCell, setEditingCell] = useState<CellEditingState>(null);
    const [editingHeader, setEditingHeader] = useState<HeaderEditingState>(null);

    /**
     * Start editing a cell
     */
    const startEditing = useCallback(
        (row: number, col: number) => {
            setEditingCell({ row, col, value: getCellValue(row, col) });
        },
        [getCellValue],
    );

    /**
     * Commit cell editing
     */
    const commitEditing = useCallback(() => {
        if (!editingCell) return;
        applyPatchWithUndo(editingCell.row, editingCell.col, editingCell.value);
        setEditingCell(null);
    }, [editingCell, applyPatchWithUndo]);

    /**
     * Cancel cell editing
     */
    const cancelEditing = useCallback(() => {
        setEditingCell(null);
    }, []);

    /**
     * Start editing a header
     */
    const startHeaderEditing = useCallback((index: number, value: string) => {
        setEditingHeader({ index, value });
    }, []);

    /**
     * Commit header editing
     */
    const commitHeaderEditing = useCallback(() => {
        if (!editingHeader) return;
        renameColumnAtIndex(editingHeader.index, editingHeader.value);
        setEditingHeader(null);
    }, [editingHeader, renameColumnAtIndex]);

    /**
     * Cancel header editing
     */
    const cancelHeaderEditing = useCallback(() => {
        setEditingHeader(null);
    }, []);

    return {
        editingCell,
        editingHeader,
        setEditingCell,
        setEditingHeader,
        startEditing,
        commitEditing,
        cancelEditing,
        startHeaderEditing,
        commitHeaderEditing,
        cancelHeaderEditing,
    };
}
