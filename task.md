# Tasks Needed Improvements (deskcsv)

| 类别 | 需求点 | 影响 | 位置/线索 | 建议方向 | 状�?|
|---|---|---|---|---|
| 架构 | 重构 `App.tsx`，进行解耦并按目录化规范拆分组件/页面 | 当前主文件过大、耦合高，维护成本和回归风险高 | `src/App.tsx`, `src/components/*`, `src/pages/*` | 组件与页面均按目录组织：`index.tsx` + `types` + `css/less`，同步迁移状态与事件边界；已完成 TextFindResultsPanel/TextModeWorkspace/CsvEditorPage/TextModeStatusBar/CsvContextMenu/CsvModeStatusBar + textFind/csvContextActions + useMenuEventBridge + useCsvContextMenuShortcuts + useAppMenuIntegration + useDiagnostics + useRecentFiles + useSortFilterPreferences + useCsvDraftPersistence + usePanelDrawer + useTextFindNavigation + useTextFindResultsModel + useTextFileFindReplaceJobs + useTextReplaceActions + useCsvFindMatches + useCsvDataModel + useCsvDataLoader + useTabLifecycle + useTabDataPersistence + useCsvGridVirtualization + useCsvSortFilterModel + useCsvStructureActions + CsvEditorPage buildProps + `src/components/CSVGrid/*` 抽离 | P0（最高）/已完成 |
| 功能 | 过滤/排序仅作用于已加载窗口行（非全文件） | 结果不完整，用户误判 | `src/App.tsx` �?`visibleRowIndices` 基于 `rows` | 明确提示“仅已加载行”；或支持全文件排序/过滤（后端或索引�?| 已完成（改为全文件排�?筛�?+ 外部排序�?|
| 功能 | 撤销/重做仅覆盖单元格 patch，未覆盖行列操作/�?查找替换 | 操作不可撤回，体验断�?| `src/App.tsx`, `src/hooks/useRowColumnOps.ts`, `src/hooks/useFileOps.ts` | 建立统一操作�?事务�?undo | 已完成（覆盖行列操作 + �?查找/粘贴批量撤销�?|
| 功能 | 宏与查找替换默认只作用于窗口�?| 用户以为是全文件 | `src/hooks/useFileOps.ts`, `src/components/Panels/*` | UI 明示范围，或弹窗选择范围 | 已完成（增加范围选择与提示） |
| 功能 | 粘贴未解�?CSV 引号/转义 | 复杂字段错位 | `src/hooks/useRowColumnOps.ts` | 引入 CSV 解析或粘贴模式选项 | 已完成（粘贴支持引号/转义/换行�?|
| 功能 | 文本模式缺少“保�?覆盖保存”，仅“另存为�?| 流程不完�?| `src/App.tsx`, `src/hooks/useTextSession.ts` | 补充保存按钮与逻辑，加入编码选择 | 已完成（保存/另存�?+ 编码选择�?|
| 功能 | 排序内存上限输入会自动变为上下限 | 难以设置正确�?| `src/components/Panels/*` | 用文本态输入，提交时再解析与校�?| 已完�?|
| 功能 | 排序列需要输入列号而非选择�?| 易用性低 | `src/components/Panels/*` | 下拉/选择�?| 已完�?|
| 功能 | 右键菜单未出�?| 无法使用�?列操�?| `src/App.tsx`, `src/components/GridView/*` | 修复右键菜单事件与渲�?| 已完�?|
| 功能 | 列重命名（双击列头） | 可发现性低 | `src/components/GridView/*` | 内联编辑 | 已完�?|
| 健壮�?| 剪贴板读写无异常处理 | 权限/平台失败时崩溃或无提�?| `src/hooks/useRowColumnOps.ts` | `try/catch` + 错误提示 | 已完成（复制/粘贴均有提示�?|
| 健壮�?| Tab 数据保存�?`setTimeout` 有竞�?| 切换/关闭时可能丢状�?| `src/App.tsx` | �?`useEffect`/状态变更后保存 | 已完成（改为 effect 触发的初始保存） |
| 健壮�?| Patch 全量留内存，缺少草稿恢复 | 大文件编辑风�?| `src/App.tsx` | 自动保存草稿/恢复机制 | 已完成（本地草稿自动保存/恢复�?|
| 健壮�?| 过滤/排序/宏在未加载行时不一�?| 用户认为“没生效�?| `src/App.tsx` | 提示当前窗口范围或引导加载更�?| 已完成（排序/筛选全文件 + �?查找范围可选） |
| UI | 无明确空状态引�?| 首次打开不知从何开�?| `src/App.tsx` | 空状态卡�?+ 打开按钮 | 已完�?|
| UI | 无显�?active cell 或编辑栏 | 可发现性弱 | `src/components/GridView/index.tsx` | 增加活动单元格边�?编辑�?| 已完成（活动单元格高�?+ 信息栏） |
| UI | 选中/已编�?编辑中视觉层级接�?| 视觉混乱 | `src/components/GridView/styles.css` | 强化 active cell 边框、区分状态色 | 已完�?|
| UI | 工具栏和面板层级拥挤 | 认知负担�?| `src/App.tsx`, `src/App.css` | 收敛常用操作，面板抽屉化 | 已完成（面板侧栏抽屉�?|
| UI | 字体与色彩缺乏品牌感 | 视觉平淡 | `src/App.css` | 统一色彩 token + 更有性格字体 | 已完成（色彩 token + 字体栈与背景�?|
| 功能 | 粘贴模式设置（自�?严格CSV/按分隔符�?| 复杂粘贴场景不稳�?| `src/hooks/useRowColumnOps.ts`, `src/components/Panels/*` | 增加粘贴模式下拉 | 已完�?|
| 功能 | 批量操作进度条（�?查找/全文件保存） | 操作不透明、无法中�?| `src/App.tsx`, `src/hooks/useFileOps.ts` | 进度指示 + 可取�?| 已完成（状态栏显示进行中） |
| 功能 | 列选择器增强（搜索/重排�?隐藏列） | 列多时难操作 | `src/components/Panels/*`, `src/App.tsx` | 列列表支持搜�?隐藏 | 已完成（搜索/隐藏/列表重排序） |
| 功能 | 批量导入规则（首行列�?跳过前N行） | 导入流程繁琐 | `src/App.tsx` | 打开前配�?| 已完成（打开前配�?+ 自动应用�?|
| UI | 快捷操作提示面板 | 难以发现快捷�?| `src/components/Panels/*`, `src/App.css` | 侧栏/浮层展示 | 已完成（侧栏快捷键列表） |
| UI | 侧栏可折�?宽度可拖�?| 适配不同屏幕 | `src/App.tsx`, `src/App.css` | 折叠按钮 + 拖拽把手 | 已完�?|
| UI | 空状态引导增强（最近文件） | 新手上手�?| `src/App.tsx` | 增加入口按钮 | 已完�?|
| 功能 | 文本模式多光标/多选区编辑 | 高频编辑效率差距明显 | `src/App.tsx`（当前 `textarea`） | 引入编辑内核或自定义 selection model，支持多光标输入/粘贴/删除 | 已完成（支持 Ctrl/Meta+D、Ctrl/Meta+Shift+L、Alt+Shift+I、Alt+Shift+Up/Down、Ctrl/Meta+Shift+D、Esc，并新增编辑区多光标可视化标记） |
| 功能 | 列块选择/矩形编辑（Alt 拖拽） | 与 EmEditor/Notepad++ 列编辑差距大 | `src/components/TextModeWorkspace/*`, `src/utils/multiCursor.ts` | 新增块选区模型与按列批量写入（已支持 Alt+拖拽 + Alt+Shift+方向键/Home/End/Page 扩展 + 块选区高亮 + 多行粘贴按行分发 + 列块复制/剪切 + 与 Go/书签跳转联动） | 已完成 |
| 功能 | 转到行列、书签、书签跳转 | 大文件导航效率不足 | `src/components/TextModeWorkspace/*` | 已支持 Go line:col、Toggle/Prev/Next Bookmark 与 `F2`/`Shift+F2`/`Ctrl/Meta+F2`，书签面板（跳转/移除/清空）、按文件持久化/过滤，以及书签 JSON 导入导出 | 已完成 |
| 功能 | 全文件“查找结果面板”与批量跳转 | 命中可见性不�?| `src/components/Panels/*`, `src/App.tsx` | 独立结果面板（偏�?上下�?双击跳转�?| 已完成（已支持命中面板首末/序号跳转+分块命中标记+上下文预览分组展示+命中高亮+上下文长度可调+分组折叠与分批加载+当前分段置顶+折叠状态持久化+结果分页懒加载+滚动到底自动加载分组命中） |
| 功能 | 正则替换高级选项（仅选区、逐条确认、保留大小写�?| 复杂替换风险�?| `src/App.tsx`, `src-tauri/src/lib.rs` | 扩展替换参数与预览确认流�?| 已完成（选区替换 + Replace next + 保留大小写 + 逐条确认预览/确认） |
| 功能 | 文本编码体系扩展（GBK/Shift-JIS 等） | 非 UTF 文本打开与保存兼容性不足 | `src/hooks/useTextSession.ts`, `src-tauri/src/lib.rs` | 引入编码库并统一前后端编码管线 | 已完成 |
| 功能 | EOL/空白字符可视化与转换（CRLF/LF） | 文本清洗体验不足 | `src/components/TextModeWorkspace/index.tsx`, `src/components/TextModeStatusBar/index.tsx`, `src/utils/textEol.ts` | 状态栏显示 + CRLF/LF 转换 + 行尾空白清理 + 可视化预览 | 已完成 |
| 功能 | 语法高亮/代码折叠/括号匹配 | 代码编辑能力显著落后 | `src/components/TextModeWorkspace/index.tsx`, `src/components/CodeMirrorPreview/*` | 已完成：原生/轻量双语法引擎、代码折叠、括号匹配与跳转、编辑态同步 | 已完成 |
| 功能 | Minimap/文档地图与结构导航 | 超长文本定位弱 | `src/components/TextModeWorkspace/index.tsx`, `src/components/TextModeWorkspace/styles.css`, `src/utils/textMinimap.ts` | 增加右侧文档地图、可见区域与光标标记、结构列表过滤与快速跳转 | 已完成 |
| 功能 | 文件对比/合并（Diff/Merge） | 与专业编辑器差距明显 | `src/components/TextModeWorkspace/index.tsx`, `src/utils/textDiff.ts`, `src/App.css` | 增加对比文件选择、差异块预览、按块合并与整份采用右侧 | 已完成 |
| 功能 | 十六进制查看/编辑模式 | 二进制排障能力缺失 | `src/components/TextModeWorkspace/index.tsx`, `src/utils/textHex.ts`, `src/App.css` | 支持偏移跳转、字节暂存编辑、按区段写回、ASCII 对照 | 已完成 |
| 功能 | 插件/脚本扩展机制 | 缺少 Notepad++ 生态能力 | `src/components/TextModeWorkspace/index.tsx`, `src/utils/textExtensionRuntime.ts` | 提供命令注册、脚本加载、权限沙箱执行与卸载 | 已完成 |
| 健壮性 | 全文件替换事务与崩溃恢复 | 中断时存在数据风险 | `src-tauri/src/lib.rs` 替换任务 | 已完成：replace journal + 启动自动恢复 + 手动恢复命令 `recover_replace_journals` | 已完成 |
| UI | 文本模式命令面板（Command Palette） | 操作入口分散 | `src/components/TextModeWorkspace/index.tsx`, `src/App.css` | 提供可搜索命令列表、快捷键提示与 `Ctrl/Meta+Shift+P` 快速入口 | 已完成 |
| 功能 | Markdown 渲染预览（MD） | 仅源码编辑，预览效率不足 | `src/components/TextModeWorkspace/index.tsx`, `src/utils/markdownPreview.ts`, `src/App.css` | 已完成：实时渲染代码块/表格/任务列表与按块/行回跳源码联动 | 已完成 |
| 功能 | CSV 网格键盘导航与编辑快捷键不完整（Tab/方向�?回车/Delete/Ctrl+C/V/X�?| �?Excel 手感差距大，重度编辑效率�?| `src/components/GridView/index.tsx`, `src/App.tsx`, `src-tauri/src/lib.rs` 菜单 | 建立统一 keymap（不依赖菜单），支持移动、进入编辑、批量删除、复制粘�?| 已完成（基础 keymap + 文件级复�?剪切 + 大文件跨窗口一致性） |
| 功能 | CSV 筛选交互偏“面板驱动”，缺少列头下拉筛�?| 不能�?Excel 直接在表头筛�?| `src/components/GridView/*`, `src/components/Panels/*` | 增加列头筛选入口（值列�?搜索/清空/多选）并保持全文件执行 | 已完成（列头支持 contains/值列表搜�?多选，按全文件或全局视图执行�?|
| 功能 | CSV 自动填充（fill handle�?拖拽复制 | 连续填值效率低，不�?Excel | `src/components/GridView/index.tsx`, `src/hooks/useRowColumnOps.ts` | 增加填充柄与规则（复�?序列），仅生�?patch 不全量重�?| 已完成（支持填充�?+ 复制/数字序列/日期序列；支持跨窗口与上/�?�?右扩展） |
| 功能 | CSV 冻结窗格（首�?首列）未实现 | 大表定位与对照体验弱 | `src/components/GridView/*`, `src/App.tsx` | 支持冻结首行/首列与滚动同步，保持虚拟滚动 | 已完成（Quickbar 开�?+ 网格首行/首列冻结�?|
| 功能 | CSV 筛选列输入仍为列号（而非统一列选择器） | 易错、学习成本高 | `src/components/Panels/index.tsx` | 筛选列改为与排序一致的下拉列选择 | 已完成（改为下拉选择并在规则中显示列名） |
| UI | CSV 编辑焦点与快捷键提示不一�?| 面板提示�?Ctrl+C/V，但网格焦点下行为不稳定 | `src/components/Panels/index.tsx`, `src/components/GridView/*` | 统一提示与真实行为，状态栏展示当前输入模式/焦点 | 已完成（状态栏新增 CSV 导航/编辑/未聚�?模式提示�?|

## 待完成项优先级拆分（P0 / P1 / P2）
- 暂无（上述 Markdown 待完成项已完成）

- Update: Markdown task batch completed: `T-MD-009` (single-panel style polish for heading/code/table/blockquote/task-list), `T-MD-010` (renderer upgraded to `remark-gfm + rehype-sanitize + rehype-stringify` + tests), `T-MD-011` (hybrid editing evaluation landed with one-panel realtime overlay + source mode; doc: `docs/markdown-hybrid-editing.md`).


- Update: text full-file find now supports backend chunk consumption (consume_from/consume_limit) and frontend incremental polling.


- Update: CSV file/global-view find now uses chunk consumption + incremental polling to avoid one-shot large result payloads.


- Update: text find results now support byte-offset jump (nearest-hit binary search) for fast navigation in large hit sets.


- Update: CSV find result panel now supports incremental rendering (scroll auto-load + manual Load more + active-hit auto-reveal), avoiding fixed first-N clipping.



- Update: CSV find results now support panel pagination and hit-index jump (first/prev/next/last + Go #).


- Update: Text find context cache now uses pruning (keep visible groups + active-neighbor, cap at 2048 entries) to reduce peak memory on huge hit sets.

- Update: App decoupling continues: extracted global-view rebuild lifecycle to `src/hooks/useCsvGlobalViewRebuild.ts`, CSV keyboard shortcut handling to `src/hooks/useCsvGridKeyboard.ts`, and pending import-rule auto-apply logic to `src/hooks/usePendingImportRules.ts`.

- Update: App decoupling continues: extracted CSV selection data actions (copy/cut/autofill with chunked reads) to `src/hooks/useCsvSelectionDataActions.ts`.

- Update: App decoupling continues: extracted Save As + delimiter-apply workflow to `src/hooks/useCsvSaveActions.ts`.

- Update: App decoupling continues: extracted session reset/global-view release lifecycle to `src/hooks/useCsvSessionReset.ts`.

- Update: App decoupling continues: extracted CSV find focus/jump navigation to `src/hooks/useCsvFindNavigationFocus.ts`.

- Update: App decoupling continues: extracted text toolbar actions (Save As + byte-offset jump) to `src/hooks/useTextToolbarActions.ts`.

- Update: App decoupling continues: extracted text find/replace reset + lifecycle effects to `src/hooks/useTextFindReplaceResetState.ts` and `src/hooks/useTextFindReplaceLifecycleEffects.ts`; extracted CSV context menu actions to `src/hooks/useCsvContextMenuActions.ts`.

- Update: App decoupling continues: extracted CSV find cleanup lifecycle effects to `src/hooks/useCsvFindLifecycleEffects.ts`.

- Update: App decoupling continues: extracted macro/find-replace trigger handlers + clear-edits orchestration to `src/hooks/useCsvFileActionHandlers.ts`.

- Update: App decoupling continues: extracted header-filter value listing and frozen first-row snapshot/display to `src/hooks/useCsvHeaderFilterAndFrozenRow.ts`.

- Update: App decoupling continues: extracted CSV auto-fit to `src/hooks/useCsvAutoFit.ts`, tab path update helper to `src/hooks/useTabPathActions.ts`, and column stats model to `src/hooks/useCsvColumnStats.ts`.

- Update: App decoupling continues: extracted column-order options + move action to `src/hooks/useCsvColumnOrdering.ts`.

- Update: App decoupling continues: extracted active-tab dirty sync to `src/hooks/useActiveTabDirtySync.ts`, pending initial tab-save trigger to `src/hooks/usePendingInitialTabSave.ts`, CSV initial total/window load effect to `src/hooks/useCsvInitialWindowLoad.ts`, and global-view patch debounce queue/lifecycle to `src/hooks/useCsvGlobalViewPatchQueue.ts`.

- Update: App decoupling continues: extracted text-find result panel pagination model to `src/hooks/useTextFindResultPanelPagination.ts`, and extracted CSV header-editing/context-undo action wiring to `src/hooks/useCsvHeaderEditingActions.ts`.

- Update: App decoupling continues: extracted CSV grid derived state (display columns, selection columns, grid headers, selection row count) to `src/hooks/useCsvGridDerivedState.ts`.

- Update: App decoupling continues: extracted text find/replace local state group (query/options/jobs/progress/refs) to `src/hooks/useTextFindReplaceState.ts`.

- Update: App decoupling continues: extracted auto-index decision policy callback to `src/hooks/useAutoIndexPolicy.ts` (mode `all/large_only`).

- Update: App decoupling continues: extracted CSV grid focus lifecycle state to `src/hooks/useCsvGridFocusState.ts`, locale translator callback to `src/hooks/useLocaleTranslator.ts`, and grid template columns model to `src/hooks/useGridTemplateColumns.ts`.

- Update: App decoupling continues: extracted CSV layout basics (data column count, layout storage key, normalized widths callback) to `src/hooks/useCsvLayoutBasics.ts`.

- Update: App decoupling continues: extracted CSV context-menu controller (state + actions + shortcuts binding) to `src/hooks/useCsvContextMenuController.ts`.

- Update: App decoupling continues: extracted text render shell into `src/pages/TextEditorPage/*` (with `buildProps.ts`) and CSV render shell into `src/pages/CsvWorkspacePage/*`.

- Update: App decoupling continues: extracted CSV workspace prop assembly to `src/pages/CsvWorkspacePage/buildProps.ts`.

- Update: App decoupling continues: extracted CSV find-state container to `src/hooks/useCsvFindState.ts`, panel visibility state to `src/hooks/useCsvPanelVisibilityState.ts`, and locale init state to `src/hooks/useLocaleState.ts`.

- Update: App decoupling continues: extracted save/tab/open flow orchestration to `src/hooks/useTabAndFileActions.ts`; extracted tab state container to `src/hooks/useTabState.ts` and global-view state/refs container to `src/hooks/useGlobalViewState.ts`.

- Update: App decoupling continues: extracted CSV input state container (`row/column` inputs, paste mode, column search, import options) to `src/hooks/useCsvInputState.ts`.

- Update: App decoupling continues: extracted pending workflow refs (initial-save/import) to `src/hooks/usePendingWorkflowRefs.ts`.

- Update: App decoupling continues: reduced `App.tsx` CSV editor prop coupling by introducing grouped state models (`csvInputState` / `csvSortFilterModel` / `csvPanelVisibilityState` / `sortFilterPreferences` / `localeState` / `csvFindState` / `diagnosticsState` / `fileOpsState`) and composing `buildCsvEditorPageProps` with spread-based aggregation.

- Update: App decoupling continues: reduced `App.tsx` text editor prop coupling by introducing `textFindReplaceState` grouped model and composing `buildTextEditorPageProps` with spread-based aggregation.

- Update: App decoupling continues: extracted tab/file action option composition to `src/hooks/buildTabAndFileActionOptions.ts`, and switched `App.tsx` to a single builder + `useTabAndFileActions(...)` call.

- Update: App decoupling continues: extracted app-menu integration option composition to `src/hooks/buildAppMenuIntegrationOptions.ts`, and switched `App.tsx` to a single `useAppMenuIntegration(...)` options-object call.

- Update: App decoupling continues: extracted CSV structure/context-menu options composition to `src/hooks/buildCsvStructureActionsOptions.ts` and `src/hooks/buildCsvContextMenuControllerOptions.ts`, reducing inline hook call argument wiring in `App.tsx`.

- Update: App decoupling continues: extracted CSV data-model/data-loader options composition to `src/hooks/buildCsvDataModelOptions.ts` and `src/hooks/buildCsvDataLoaderOptions.ts`, reducing inline object wiring for core data hooks in `App.tsx`.

- Update: App decoupling continues: extracted CSV selection-actions/keyboard options composition to `src/hooks/buildCsvSelectionDataActionsOptions.ts` and `src/hooks/buildCsvGridKeyboardOptions.ts`, reducing inline key input/data action wiring in `App.tsx`.

- Update: App decoupling continues: extracted global-view rebuild/tab-persistence options composition to `src/hooks/buildCsvGlobalViewRebuildOptions.ts` and `src/hooks/buildTabDataPersistenceOptions.ts`, reducing large inline state/IO wiring blocks in `App.tsx`.

- Update: App decoupling continues: extracted text file find-replace job and text-find navigation options composition to `src/hooks/buildTextFileFindReplaceJobsOptions.ts` and `src/hooks/buildTextFindNavigationOptions.ts`, reducing inline text workflow wiring in `App.tsx`.

- Update: App decoupling continues: extracted text-toolbar/text-replace/CSV-save options composition to `src/hooks/buildTextToolbarActionsOptions.ts`, `src/hooks/buildTextReplaceActionsOptions.ts`, and `src/hooks/buildCsvSaveActionsOptions.ts`, reducing inline action wiring in `App.tsx`.

- Update: App decoupling continues: extracted CSV file-action/find-focus/find-job options composition to `src/hooks/buildCsvFileActionHandlersOptions.ts`, `src/hooks/buildCsvFindNavigationFocusOptions.ts`, and `src/hooks/buildCsvFindMatchesOptions.ts`, reducing inline find/macro wiring in `App.tsx`.

- Update: App decoupling continues: extracted CSV header-editing + CSV/text find lifecycle/reset options composition to `src/hooks/buildCsvHeaderEditingActionsOptions.ts`, `src/hooks/buildCsvFindLifecycleEffectsOptions.ts`, `src/hooks/buildTextFindReplaceResetStateOptions.ts`, and `src/hooks/buildTextFindReplaceLifecycleEffectsOptions.ts`.

- Update: App decoupling continues: extracted CSV initial-load/pending-import/grid-virtualization/header-filter-frozen-row options composition to `src/hooks/buildCsvInitialWindowLoadOptions.ts`, `src/hooks/buildPendingImportRulesOptions.ts`, `src/hooks/buildCsvGridVirtualizationOptions.ts`, and `src/hooks/buildCsvHeaderFilterAndFrozenRowOptions.ts`.


- Update: CSV find result list now uses virtualized rendering (windowed rows + top/bottom spacer) to reduce DOM and improve scroll smoothness.


- Update: Text find result panel now uses group-level lazy rendering (batch + scroll auto-load), and context fetches are limited to rendered groups.


- Update: Text find result panel now adds per-group hit lazy rendering (batch hits in group + load-more per group), reducing heavy group DOM spikes.


- Update: Text mode now supports selection-only replace (Replace in selection), as the first step for advanced replace options.

- Update: Text mode now supports Replace next from caret (with wrap-around in current chunk).

- Update: App decoupling continues: extracted a new batch of hook option builders (`buildCsvLayoutBasicsOptions`, `buildGridLayoutOptions`, `buildGridResizeOptions`, `buildColumnManagementOptions`, `buildPanelDrawerOptions`, `buildTextFindResultPanelPaginationOptions`, `buildTextFindResultsModelOptions`, `buildCsvGridFocusStateOptions`, `buildCsvGridDerivedStateOptions`, `buildCsvGlobalViewPatchQueueOptions`, `buildCsvDraftPersistenceOptions`, `buildFileOpsOptions`, `buildCsvSessionResetOptions`, `buildTabPathActionsOptions`, `buildGridTemplateColumnsOptions`, `buildCsvAutoFitOptions`, `buildActiveTabDirtySyncOptions`, `buildCsvColumnStatsOptions`, `buildCsvColumnOrderingOptions`, `buildAutoIndexPolicyOptions`, `buildLocaleTranslatorOptions`, `buildPendingInitialTabSaveOptions`) and rewired `App.tsx`; only `useCsvSession/useTextSession` remain as tiny direct options calls.

- Update: App decoupling continues: extracted `buildCsvSessionOptions` and `buildTextSessionOptions`, so `App.tsx` no longer has inline `useXxx({ ... })` options calls.

- Update: App decoupling enters next stage: moved App-level orchestration/state wiring to `src/hooks/useAppViewModel.ts`; `src/App.tsx` is now a thin render shell that only switches `TextEditorPage`/`CsvWorkspacePage`.

- Update: App decoupling continues: extracted text search/replace/navigation orchestration from `useAppViewModel` into `src/hooks/useTextSearchReplaceActions.ts` (covering toolbar save/jump, text find/replace jobs, replace actions, find navigation, and lifecycle effects).

- Update: App decoupling continues: extracted page props composition from `useAppViewModel` to `src/hooks/buildAppViewPageProps.ts` (centralized `csvEditorPageProps` / `textEditorPageProps` / `csvWorkspacePageProps` assembly).

- Update: App decoupling continues: `useAppViewModel` now passes grouped action objects (`textSearchActions` / `csvWorkflowActions` / `appCommandActions`) into `buildAppViewPageProps`, removing a large block of repetitive action-level wiring.

- Update: App decoupling continues: extracted CSV view orchestration from `useAppViewModel` into `src/hooks/useCsvViewOrchestration.ts` (auto-fit, virtualization, dirty-sync, column stats/order, header-filter/frozen-row, session reset, selection data actions, grid keyboard, global-view rebuild).

- Update: App decoupling continues: extracted tab snapshot persistence wiring from `useAppViewModel` into `src/hooks/useAppTabPersistenceBridge.ts`, and switched `useAppViewModel` to state-object bridge inputs (`tabState` / `csvSessionState` / `textSessionState` / `gridLayoutState` / `columnManagementState` / `csvDataModelState` / `csvDataLoaderState`).

- Update: App decoupling continues: extracted app-command wiring into `src/hooks/useAppCommandActionsBridge.ts` and switched `useAppViewModel` to bridge-based state-object inputs (`tabState` / `csvSessionState` / `textSessionState` / `csvDataModelState` / `csvDataLoaderState` / `fileOpsState` / `csvWorkflowActions`).

- Update: App decoupling continues: extracted text search/replace action wiring into `src/hooks/useTextSearchActionsBridge.ts` and switched `useAppViewModel` to grouped state-object inputs (`textSessionState` / `textFindReplaceState` / `textFindResultPanelPagination` / `textFindResultsModelState`).

- Update: App decoupling continues: extracted CSV workflow action wiring into `src/hooks/useCsvWorkflowActionsBridge.ts` and switched `useAppViewModel` to grouped state-object inputs (`csvSessionState` / `csvDataModelState` / `csvDataLoaderState` / `csvViewOrchestration` / `tabState`).

- Update: App decoupling continues: extracted CSV workflow orchestration from `useAppViewModel` to `src/hooks/useCsvWorkflowActions.ts` (covers Save/Apply Delimiter, pending initial tab save, macro/find-replace handlers, CSV find focus+job+lifecycle, row/column structure actions, and context-menu actions).

- Update: App decoupling continues: extracted tab/file command orchestration and app-menu integration from `useAppViewModel` into `src/hooks/useAppCommandActions.ts`.

- Update: Text replace now supports a user-facing "Preserve case" toggle in text mode, wired through state/page props, and full-file literal replace now supports preserve-case in backend streaming replacement.

- Update: Text replace now supports confirm-each workflow in chunk mode ("Preview next" + "Confirm replace"), and file-level replace is guarded when confirm-each is enabled.

- Update: Text find result panel now auto-loads per-group hits on bottom scroll when page/group ranges are fully loaded, completing deep lazy-load behavior.

- Update: Text mode multi-cursor first stage delivered (`Ctrl/Meta + D` add-next-selection, synchronized typing/backspace/delete/paste, Esc clear).

- Update: Text mode multi-cursor second-stage baseline delivered (visual status strip + `Ctrl/Meta+Shift+D` undo cursor + `Alt+Shift+I` add line-end cursors).

- Update: Text mode multi-cursor now supports `Ctrl/Meta+Shift+L` to add cursors for all matches of current selection.

- Update: Text mode now supports bracket pair matching (near-caret detect for `()[]{}` + overlay highlights + bracket status hint), as stage 1 of `T-TXT-005`.

- Update: Text mode now supports lightweight syntax highlight preview (toggle button + path-based language detect for JS/TS/JSON/Python/Rust/SQL + memory-safe truncation), as stage 2 of `T-TXT-005`.

- Update: Text mode now supports brace-based code folding in syntax preview (`{}` fold/unfold per block + collapse/expand all), as stage 3 of `T-TXT-005`.

- Update: Text mode now supports optional inline syntax overlay in editor area (toggle on/off + memory guard threshold), as stage 4 of `T-TXT-005`.

- Update: Text mode now supports bracket-jump shortcut (`Ctrl/Meta+Shift+\`) and syntax-preview caret-line sync (active line highlight + line-number click-to-jump), as stage 5 of `T-TXT-005`.

- Update: Text mode now supports a native CodeMirror syntax preview engine (read-only, fold gutter, bracket matching) with runtime engine toggle and lazy-loaded chunk, as stage 6 of `T-TXT-005`.

- Update: Text mode native CodeMirror preview now keeps caret context parity: active-line sync highlight and line-click jump back into textarea, as stage 7 of `T-TXT-005`.

- Update: Text mode CodeMirror native preview now supports an optional editable mode (runtime toggle, live content sync, read-only while replace job runs, and truncation guard to prevent partial-edit data loss), as stage 8 of `T-TXT-005`.

- Update: Text mode CodeMirror native editable preview now syncs selection/caret state back to text-editor selection model (toolbar/bookmark/jump actions keep caret parity) and supports native multi-select shortcuts `Mod+D` / `Mod+Shift+L`, as stage 9 of `T-TXT-005`.

- Update: Text mode CodeMirror native editable preview now extends multi-cursor shortcut parity with `Mod+Shift+D`, `Alt+Shift+Up/Down`, `Alt+Shift+I`, and `Escape`, as stage 10 of `T-TXT-005`.

- Update: Text mode CodeMirror native editable preview now mirrors native multi-selection ranges back into text-mode multi-cursor state (status strip/cursor count parity), as stage 11 of `T-TXT-005`.

- Update: Text mode CodeMirror native editable preview now restores bookmark/bracket-jump shortcut parity (`F2`, `Shift+F2`, `Mod+F2`, `Mod+Shift+\`) via native keydown bridge, as stage 12 of `T-TXT-005`.

- Update: Text mode native editable mode now turns the textarea into a read-only shadow layer (no pointer/focus editing) to avoid dual-editor conflicts while preserving selection sync, as stage 13 of `T-TXT-005`.

- Update: Text mode CodeMirror native editable preview now enables rectangular selection (`Alt+Drag`) and crosshair cursor hint, with multi-range selection synced back to text-mode multi-cursor state, as stage 14 of `T-TXT-005`.

- Update: Text mode native edit toggle now auto-focuses CodeMirror editor (selection context preserved), reducing extra click on edit-mode entry, as stage 15 of `T-TXT-005`.

- Update: Text mode native-mode navigation actions (go line/col, bookmark jump, bracket jump) now re-focus CodeMirror after selection moves, keeping uninterrupted keyboard editing flow, as stage 16 of `T-TXT-005`.

- Update: Text mode native editable path now promotes CodeMirror to the main editing surface (single active editor instance); syntax preview no longer duplicates editable native instance, and textarea remains as hidden compatibility fallback, as stage 17 of `T-TXT-005`.

- Update: Text mode native editable path now supports block-selection expansion parity via `Alt+Shift+Arrow/Home/End/Page` (wired into existing block selection model), as stage 18 of `T-TXT-005`.

- Update: Text mode native rectangular selection now syncs block-selection anchor state, enabling continued `Alt+Shift+Up/Down` block-style expansion after `Alt+Drag`, as stage 19 of `T-TXT-005`.

- Update: Text encoding expansion now supports UTF-8/UTF-16LE/GBK/SHIFT-JIS end-to-end (open/decode, save/encode, and file find/replace pipeline).

- Update: Text mode now supports EOL/whitespace toolkit (status EOL telemetry, CRLF/LF conversion, trailing-whitespace trim, and visible-whitespace preview).

- Update: Text mode now supports a built-in diff/merge panel (select compare file, line-diff blocks, take-right-block merge, and take-all-right workflow).

- Update: Text mode now includes a built-in hex view/edit panel (offset jump, byte staging edit, contiguous byte-range apply, and ASCII mirror).

- Update: Text mode now supports a right-side minimap/doc-map panel (visible-window marker, caret marker, ratio jump, and structure outline quick jump/filter).

- Update: Text mode now supports extension/script runtime basics (command registry, script load/unload, permission-gated sandbox context, and command run entry in toolbar).

- Update: Text mode now supports a command palette (`Ctrl/Meta+Shift+P`) with searchable command list, shortcut hints, and direct execution for built-in and extension commands.

