export type TabData = {
    id: string;
    path: string;
    fileName: string;
    isDirty: boolean;
    fileType: "csv" | "text";
};

export type TabBarProps = {
    tabs: TabData[];
    activeTabId: string | null;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onNewTab: () => void;
    t: (en: string, zh: string) => string;
};
