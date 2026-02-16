import type { CsvContextMenuProps } from "./types";
import "./styles.css";

export default function CsvContextMenu({ t, contextMenu, onRunContextAction }: CsvContextMenuProps) {
  if (!contextMenu) return null;
  return (
    <div
      className="context-menu csv-context-menu"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(event) => event.stopPropagation()}
    >
      {contextMenu.type === "row" ? (
        <>
          <button onClick={() => onRunContextAction("insert_above")}>
            <span>{t("Insert row above", "在上方插入行")}</span>
            <span className="context-key">A</span>
          </button>
          <button onClick={() => onRunContextAction("insert_below")}>
            <span>{t("Insert row below", "在下方插入行")}</span>
            <span className="context-key">B</span>
          </button>
          <div className="context-menu-sep" />
          <button onClick={() => onRunContextAction("duplicate")}>
            <span>{t("Duplicate row", "复制行")}</span>
            <span className="context-key">D</span>
          </button>
          <button onClick={() => onRunContextAction("clear")}>
            <span>{t("Clear rows", "清空行")}</span>
            <span className="context-key">C</span>
          </button>
          <div className="context-menu-sep" />
          <button onClick={() => onRunContextAction("delete")}>
            <span>{t("Delete row", "删除行")}</span>
            <span className="context-key">X</span>
          </button>
        </>
      ) : (
        <>
          <button onClick={() => onRunContextAction("insert_left")}>
            <span>{t("Insert column left", "在左侧插入列")}</span>
            <span className="context-key">L</span>
          </button>
          <button onClick={() => onRunContextAction("insert_right")}>
            <span>{t("Insert column right", "在右侧插入列")}</span>
            <span className="context-key">R</span>
          </button>
          <div className="context-menu-sep" />
          <button onClick={() => onRunContextAction("duplicate")}>
            <span>{t("Duplicate column", "复制列")}</span>
            <span className="context-key">D</span>
          </button>
          <button onClick={() => onRunContextAction("clear")}>
            <span>{t("Clear columns", "清空列")}</span>
            <span className="context-key">C</span>
          </button>
          <div className="context-menu-sep" />
          <button onClick={() => onRunContextAction("copy_name")}>
            <span>{t("Copy column name", "复制列名")}</span>
            <span className="context-key">N</span>
          </button>
          <button onClick={() => onRunContextAction("rename")}>
            <span>{t("Rename column", "重命名列")}</span>
            <span className="context-key">E</span>
          </button>
          <div className="context-menu-sep" />
          <button onClick={() => onRunContextAction("delete")}>
            <span>{t("Delete column", "删除列")}</span>
            <span className="context-key">X</span>
          </button>
        </>
      )}
    </div>
  );
}
