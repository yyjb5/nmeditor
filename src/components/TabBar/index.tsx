import "./styles.css";
import type { TabBarProps } from "./types";

export default function TabBar({
    tabs,
    activeTabId,
    onTabClick,
    onTabClose,
    onNewTab,
    t,
}: TabBarProps) {
    return (
        <div className="tab-bar">
            <div className="tab-list">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={`tab ${tab.id === activeTabId ? "active" : ""}`}
                        onClick={() => onTabClick(tab.id)}
                        title={tab.path}
                    >
                        {tab.isDirty && <div className="tab-dirty" />}
                        <span className="tab-title">{tab.fileName}</span>
                        <button
                            className="tab-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTabClose(tab.id);
                            }}
                            aria-label={t("Close", "关闭")}
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button
                    className="tab-new"
                    onClick={onNewTab}
                    aria-label={t("New file", "新文件")}
                    title={t("Open file", "打开文件")}
                >
                    +
                </button>
            </div>
        </div>
    );
}
