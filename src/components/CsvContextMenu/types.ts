export type CsvContextMenuState =
  | { type: "row"; index: number; x: number; y: number }
  | { type: "col"; index: number; x: number; y: number };

export type CsvContextMenuProps = {
  t: (en: string, zh: string) => string;
  contextMenu: CsvContextMenuState | null;
  onRunContextAction: (action: string) => void;
};
