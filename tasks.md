# deskcsv Tasks (Table View)

| ID | Priority | 类别 | 任务 | 状�?| 说明 |
|---|---|---|---|---|---|
| T-ARC-001 | P0 | 架构 | 重构 `App.tsx`：解耦主流程并拆分到组件/页面目录（每个目录含 `index.tsx` + `types` + `css/less`） | 已完成 | 已抽离文本查找结果面板、文本模式工作区、CSV 页面壳、文本状态栏、CSV 右键菜单、CSV 模式状态栏、菜单事件桥接、CSV 右键菜单快捷键监听、App 菜单集成 hook、诊断系统 hook、最近文件 hook、排序/筛选偏好 hook、CSV 草稿持久化 hook、侧栏抽屉 hook、文本查找结果导航 hook、文本查找结果模型 hook、文本全文件查找/替换任务 hook、文本局部替换动作 hook、CSV 查找任务 hook，并将 CSV 页面 props 组装迁到 `src/pages/CsvEditorPage/buildProps.ts`；**新增**：类型定义抽离到 `src/types/`，常量抽离到 `src/constants/`，格式化工具函数抽离到 `src/utils/formatting.ts`，新增 useColumnManagement/useGridLayout/useFreezePane/useGridResize/useEditingState hooks，并将 `App.tsx` 中的 Layout/Resize/Freeze/Column 状态管理迁移至这些 hooks；**新增**：抽出 `useCsvDataModel`（patches/undo/row/col ops）、`useCsvDataLoader`（窗口加载/索引/缓存）、`useTabDataPersistence`（Tab 状态序列化/恢复）、`useCsvGridVirtualization`（虚拟滚动/滚动加载/窗口位移修正）、`useCsvSortFilterModel`（排序/筛选状态与规则管理）、`useCsvStructureActions`（行列增删改入口与输入解析）、`useCsvGlobalViewRebuild`（全局视图重建生命周期）、`useCsvGridKeyboard`（CSV 键盘导航/编辑快捷键）、`usePendingImportRules`（导入规则自动应用）、`useCsvSelectionDataActions`（选区复制/剪切/自动填充与跨窗口数据读写）、`useCsvSaveActions`（Save As/分隔符应用流程）、`useCsvSessionReset`（会话重置/全局视图释放）、`useCsvFindNavigationFocus`（查找结果定位/跳转）、`useTextToolbarActions`（文本另存为/按偏移跳转）、`useTextFindReplaceResetState`（查找/替换状态重置）、`useTextFindReplaceLifecycleEffects`（查找/替换生命周期 effect）、`useCsvFindLifecycleEffects`（CSV 查找清理生命周期 effect）、`useCsvFileActionHandlers`（宏/查找替换触发与清理编辑编排）、`useCsvHeaderFilterAndFrozenRow`（列头筛选值统计 + 冻结首行快照/显示）、`useCsvAutoFit`（自动列宽计算）、`useCsvColumnStats`（列统计类型推断）、`useCsvColumnOrdering`（列顺序选项与移动）、`useActiveTabDirtySync`（当前 Tab 脏状态同步）、`usePendingInitialTabSave`（初始打开延迟保存触发）、`useCsvInitialWindowLoad`（CSV 初始总行数与窗口加载）和 `useCsvGlobalViewPatchQueue`（全局视图 patch 防抖队列）；同时抽出 `useTabPathActions`（tab 路径更新），并新增 `src/components/CSVGrid/*` 包装层、`src/pages/TextEditorPage/*` 与 `src/pages/CsvWorkspacePage/*`。 |
| T-CSV-001 | P0 | 功能 | CSV 列头下拉筛选（值列�?搜索/多选） | 已完�?| 列头支持 contains / 值列表搜�?/ 多选，按全文件或全局视图执行 |
| T-TXT-001 | P0 | 功能 | 文本模式多光标/多选区编辑 | 已完成 | 已支持 `Ctrl/Meta+D` 增量选区、`Ctrl/Meta+Shift+L` 全部匹配、`Alt+Shift+I` 行尾加光标、`Alt+Shift+Up/Down` 垂直加光标、`Ctrl/Meta+Shift+D` 撤销、Esc 清空；并补齐编辑区内多光标可视化标记与同步输入/回退/删除/粘贴 |
| T-TXT-002 | P0 | 功能 | 列块选择/矩形编辑（Alt 拖拽） | 已完成 | 已完成：Alt+拖拽矩形选区、Alt+Shift+方向键/Home/End/Page 扩展、块选区高亮覆盖层、列块多光标按行分发粘贴、列块复制/剪切（按行拼接剪贴板），以及与 Go line:col/书签跳转联动（保持列块 anchor/focus） |
| T-TXT-003 | P0 | 功能 | 全文件查找结果面板与批量跳转 | 已完成 | 已补结果序号直达/首末跳转/分块命中标识/上下文预览分组/命中高亮/上下文长度可调/分组折叠/当前分段置顶/折叠状态持久化/结果分页懒加载，并完成更深层懒加载（分组命中滚动到底自动增量加载） |
| T-TXT-004 | P0 | 功能 | 正则替换高级选项（选区/逐条确认/保留大小写） | 已完成 | 已完成选区替换 + Replace next（从光标向后并环回）+ 保留大小写（含全文件字面量替换）+ 逐条确认（Preview next + Confirm replace） |
| T-TXT-005 | P0 | 功能 | 语法高亮/代码折叠/括号匹配 | 已完成 | 已完成阶段1：括号匹配高亮（overlay）；阶段2：轻量语法高亮预览（可开关+大文件截断保护）；阶段3：语法预览内 `{}` 代码块折叠/展开（单块+全部）；阶段4：编辑区可选内联语法高亮 overlay（阈值保护）；阶段5：括号匹配快捷跳转 + 语法预览光标行联动定位；阶段6：CodeMirror 原生只读语法预览引擎（可切换，lazy load）；阶段7：CodeMirror 预览行点击跳转与活动行同步高亮；阶段8：CodeMirror 原生预览支持可切换“可编辑模式”（与主编辑区内容同步、保留原生 fold/token）；阶段9：原生可编辑预览补齐选区同步（与文本编辑区光标状态一致）和原生多选快捷键（`Mod+D`/`Mod+Shift+L`）；阶段10：原生可编辑预览补齐更多多光标快捷键（`Mod+Shift+D`/`Alt+Shift+Up`/`Alt+Shift+Down`/`Alt+Shift+I`/`Escape`）；阶段11：原生可编辑预览将多选区同步回文本模式多光标状态（状态条与选区数量一致）；阶段12：原生可编辑预览补齐 `F2`/`Shift+F2`/`Mod+F2` 书签快捷键与 `Mod+Shift+\` 括号跳转；阶段13：原生可编辑模式下将底部 textarea 切为只读影子层（禁用焦点与鼠标输入）以避免双编辑冲突；阶段14：原生可编辑预览补齐 Alt+拖拽矩形选区（CodeMirror `rectangularSelection` + `crosshairCursor`），并同步到多选区状态；阶段15：切换原生编辑模式时自动聚焦 CodeMirror（保留当前选区上下文，减少二次点击）；阶段16：原生模式下的跳转动作（行列/书签/括号）执行后自动回焦到 CodeMirror，保持连续键盘编辑流；阶段17：原生编辑开启时主编辑区改为 CodeMirror 单实例渲染入口（上方预览不再重复渲染编辑实例，textarea 仅保留兼容后备）；阶段18：原生模式补齐 `Alt+Shift+Arrow/Home/End/Page` 列块扩展快捷键，并与现有块选区模型联动；阶段19：原生 `Alt+Drag` 列块选区回写块选区锚点状态，确保 `Alt+Shift+Up/Down` 可连续按列块语义扩展；已完成原生路径收尾整合 |
| T-ROB-001 | P0 | 健壮性 | 全文件替换事务与崩溃恢复 | 已完成 | 已实现 replace journal、启动自动恢复与手动恢复入口（`recover_replace_journals`） |
| T-CSV-002 | P1 | 功能 | CSV 冻结窗格（首�?首列�?| 已完�?| Quickbar 开�?+ 网格 sticky 首行/首列，虚拟滚动对齐修�?|
| T-TXT-006 | P1 | 功能 | 转到行列、书签、书签跳转 | 已完成 | 已完成：Go line:col 输入跳转、Toggle Bookmark、Prev/Next Bookmark、`F2`/`Shift+F2`/`Ctrl/Meta+F2` 快捷键、书签列表面板（跳转/移除/清空）、书签按文件持久化与面板过滤、书签 JSON 导入导出与批量管理 |
| T-TXT-007 | P1 | 功能 | 文本编码扩展（GBK/Shift-JIS 等） | 已完成 | 文本模式支持 UTF-8/UTF-16LE/GBK/SHIFT-JIS 打开、保存、查找与替换 |
| T-TXT-008 | P1 | 功能 | EOL/空白字符可视化与转换 | 已完成 | 文本模式已支持 EOL 状态显示、CRLF/LF 转换、行尾空白清理与空白符可视化预览 |
| T-TXT-009 | P1 | 功能 | 文件对比/合并（Diff/Merge） | 已完成 | 文本模式已支持选择对比文件、差异块面板预览、按块合并与整份采用右侧 |
| T-BIN-001 | P1 | 功能 | 十六进制查看/编辑模式 | 已完成 | 文本模式已支持 Hex 窗口浏览、偏移跳转、字节暂存编辑、按区段写回与 ASCII 对照 |
| T-TXT-010 | P2 | 功能 | Minimap/文档地图与结构导航 | 已完成 | 文本模式已支持右侧文档地图、可见窗口定位、按比例跳转与结构项快速跳转 |
| T-EXT-001 | P2 | 功能 | 插件/脚本扩展机制 | 已完成 | 文本模式已支持扩展命令注册、脚本加载、按命令权限勾选授权与沙箱化 API 执行 |
| T-UI-001 | P2 | UI | 文本命令面板（Command Palette） | 已完成 | 文本模式已支持可搜索命令面板、快捷键显示与 `Ctrl/Meta+Shift+P` 入口 |
| T-MD-001 | P2 | 功能 | Markdown 渲染预览（MD） | 已完成 | 文本模式已支持 Markdown 实时渲染预览（代码块/表格/任务列表）与按块跳转源码联动 |
| T-MD-002 | P1 | 功能 | Markdown 单面板编辑渲染对齐优化（光标与视觉一致性） | 已完成 | 已优化单面板渲染样式（去卡片化/统一行高）并保留段落与列表换行，降低光标与视觉错位 |
| T-MD-003 | P1 | 功能 | Markdown 预览层交互能力（链接/元素可点击） | 已完成 | 已支持在渲染编辑模式下直接点击 Markdown 链接（非链接区域保持透传编辑） |
| T-MD-004 | P1 | 健壮性 | Markdown 大文件截断可视提示 | 已完成 | 已在工具栏与预览层增加截断提示，明确显示预览字符上限与截断状态 |
| T-MD-005 | P1 | 功能 | Markdown 语法覆盖扩展（更完整 GFM） | 已完成 | 已补齐 setext 标题、`~~~` fenced code 与缩进代码块等常见语法覆盖 |
| T-MD-006 | P1 | 健壮性 | Markdown 行内规则边界修正 | 已完成 | 已修复转义符、下划线单词误斜体、带括号链接等边界场景，并补充对应单测 |
| T-MD-007 | P1 | 性能 | Markdown 增量渲染与性能优化 | 已完成 | 已将 Markdown 解析切换为 deferred 渲染路径并增加渲染中状态，降低输入阻塞 |
| T-MD-008 | P1 | 功能 | Markdown 一键切换“源码模式”（纯文本编辑） | 已完成 | 已提供按钮与命令面板入口，一键切换“源码模式/渲染模式” |
| T-MD-009 | P1 | UI | Markdown 显示样式精修（标题/代码块/表格/引用/任务项） | 已完成 | 已完成单面板渲染样式精修：统一标题层级、引用块、代码块、表格与任务列表视觉层级，提升阅读扫读效率 |
| T-MD-010 | P1 | 功能 | Markdown 渲染栈升级（remark-gfm + sanitize） | 已完成 | 已切换渲染管线到 `remark-gfm + rehype-sanitize + rehype-stringify`，并补充外链安全属性与单测覆盖 |
| T-MD-011 | P2 | 体验 | Markdown WYSIWYG/混合编辑方案评估与落地 | 已完成 | 已落地单面板混合编辑方案（实时渲染 + 源码模式），并输出评估文档 `docs/markdown-hybrid-editing.md` |

## Recently Completed

| ID | 类别 | 任务 | 状�?|
|---|---|---|---|
| D-CSV-001 | 功能 | CSV 自动填充（fill handle，跨窗口/四方向） | 已完�?|
| D-CSV-002 | 功能 | CSV 筛选列输入改为统一下拉选择�?| 已完�?|
| D-CSV-003 | UI | CSV 焦点/输入模式状态栏提示（导�?编辑/未聚焦） | 已完�?|
| D-CSV-004 | 功能 | CSV 键盘导航与编辑快捷键统一 keymap | 已完�?|
| D-CSV-005 | 功能 | CSV 列头值列表筛选（全文�?全局视图�?| 已完�?|
| D-CSV-006 | 功能 | CSV 冻结首列开关（Quickbar + Grid sticky�?| 已完�?|
| D-CSV-007 | 功能 | CSV 冻结首行（Quickbar + sticky top row�?| 已完�?|
| D-CSV-008 | 健壮�?| CSV 冻结首行时虚拟滚动高�?位移对齐修复（去除额外空白） | 已完�?|
| D-TXT-001 | 功能 | 文本全文件查找结果面板增强（首末/序号跳转、当前分块命中标记） | 已完�?|
| D-TXT-002 | 功能 | 文本查找结果上下文预览与分块分组展示 | 已完�?|
| D-TXT-003 | 功能 | 文本查找结果命中高亮与上下文长度可调（Ctx�?| 已完�?|
| D-TXT-004 | 健壮�?| 文本查找分组折叠/展开与仅展开分组分批上下文加�?| 已完�?|
| D-TXT-005 | 体验 | 文本查找结果当前分段置顶 + 分组折叠状态按文件/查询持久�?| 已完�?|
| D-CSV-009 | Backend+Frontend | CSV file/global-view find job chunk consumption + incremental polling | Done |
| D-CSV-010 | UX | CSV find result panel incremental rendering (auto-load on scroll + manual Load more + active-hit auto-reveal) | Done |
| D-CSV-011 | UX | CSV find result panel pagination + hit index jump (first/prev/next/last + Go #) | Done |
| D-CSV-012 | Perf | CSV find result panel virtualized list (windowed rendering + spacer rows) | Done |

| D-TXT-006 | UX | Text find result panel pagination (first/prev/next/last page) with hit jump auto page switch | Done |
| D-TXT-007 | UX | Text find result panel auto incremental load on scroll (with manual Load more fallback) | Done |
| D-TXT-008 | Backend | Text find job streaming chunks via consume_from/consume_limit + frontend incremental polling | Done |
| D-TXT-010 | Perf/Memory | Text find context cache pruning (keep visible + active-neighbor, cap 2048) | Done |
| D-TXT-011 | Perf/UX | Text find result panel group-level lazy rendering (batch load + scroll auto-load + on-demand contexts) | Done |
| D-TXT-012 | Perf/UX | Text find result panel per-group hit lazy rendering (group hit batch + load more per group) | Done |
| D-TXT-013 | Feature | Text replace supports selection-only replace (current selection scope in editor) | Done |
| D-TXT-014 | Feature | Text replace supports "Replace next" from caret (wrap-around in current chunk) | Done |
| D-TXT-015 | Feature | Text replace supports preserve-case toggle across chunk/selection/next and file literal replace | Done |
| D-TXT-016 | Feature | Text replace supports confirm-each flow (Preview next + Confirm replace) in text chunk mode | Done |
| D-TXT-017 | Perf/UX | Text find results auto-load group hits on bottom scroll for deep lazy loading | Done |
| D-TXT-018 | Feature | Text multi-cursor first stage: Ctrl/Meta+D add-next-selection + synchronized typing/backspace/delete/paste | Done |
| D-TXT-019 | UX/Shortcut | Text multi-cursor stage 2: visual status strip + undo last cursor + line-end cursors (Alt+Shift+I) | Done |
| D-TXT-020 | Shortcut | Text multi-cursor add-all-matches shortcut (`Ctrl/Meta+Shift+L`) | Done |
| D-TXT-021 | Shortcut | Text multi-cursor vertical add (`Alt+Shift+Up/Down`) with column alignment | Done |
| D-TXT-022 | UX | Text multi-cursor in-editor caret markers overlay (scroll-aware) | Done |
| D-TXT-023 | Feature | Text block selection stage 1: Alt-drag rectangular ranges mapped to multi-cursor selection model | Done |
| D-TXT-024 | Shortcut | Text block selection stage 2: Alt+Shift+Arrow keys extend rectangular selection | Done |
| D-TXT-025 | UX | Text block selection highlight overlay in editor area | Done |
| D-TXT-026 | Feature | Text block selection stage 3: multi-line paste distributed per cursor/range | Done |
| D-TXT-027 | Feature | Text block selection stage 4: block copy/cut writes line-joined clipboard text and applies multi-delete | Done |
| D-TXT-028 | Shortcut | Text block selection stage 5: Alt+Shift+Home/End/PageUp/PageDown extends rectangular selection | Done |
| D-TXT-029 | Feature | Text navigation stage 1: Go line:col + bookmark toggle/prev/next with F2 shortcuts | Done |
| D-TXT-030 | UX | Text navigation stage 2: bookmark panel with jump/remove/clear actions | Done |
| D-TXT-031 | Feature | Text navigation stage 3: per-file bookmark persistence and bookmark panel filter | Done |
| D-TXT-032 | Feature | Text navigation stage 4: bookmark import/export (JSON) with batch management actions | Done |
| D-TXT-033 | Feature | Text block selection stage 6: Go line:col + bookmark jumps preserve block selection anchor/focus | Done |
| D-TXT-034 | Feature | Text mode bracket matching stage 1: near-caret pair detection + overlay highlights + status hint | Done |
| D-TXT-035 | Feature | Text mode syntax highlight stage 2: lightweight syntax preview panel (toggle + auto language detect + memory-safe truncation) | Done |
| D-TXT-036 | Feature | Text mode code folding stage 3: brace-based fold/unfold in syntax preview (single/all) | Done |
| D-TXT-037 | Feature | Text mode syntax stage 4: optional inline syntax overlay in editor area with memory guard | Done |
| D-TXT-038 | UX | Text mode syntax stage 5: bracket-jump shortcut + syntax-preview caret-line sync and click-to-jump | Done |
| D-TXT-039 | Architecture/UX | Text mode syntax stage 6: CodeMirror native read-only preview engine with fold gutter + bracket matching + lazy-loaded chunk | Done |
| D-TXT-040 | UX | Text mode syntax stage 7: CodeMirror preview parity (line-click jump + active-line sync highlight) | Done |
| D-TXT-041 | Feature | Text mode syntax stage 8: CodeMirror preview optional editable mode (native token/fold editing path with content sync) | Done |
| D-TXT-042 | Feature | Text mode syntax stage 9: native editable preview selection sync + native multi-select shortcuts (`Mod+D` / `Mod+Shift+L`) | Done |
| D-TXT-043 | Feature | Text mode syntax stage 10: native editable preview extends multi-cursor shortcut parity (`Mod+Shift+D` / `Alt+Shift+Up` / `Alt+Shift+Down` / `Alt+Shift+I` / `Escape`) | Done |
| D-TXT-044 | Feature | Text mode syntax stage 11: native editable preview mirrors native multi-selection ranges into text-mode multi-cursor state | Done |
| D-TXT-045 | Feature | Text mode syntax stage 12: native editable preview restores bookmark/bracket-jump shortcut parity (`F2` / `Shift+F2` / `Mod+F2` / `Mod+Shift+\\`) | Done |
| D-TXT-046 | UX | Text mode syntax stage 13: native editable mode switches textarea into read-only shadow layer (no mouse/focus editing conflict) | Done |
| D-TXT-047 | Feature | Text mode syntax stage 14: native editable preview enables rectangular selection (`Alt+Drag`) with crosshair hint and synced multi-range state | Done |
| D-TXT-048 | UX | Text mode syntax stage 15: native edit toggle auto-focuses CodeMirror editor while keeping current selection context | Done |
| D-TXT-049 | UX | Text mode syntax stage 16: native-mode navigation actions re-focus CodeMirror to preserve uninterrupted keyboard editing flow | Done |
| D-TXT-050 | Architecture/UX | Text mode syntax stage 17: native edit mode promotes CodeMirror to single main editor surface (textarea kept as hidden compatibility fallback) | Done |
| D-TXT-051 | Feature | Text mode syntax stage 18: native-mode block-selection expansion parity via `Alt+Shift+Arrow/Home/End/Page` with existing block model linkage | Done |
| D-TXT-052 | Feature | Text mode syntax stage 19: native rectangular-selection now syncs block anchor state for continued Alt+Shift+Up/Down block expansion | Done |
| D-TXT-053 | Feature | Text encoding expansion: UTF-8/UTF-16LE/GBK/SHIFT-JIS open+save+file find/replace pipeline | Done |
| D-TXT-054 | Feature | Text EOL/whitespace toolkit: status telemetry + CRLF/LF convert + trailing whitespace trim + visible whitespace preview | Done |
| D-TXT-055 | Feature | Text diff/merge panel: select compare file + block-level merge + take-all-right workflow | Done |
| D-BIN-001 | Feature | Text-mode hex panel: offset jump + byte staging/edit + contiguous byte-range apply + ASCII mirror | Done |
| D-TXT-056 | Feature | Text minimap/doc-map: right-side minimap + visible-window/caret marker + structure outline quick jump | Done |
| D-EXT-001 | Feature | Text extension runtime: command registry + script loader + permission-gated sandbox context (run/unload) | Done |
| D-UI-001 | UI | Text command palette: searchable command list + shortcut hints + `Ctrl/Meta+Shift+P` quick-open | Done |
| D-MD-001 | Feature | Markdown preview panel: live render blocks (heading/paragraph/code/table/task-list) + source line jump linkage | Done |
| D-ROB-001 | Robustness | File replace transaction journal + crash recovery (startup auto-recover + manual command) | Done |
| D-ARC-001 | Architecture | Extract text find results panel from `App.tsx` into `src/components/TextFindResultsPanel/*` | Done |
| D-ARC-002 | Architecture | Extract text mode workspace from `App.tsx` into `src/components/TextModeWorkspace/*` | Done |
| D-ARC-003 | Architecture | Extract CSV branch view shell from `App.tsx` into `src/pages/CsvEditorPage/*` | Done |
| D-ARC-004 | Architecture | Extract text status footer from `App.tsx` into `src/components/TextModeStatusBar/*` | Done |
| D-ARC-005 | Architecture | Extract CSV context menu from `App.tsx` into `src/components/CsvContextMenu/*` | Done |
| D-ARC-006 | Architecture | Extract text-find helper constants/functions from `App.tsx` into `src/utils/textFind.ts` | Done |
| D-ARC-007 | Architecture | Extract CSV context action logic from `App.tsx` into `src/utils/csvContextActions.ts` | Done |
| D-ARC-008 | Architecture | Extract menu-event bridge/listener dispatch from `App.tsx` into `src/hooks/useMenuEventBridge.ts` | Done |
| D-ARC-009 | Architecture | Extract CSV context-menu keyboard/click shortcuts effect from `App.tsx` into `src/hooks/useCsvContextMenuShortcuts.ts` | Done |
| D-ARC-010 | Architecture | Extract App menu integration (locale sync + about + menu bridge wiring) from `App.tsx` into `src/hooks/useAppMenuIntegration.ts` | Done |
| D-ARC-011 | Architecture | Extract CSV-mode status bar rendering/build-index wiring from `App.tsx` into `src/components/CsvModeStatusBar/*` | Done |
| D-ARC-012 | Architecture | Extract CSV page prop composition from `App.tsx` into `src/pages/CsvEditorPage/buildProps.ts` | Done |
| D-ARC-013 | Architecture | Extract diagnostics state/effects/shortcut logic from `App.tsx` into `src/hooks/useDiagnostics.ts` | Done |
| D-ARC-014 | Architecture | Extract recent-files persistence/list management from `App.tsx` into `src/hooks/useRecentFiles.ts` | Done |
| D-ARC-015 | Architecture | Extract sort/filter preference state + localStorage sync from `App.tsx` into `src/hooks/useSortFilterPreferences.ts` | Done |
| D-ARC-016 | Architecture | Extract CSV draft key/load/clear/auto-save persistence from `App.tsx` into `src/hooks/useCsvDraftPersistence.ts` | Done |
| D-ARC-017 | Architecture | Extract panel-drawer collapse/resize/show-state logic from `App.tsx` into `src/hooks/usePanelDrawer.ts` | Done |
| D-ARC-018 | Architecture | Extract text-find result navigation/pagination/scroll-lazy handlers from `App.tsx` into `src/hooks/useTextFindNavigation.ts` | Done |
| D-ARC-019 | Architecture | Extract text-find results grouping/context cache/collapse model from `App.tsx` into `src/hooks/useTextFindResultsModel.ts` | Done |
| D-ARC-020 | Architecture | Extract text file find/replace job run-poll-cancel lifecycle from `App.tsx` into `src/hooks/useTextFileFindReplaceJobs.ts` | Done |
| D-ARC-021 | Architecture | Extract text chunk/selection/next replace actions from `App.tsx` into `src/hooks/useTextReplaceActions.ts` | Done |
| D-ARC-022 | Architecture | Extract CSV find run/poll/cancel and loaded-scope search lifecycle from `App.tsx` into `src/hooks/useCsvFindMatches.ts` | Done |
| D-ARC-023 | Architecture | Extract CSV data model (patches, undo/redo, row/col ops, editing state, clear-shifts) from `App.tsx` into `src/hooks/useCsvDataModel.ts` | Done |
| D-ARC-024 | Architecture | Extract CSV data loading, indexing, caching, and request logic from `App.tsx` into `src/hooks/useCsvDataLoader.ts` | Done |
| D-ARC-026 | Architecture | Extract tab snapshot save/load lifecycle from `App.tsx` into `src/hooks/useTabDataPersistence.ts` | Done |
| D-ARC-027 | Architecture | Extract CSV virtualization + scroll-triggered window loading from `App.tsx` into `src/hooks/useCsvGridVirtualization.ts` | Done |
| D-ARC-025 | Architecture | Extract CSV Grid rendering and virtualization logic into `src/components/CSVGrid` | Done |
| D-ARC-028 | Architecture | Extract CSV sort/filter state + rule ops + header filter mapping from `App.tsx` into `src/hooks/useCsvSortFilterModel.ts` | Done |
| D-ARC-029 | Architecture | Extract CSV structural row/column actions (insert/delete/rename + input parsing) from `App.tsx` into `src/hooks/useCsvStructureActions.ts` | Done |
| D-ARC-030 | Architecture | Extract global-view rebuild lifecycle/debounce from `App.tsx` into `src/hooks/useCsvGlobalViewRebuild.ts` | Done |
| D-ARC-031 | Architecture | Extract CSV grid keyboard navigation/edit shortcuts from `App.tsx` into `src/hooks/useCsvGridKeyboard.ts` | Done |
| D-ARC-032 | Architecture | Extract pending CSV import rules lifecycle from `App.tsx` into `src/hooks/usePendingImportRules.ts` | Done |
| D-ARC-033 | Architecture | Extract CSV selection data actions (copy/cut/autofill with chunked reads) from `App.tsx` into `src/hooks/useCsvSelectionDataActions.ts` | Done |
| D-ARC-034 | Architecture | Extract Save As + delimiter-apply workflow from `App.tsx` into `src/hooks/useCsvSaveActions.ts` | Done |
| D-ARC-035 | Architecture | Extract session reset + global view release lifecycle from `App.tsx` into `src/hooks/useCsvSessionReset.ts` | Done |
| D-ARC-036 | Architecture | Extract CSV find focus/jump navigation from `App.tsx` into `src/hooks/useCsvFindNavigationFocus.ts` | Done |
| D-ARC-037 | Architecture | Extract text toolbar actions (Save As + byte-offset jump) from `App.tsx` into `src/hooks/useTextToolbarActions.ts` | Done |
| D-ARC-038 | Architecture | Extract text find/replace reset state actions from `App.tsx` into `src/hooks/useTextFindReplaceResetState.ts` | Done |
| D-ARC-039 | Architecture | Extract text find/replace lifecycle effects from `App.tsx` into `src/hooks/useTextFindReplaceLifecycleEffects.ts` | Done |
| D-ARC-040 | Architecture | Extract CSV context menu handlers/actions from `App.tsx` into `src/hooks/useCsvContextMenuActions.ts` | Done |
| D-ARC-041 | Architecture | Extract CSV find cleanup lifecycle effects from `App.tsx` into `src/hooks/useCsvFindLifecycleEffects.ts` | Done |
| D-ARC-042 | Architecture | Extract CSV macro/find-replace trigger + clear-edits handlers from `App.tsx` into `src/hooks/useCsvFileActionHandlers.ts` | Done |
| D-ARC-043 | Architecture | Extract header filter value listing + frozen first-row snapshot/display from `App.tsx` into `src/hooks/useCsvHeaderFilterAndFrozenRow.ts` | Done |
| D-ARC-044 | Architecture | Extract CSV auto-fit calculation/effect from `App.tsx` into `src/hooks/useCsvAutoFit.ts` | Done |
| D-ARC-045 | Architecture | Extract tab path update helper from `App.tsx` into `src/hooks/useTabPathActions.ts` | Done |
| D-ARC-046 | Architecture | Extract CSV column stats inference/model from `App.tsx` into `src/hooks/useCsvColumnStats.ts` | Done |
| D-ARC-047 | Architecture | Extract column-order options + move action from `App.tsx` into `src/hooks/useCsvColumnOrdering.ts` | Done |
| D-ARC-048 | Architecture | Extract active-tab dirty-state sync effect from `App.tsx` into `src/hooks/useActiveTabDirtySync.ts` | Done |
| D-ARC-049 | Architecture | Extract pending initial tab-save trigger effect from `App.tsx` into `src/hooks/usePendingInitialTabSave.ts` | Done |
| D-ARC-050 | Architecture | Extract CSV initial total/window load effect from `App.tsx` into `src/hooks/useCsvInitialWindowLoad.ts` | Done |
| D-ARC-051 | Architecture | Extract global-view patch debounce queue + cleanup lifecycle from `App.tsx` into `src/hooks/useCsvGlobalViewPatchQueue.ts` | Done |
| D-ARC-052 | Architecture | Extract text-find result panel pagination/range/page-info model from `App.tsx` into `src/hooks/useTextFindResultPanelPagination.ts` | Done |
| D-ARC-053 | Architecture | Extract CSV header-editing/context-undo action wiring from `App.tsx` into `src/hooks/useCsvHeaderEditingActions.ts` | Done |
| D-ARC-054 | Architecture | Extract CSV grid derived state (column/row counts + headers + selection row count) from `App.tsx` into `src/hooks/useCsvGridDerivedState.ts` | Done |
| D-ARC-055 | Architecture | Extract text find/replace local state group (query/options/jobs/progress/refs) from `App.tsx` into `src/hooks/useTextFindReplaceState.ts` | Done |
| D-ARC-056 | Architecture | Extract auto-index decision policy callback from `App.tsx` into `src/hooks/useAutoIndexPolicy.ts` | Done |
| D-ARC-057 | Architecture | Extract CSV grid focus lifecycle state from `App.tsx` into `src/hooks/useCsvGridFocusState.ts` | Done |
| D-ARC-058 | Architecture | Extract locale-based translator callback from `App.tsx` into `src/hooks/useLocaleTranslator.ts` | Done |
| D-ARC-059 | Architecture | Extract grid template columns derived model from `App.tsx` into `src/hooks/useGridTemplateColumns.ts` | Done |
| D-ARC-060 | Architecture | Extract CSV layout basics (data column count, layout key, normalized widths) from `App.tsx` into `src/hooks/useCsvLayoutBasics.ts` | Done |
| D-ARC-061 | Architecture | Extract CSV context-menu state/actions/shortcuts controller from `App.tsx` into `src/hooks/useCsvContextMenuController.ts` | Done |
| D-ARC-062 | Architecture | Extract text-mode render shell and status composition into `src/pages/TextEditorPage/*` (with `buildProps.ts`) | Done |
| D-ARC-063 | Architecture | Extract CSV workspace render shell (`CsvEditorPage + CsvModeStatusBar + CsvContextMenu`) into `src/pages/CsvWorkspacePage/*` | Done |
| D-ARC-064 | Architecture | Extract CSV workspace prop assembly into `src/pages/CsvWorkspacePage/buildProps.ts` | Done |
| D-ARC-065 | Architecture | Extract CSV find-state container from `App.tsx` into `src/hooks/useCsvFindState.ts` | Done |
| D-ARC-066 | Architecture | Extract panel visibility state container from `App.tsx` into `src/hooks/useCsvPanelVisibilityState.ts` | Done |
| D-ARC-067 | Architecture | Extract locale initialization state from `App.tsx` into `src/hooks/useLocaleState.ts` | Done |
| D-ARC-068 | Architecture | Extract save/tab/open action orchestration from `App.tsx` into `src/hooks/useTabAndFileActions.ts` | Done |
| D-ARC-069 | Architecture | Extract tab state container from `App.tsx` into `src/hooks/useTabState.ts` | Done |
| D-ARC-070 | Architecture | Extract global-view state/ref container from `App.tsx` into `src/hooks/useGlobalViewState.ts` | Done |
| D-ARC-071 | Architecture | Extract CSV input state container (row/column inputs, paste mode, column search, import options) from `App.tsx` into `src/hooks/useCsvInputState.ts` | Done |
| D-ARC-072 | Architecture | Extract pending workflow refs (initial-save/import) from `App.tsx` into `src/hooks/usePendingWorkflowRefs.ts` | Done |
| D-ARC-073 | Architecture | Reduce `App.tsx` csv-editor prop coupling by grouping state models (`csvInputState/csvSortFilterModel/csvPanelVisibilityState/sortFilterPreferences/localeState/csvFindState/diagnosticsState/fileOpsState`) and spreading into `buildCsvEditorPageProps` | Done |
| D-ARC-074 | Architecture | Reduce `App.tsx` text-editor prop coupling by grouping `useTextFindReplaceState` output (`textFindReplaceState`) and spreading into `buildTextEditorPageProps` | Done |
| D-ARC-075 | Architecture | Extract `useTabAndFileActions` options builder from `App.tsx` into `src/hooks/buildTabAndFileActionOptions.ts` and keep App orchestration call-site minimal | Done |
| D-ARC-076 | Architecture | Extract `useAppMenuIntegration` options builder from `App.tsx` into `src/hooks/buildAppMenuIntegrationOptions.ts` and switch to single options object call | Done |
| D-ARC-077 | Architecture | Extract `useCsvStructureActions` options builder from `App.tsx` into `src/hooks/buildCsvStructureActionsOptions.ts` | Done |
| D-ARC-078 | Architecture | Extract `useCsvContextMenuController` options builder from `App.tsx` into `src/hooks/buildCsvContextMenuControllerOptions.ts` | Done |
| D-ARC-079 | Architecture | Extract `useCsvDataModel` options builder from `App.tsx` into `src/hooks/buildCsvDataModelOptions.ts` | Done |
| D-ARC-080 | Architecture | Extract `useCsvDataLoader` options builder from `App.tsx` into `src/hooks/buildCsvDataLoaderOptions.ts` | Done |
| D-ARC-081 | Architecture | Extract `useCsvSelectionDataActions` options builder from `App.tsx` into `src/hooks/buildCsvSelectionDataActionsOptions.ts` | Done |
| D-ARC-082 | Architecture | Extract `useCsvGridKeyboard` options builder from `App.tsx` into `src/hooks/buildCsvGridKeyboardOptions.ts` | Done |
| D-ARC-083 | Architecture | Extract `useCsvGlobalViewRebuild` options builder from `App.tsx` into `src/hooks/buildCsvGlobalViewRebuildOptions.ts` | Done |
| D-ARC-084 | Architecture | Extract `useTabDataPersistence` options builder from `App.tsx` into `src/hooks/buildTabDataPersistenceOptions.ts` | Done |
| D-ARC-085 | Architecture | Extract `useTextFileFindReplaceJobs` options builder from `App.tsx` into `src/hooks/buildTextFileFindReplaceJobsOptions.ts` | Done |
| D-ARC-086 | Architecture | Extract `useTextFindNavigation` options builder from `App.tsx` into `src/hooks/buildTextFindNavigationOptions.ts` | Done |
| D-ARC-087 | Architecture | Extract `useTextToolbarActions` options builder from `App.tsx` into `src/hooks/buildTextToolbarActionsOptions.ts` | Done |
| D-ARC-088 | Architecture | Extract `useTextReplaceActions` options builder from `App.tsx` into `src/hooks/buildTextReplaceActionsOptions.ts` | Done |
| D-ARC-089 | Architecture | Extract `useCsvSaveActions` options builder from `App.tsx` into `src/hooks/buildCsvSaveActionsOptions.ts` | Done |
| D-ARC-090 | Architecture | Extract `useCsvFileActionHandlers` options builder from `App.tsx` into `src/hooks/buildCsvFileActionHandlersOptions.ts` | Done |
| D-ARC-091 | Architecture | Extract `useCsvFindNavigationFocus` options builder from `App.tsx` into `src/hooks/buildCsvFindNavigationFocusOptions.ts` | Done |
| D-ARC-092 | Architecture | Extract `useCsvFindMatches` options builder from `App.tsx` into `src/hooks/buildCsvFindMatchesOptions.ts` | Done |
| D-ARC-093 | Architecture | Extract `useCsvHeaderEditingActions` options builder from `App.tsx` into `src/hooks/buildCsvHeaderEditingActionsOptions.ts` | Done |
| D-ARC-094 | Architecture | Extract `useTextFindReplaceResetState` options builder from `App.tsx` into `src/hooks/buildTextFindReplaceResetStateOptions.ts` | Done |
| D-ARC-095 | Architecture | Extract `useTextFindReplaceLifecycleEffects` options builder from `App.tsx` into `src/hooks/buildTextFindReplaceLifecycleEffectsOptions.ts` | Done |
| D-ARC-096 | Architecture | Extract `useCsvFindLifecycleEffects` options builder from `App.tsx` into `src/hooks/buildCsvFindLifecycleEffectsOptions.ts` | Done |
| D-ARC-097 | Architecture | Extract `useCsvInitialWindowLoad` options builder from `App.tsx` into `src/hooks/buildCsvInitialWindowLoadOptions.ts` | Done |
| D-ARC-098 | Architecture | Extract `usePendingImportRules` options builder from `App.tsx` into `src/hooks/buildPendingImportRulesOptions.ts` | Done |
| D-ARC-099 | Architecture | Extract `useCsvGridVirtualization` options builder from `App.tsx` into `src/hooks/buildCsvGridVirtualizationOptions.ts` | Done |
| D-ARC-100 | Architecture | Extract `useCsvHeaderFilterAndFrozenRow` options builder from `App.tsx` into `src/hooks/buildCsvHeaderFilterAndFrozenRowOptions.ts` | Done |
| D-ARC-101 | Architecture | Extract layout/basics options builders from `App.tsx` into `src/hooks/buildCsvLayoutBasicsOptions.ts`, `src/hooks/buildGridLayoutOptions.ts`, `src/hooks/buildGridResizeOptions.ts`, and `src/hooks/buildColumnManagementOptions.ts` | Done |
| D-ARC-102 | Architecture | Extract panel/text-model options builders from `App.tsx` into `src/hooks/buildPanelDrawerOptions.ts`, `src/hooks/buildTextFindResultPanelPaginationOptions.ts`, and `src/hooks/buildTextFindResultsModelOptions.ts` | Done |
| D-ARC-103 | Architecture | Extract CSV view state options builders from `App.tsx` into `src/hooks/buildCsvGridFocusStateOptions.ts`, `src/hooks/buildCsvGridDerivedStateOptions.ts`, `src/hooks/buildCsvGlobalViewPatchQueueOptions.ts`, and `src/hooks/buildCsvDraftPersistenceOptions.ts` | Done |
| D-ARC-104 | Architecture | Extract CSV editing action options builders from `App.tsx` into `src/hooks/buildFileOpsOptions.ts`, `src/hooks/buildCsvSessionResetOptions.ts`, `src/hooks/buildTabPathActionsOptions.ts`, `src/hooks/buildGridTemplateColumnsOptions.ts`, and `src/hooks/buildCsvAutoFitOptions.ts` | Done |
| D-ARC-105 | Architecture | Extract shared orchestration options builders from `App.tsx` into `src/hooks/buildActiveTabDirtySyncOptions.ts`, `src/hooks/buildCsvColumnStatsOptions.ts`, `src/hooks/buildCsvColumnOrderingOptions.ts`, `src/hooks/buildAutoIndexPolicyOptions.ts`, `src/hooks/buildLocaleTranslatorOptions.ts`, and `src/hooks/buildPendingInitialTabSaveOptions.ts` | Done |
| D-ARC-106 | Architecture | Complete `App.tsx` hook options decoupling by extracting `useCsvSession`/`useTextSession` option builders to `src/hooks/buildCsvSessionOptions.ts` and `src/hooks/buildTextSessionOptions.ts` (no remaining `useXxx({ ... })` inline options in `App.tsx`) | Done |
| D-ARC-107 | Architecture | Move App-level orchestration/state wiring out of `src/App.tsx` into `src/hooks/useAppViewModel.ts` and keep `App.tsx` as render shell only | Done |
| D-ARC-108 | Architecture | Extract text find/replace/navigation orchestration from `useAppViewModel` into `src/hooks/useTextSearchReplaceActions.ts` to reduce view-model coupling/size | Done |
| D-ARC-109 | Architecture | Extract App page-props composition from `useAppViewModel` into `src/hooks/buildAppViewPageProps.ts` (csv editor/text editor/workspace props assembly) | Done |
| D-ARC-110 | Architecture | Extract CSV action orchestration (save/find/structure/context-menu workflows) from `useAppViewModel` into `src/hooks/useCsvWorkflowActions.ts` | Done |
| D-ARC-111 | Architecture | Extract tab/file command flow + app-menu integration from `useAppViewModel` into `src/hooks/useAppCommandActions.ts` | Done |
| D-ARC-112 | Architecture | Reduce `useAppViewModel` coupling by passing grouped action objects (`textSearchActions`/`csvWorkflowActions`/`appCommandActions`) into `buildAppViewPageProps` and removing large inline action field wiring | Done |
| D-ARC-113 | Architecture | Extract CSV view orchestration block (auto-fit, virtualization, dirty-sync, column stats/order, header filter + frozen row, session reset, selection data actions, grid keyboard, global-view rebuild) from `useAppViewModel` into `src/hooks/useCsvViewOrchestration.ts` | Done |
| D-ARC-114 | Architecture | Extract tab snapshot persistence wiring from `useAppViewModel` into `src/hooks/useAppTabPersistenceBridge.ts` and switch to state-object bridge (`tabState`/`csvSessionState`/`textSessionState`/`gridLayoutState`/`columnManagementState`/`csvDataModelState`/`csvDataLoaderState`) | Done |
| D-ARC-115 | Architecture | Extract app command wiring from `useAppViewModel` into `src/hooks/useAppCommandActionsBridge.ts` (bridge to `useAppCommandActions` with state-object inputs) | Done |
| D-ARC-116 | Architecture | Extract text search/replace action wiring from `useAppViewModel` into `src/hooks/useTextSearchActionsBridge.ts` and switch to grouped state-object inputs (`textSessionState`/`textFindReplaceState`/`textFindResultPanelPagination`/`textFindResultsModelState`) | Done |
| D-ARC-117 | Architecture | Extract CSV workflow action wiring from `useAppViewModel` into `src/hooks/useCsvWorkflowActionsBridge.ts` and switch to grouped state-object inputs (`csvSessionState`/`csvDataModelState`/`csvDataLoaderState`/`csvViewOrchestration`/`tabState`) | Done |













