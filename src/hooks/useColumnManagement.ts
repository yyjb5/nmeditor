/**
 * useColumnManagement Hook
 * 
 * Manages column visibility, ordering, and related operations.
 */

import { useCallback, useEffect, useState } from "react";

export interface UseColumnManagementOptions {
    dataColumnCount: number;
}

export interface UseColumnManagementReturn {
    hiddenCols: Set<number>;
    columnOrder: number[];
    setHiddenCols: React.Dispatch<React.SetStateAction<Set<number>>>;
    setColumnOrder: React.Dispatch<React.SetStateAction<number[]>>;
    handleToggleColumnHidden: (index: number) => void;
    handleShowAllColumns: () => void;
    handleHideAllColumns: () => void;
}

/**
 * Hook for managing column visibility and ordering
 */
export default function useColumnManagement({
    dataColumnCount,
}: UseColumnManagementOptions): UseColumnManagementReturn {
    const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set());
    const [columnOrder, setColumnOrder] = useState<number[]>([]);

    /**
     * Toggle column visibility
     */
    const handleToggleColumnHidden = useCallback((index: number) => {
        setHiddenCols((current) => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }, []);

    /**
     * Show all columns
     */
    const handleShowAllColumns = useCallback(() => {
        setHiddenCols(new Set());
    }, []);

    /**
     * Hide all columns
     */
    const handleHideAllColumns = useCallback(() => {
        const count = Math.max(dataColumnCount, 0);
        setHiddenCols(new Set(Array.from({ length: count }, (_, idx) => idx)));
    }, [dataColumnCount]);

    /**
     * Sync column order when dataColumnCount changes
     */
    useEffect(() => {
        setColumnOrder((current) => {
            if (!current.length) return current;
            const maxIndex = Math.max(dataColumnCount, 0);
            const filtered = current.filter((idx) => idx >= 0 && idx < maxIndex);
            const missing: number[] = [];
            const present = new Set(filtered);
            for (let idx = 0; idx < maxIndex; idx += 1) {
                if (!present.has(idx)) missing.push(idx);
            }
            return [...filtered, ...missing];
        });
    }, [dataColumnCount]);

    return {
        hiddenCols,
        columnOrder,
        setHiddenCols,
        setColumnOrder,
        handleToggleColumnHidden,
        handleShowAllColumns,
        handleHideAllColumns,
    };
}
