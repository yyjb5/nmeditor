import { useState } from "react";

export default function useCsvInputState() {
  const [columnIndexInput, setColumnIndexInput] = useState("0");
  const [columnNameInput, setColumnNameInput] = useState("");
  const [rowIndexInput, setRowIndexInput] = useState("0");
  const [pasteMode, setPasteMode] = useState<"auto" | "strict" | "delimiter">("auto");
  const [columnSearch, setColumnSearch] = useState("");
  const [importSkipRows, setImportSkipRows] = useState("0");
  const [importFirstRowHeader, setImportFirstRowHeader] = useState(false);

  return {
    columnIndexInput,
    setColumnIndexInput,
    columnNameInput,
    setColumnNameInput,
    rowIndexInput,
    setRowIndexInput,
    pasteMode,
    setPasteMode,
    columnSearch,
    setColumnSearch,
    importSkipRows,
    setImportSkipRows,
    importFirstRowHeader,
    setImportFirstRowHeader,
  };
}
