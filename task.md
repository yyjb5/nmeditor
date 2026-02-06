# Tasks Needed Improvements (deskcsv)

| 类别 | 需求点 | 影响 | 位置/线索 | 建议方向 | 状态 |
|---|---|---|---|---|
| 功能 | 过滤/排序仅作用于已加载窗口行（非全文件） | 结果不完整，用户误判 | `src/App.tsx` 中 `visibleRowIndices` 基于 `rows` | 明确提示“仅已加载行”；或支持全文件排序/过滤（后端或索引） | 已完成（改为全文件排序/筛选 + 外部排序） |
| 功能 | 撤销/重做仅覆盖单元格 patch，未覆盖行列操作/宏/查找替换 | 操作不可撤回，体验断层 | `src/App.tsx`, `src/hooks/useRowColumnOps.ts`, `src/hooks/useFileOps.ts` | 建立统一操作栈/事务式 undo | 已完成（覆盖行列操作 + 宏/查找/粘贴批量撤销） |
| 功能 | 宏与查找替换默认只作用于窗口行 | 用户以为是全文件 | `src/hooks/useFileOps.ts`, `src/components/Panels/*` | UI 明示范围，或弹窗选择范围 | 已完成（增加范围选择与提示） |
| 功能 | 粘贴未解析 CSV 引号/转义 | 复杂字段错位 | `src/hooks/useRowColumnOps.ts` | 引入 CSV 解析或粘贴模式选项 | 已完成（粘贴支持引号/转义/换行） |
| 功能 | 文本模式缺少“保存/覆盖保存”，仅“另存为” | 流程不完整 | `src/App.tsx`, `src/hooks/useTextSession.ts` | 补充保存按钮与逻辑，加入编码选择 | 已完成（保存/另存为 + 编码选择） |
| 功能 | 排序内存上限输入会自动变为上下限 | 难以设置正确值 | `src/components/Panels/*` | 用文本态输入，提交时再解析与校验 | 已完成 |
| 功能 | 排序列需要输入列号而非选择列 | 易用性低 | `src/components/Panels/*` | 下拉/选择列 | 已完成 |
| 功能 | 右键菜单未出现 | 无法使用行/列操作 | `src/App.tsx`, `src/components/GridView/*` | 修复右键菜单事件与渲染 | 已完成 |
| 功能 | 列重命名（双击列头） | 可发现性低 | `src/components/GridView/*` | 内联编辑 | 已完成 |
| 健壮性 | 剪贴板读写无异常处理 | 权限/平台失败时崩溃或无提示 | `src/hooks/useRowColumnOps.ts` | `try/catch` + 错误提示 | 已完成（复制/粘贴均有提示） |
| 健壮性 | Tab 数据保存用 `setTimeout` 有竞态 | 切换/关闭时可能丢状态 | `src/App.tsx` | 用 `useEffect`/状态变更后保存 | 已完成（改为 effect 触发的初始保存） |
| 健壮性 | Patch 全量留内存，缺少草稿恢复 | 大文件编辑风险 | `src/App.tsx` | 自动保存草稿/恢复机制 | 已完成（本地草稿自动保存/恢复） |
| 健壮性 | 过滤/排序/宏在未加载行时不一致 | 用户认为“没生效” | `src/App.tsx` | 提示当前窗口范围或引导加载更多 | 已完成（排序/筛选全文件 + 宏/查找范围可选） |
| UI | 无明确空状态引导 | 首次打开不知从何开始 | `src/App.tsx` | 空状态卡片 + 打开按钮 | 已完成 |
| UI | 无显著 active cell 或编辑栏 | 可发现性弱 | `src/components/GridView/index.tsx` | 增加活动单元格边框/编辑栏 | 已完成（活动单元格高亮 + 信息栏） |
| UI | 选中/已编辑/编辑中视觉层级接近 | 视觉混乱 | `src/components/GridView/styles.css` | 强化 active cell 边框、区分状态色 | 已完成 |
| UI | 工具栏和面板层级拥挤 | 认知负担高 | `src/App.tsx`, `src/App.css` | 收敛常用操作，面板抽屉化 | 已完成（面板侧栏抽屉） |
| UI | 字体与色彩缺乏品牌感 | 视觉平淡 | `src/App.css` | 统一色彩 token + 更有性格字体 | 已完成（色彩 token + 字体栈与背景） |
| 功能 | 粘贴模式设置（自动/严格CSV/按分隔符） | 复杂粘贴场景不稳定 | `src/hooks/useRowColumnOps.ts`, `src/components/Panels/*` | 增加粘贴模式下拉 | 已完成 |
| 功能 | 批量操作进度条（宏/查找/全文件保存） | 操作不透明、无法中断 | `src/App.tsx`, `src/hooks/useFileOps.ts` | 进度指示 + 可取消 | 已完成（状态栏显示进行中） |
| 功能 | 列选择器增强（搜索/重排序/隐藏列） | 列多时难操作 | `src/components/Panels/*`, `src/App.tsx` | 列列表支持搜索/隐藏 | 已完成（搜索/隐藏/列表重排序） |
| 功能 | 批量导入规则（首行列名/跳过前N行） | 导入流程繁琐 | `src/App.tsx` | 打开前配置 | 已完成（打开前配置 + 自动应用） |
| UI | 快捷操作提示面板 | 难以发现快捷键 | `src/components/Panels/*`, `src/App.css` | 侧栏/浮层展示 | 已完成（侧栏快捷键列表） |
| UI | 侧栏可折叠/宽度可拖拽 | 适配不同屏幕 | `src/App.tsx`, `src/App.css` | 折叠按钮 + 拖拽把手 | 已完成 |
| UI | 空状态引导增强（最近文件/示例文件） | 新手上手慢 | `src/App.tsx` | 增加入口按钮 | 部分完成（最近文件） |

