/**
 * useFreezePane Hook
 * 
 * Manages frozen rows and columns in the grid.
 */

import { useState } from "react";

export interface UseFreezePaneReturn {
    freezeFirstCol: boolean;
    freezeFirstRow: boolean;
    frozenFirstRowValues: string[] | null;
    frozenFirstRowBaseIndex: number | null;
    setFreezeFirstCol: React.Dispatch<React.SetStateAction<boolean>>;
    setFreezeFirstRow: React.Dispatch<React.SetStateAction<boolean>>;
    setFrozenFirstRowValues: React.Dispatch<React.SetStateAction<string[] | null>>;
    setFrozenFirstRowBaseIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Hook for managing frozen panes (freeze first row/column)
 */
export default function useFreezePane(): UseFreezePaneReturn {
    const [freezeFirstCol, setFreezeFirstCol] = useState(false);
    const [freezeFirstRow, setFreezeFirstRow] = useState(false);
    const [frozenFirstRowValues, setFrozenFirstRowValues] = useState<string[] | null>(null);
    const [frozenFirstRowBaseIndex, setFrozenFirstRowBaseIndex] = useState<number | null>(null);

    return {
        freezeFirstCol,
        freezeFirstRow,
        frozenFirstRowValues,
        frozenFirstRowBaseIndex,
        setFreezeFirstCol,
        setFreezeFirstRow,
        setFrozenFirstRowValues,
        setFrozenFirstRowBaseIndex,
    };
}
