# 问答与图谱前端设计

## 设计小结

前端采用“React/Vite 开发、FastAPI 单服务演示”的混合方案。桌面端使用查询结果与知识图谱双栏布局，窄屏按查询、结论、证据、图谱顺序排列。视觉结合检修台账的操作效率与规程文档的证据阅读方式，先完成可复现的功能闭环，后续再单独提升视觉细节。

## 1. 目标与范围

本阶段完成课程演示所需的最小前端：

- 输入自然语言问题并提交；
- 展示确定性结论、处理方式和相关实体；
- 展示 PDF 页码、印刷页码和规程原文；
- 展示当前答案相关实体的直接邻域图；
- 明确呈现初始、加载、无答案、未知意图、数据库离线和网络错误状态；
- 在桌面投屏和手机宽度下保持可读、可操作。

本阶段不实现登录、数据编辑、任意 Cypher、复杂筛选、图谱全库浏览、动画背景或与课程验收无关的页面。

界面默认且固定使用简体中文（`zh-CN`）。页面框架、状态、字段名、已知枚举、按钮、提示和可访问名称必须显示中文；用户输入、规程原文、实体名称和后端业务答案保持原文，不由前端翻译。第一版不提供语言切换，也不引入完整国际化运行库。

## 2. 技术方案

| 层次 | 选择 | 说明 |
| --- | --- | --- |
| UI | React + TypeScript | 组件边界清楚，便于后续扩展和测试 |
| 开发工具 | Vite | 提供热更新、类型检查和构建入口 |
| 图谱 | Cytoscape.js | 使用成熟图布局，不手写图算法 |
| 单元测试 | Vitest + React Testing Library | 验证组件状态与交互 |
| 浏览器测试 | Playwright | 验证真实 API、响应式布局、键盘和控制台 |
| 演示部署 | FastAPI `GET /` + `/assets` | 构建产物与 API 同源，只启动一个服务；不把整个静态目录以根路径 catch-all 挂载 |

开发时 Vite 将 `/api` 和 `/health` 代理到 `127.0.0.1:8000`。演示前执行前端构建，输出目录由 FastAPI 挂载。Cytoscape.js 随构建产物本地提供，不依赖演示现场网络。

初始依赖基线为 Vite 8.1.5、React 19.2.7、Cytoscape.js 3.34.0，具体版本固定在 `package.json` 和提交的锁文件中。当前本机 Node 24.11.1 满足 Vite 的 `^20.19.0 || >=22.12.0` 要求。图谱直接通过 Cytoscape.js API 在 React `useEffect` 中创建和销毁，不使用维护停滞的 `react-cytoscapejs` 封装。

FastAPI 使用 `FileResponse` 单独返回 Vite 生成的 `index.html`，并把构建目录中的资源挂载到 `/assets`。第一版没有客户端路由，因此不增加 SPA catch-all；`/docs`、`/health` 和 `/api/*` 始终由 FastAPI 自身路由处理。

## 3. 页面结构与视觉方向

页面采用 A×C 融合方向：

- 使用浅色背景、紧凑间距、清楚边界和稳定状态栏，保留检修台账的操作效率；
- 使用醒目的结论标题、规程原文引用、章节与双页码，保留文档阅读秩序；
- 主色使用低饱和绿色，缺陷和错误使用警示红，标准使用黄色系；
- 不使用渐变、装饰性大卡片、过度圆角、营销式标题或外部图片；
- 卡片圆角不超过 8px，页面区块不嵌套成多层卡片。

桌面布局：

1. 顶部显示项目名称、数据范围和 Neo4j 状态；第一版不展示未经接口提供的实体/关系数量；
2. 查询区横向排列输入框和查询按钮，下方放四类示例问题；
3. 左栏显示结论、处理方式、相关实体和规程证据；
4. 右栏显示图谱、节点详情和重置视图；
5. 左右栏比例约为 55% 和 45%，两栏具有稳定最小高度。

手机布局按查询、结论、证据、图谱顺序纵向排列。文字、按钮、图谱和状态信息不能重叠，图谱使用稳定宽高比。

## 4. 组件边界

| 组件 | 职责 |
| --- | --- |
| `AppShell` | 页面框架、标题、数据范围和系统状态 |
| `SystemStatus` | 调用健康检查并显示连接或离线状态 |
| `QuestionForm` | 问题输入、示例问题、提交、禁用和加载状态 |
| `AnswerPanel` | 结论、`structured/rule/ai` 处理方式和相关实体 |
| `EvidenceList` | 原文证据、PDF 页码和印刷页码 |
| `GraphExplorer` | Cytoscape 实例、布局、节点选择和重置视图 |
| `NodeDetails` | 选中节点的名称、类型、说明和来源 |
| `ApiClient` | API 请求、响应解析和统一错误映射 |

数据请求与展示分离。展示组件不直接调用 `fetch`，Cytoscape 实例只由 `GraphExplorer` 管理并在组件卸载时销毁。

前端依赖的 `QuestionAnswer` 契约需要增加 `focus_entity_id: string | null`。有答案时由后端明确给出最适合作为邻域中心的实体 ID；无答案时为 `null`。该字段必须对应 `entities` 中存在的实体，避免前端根据返回顺序猜测业务含义。

## 5. 数据流

1. 页面启动后请求 `GET /health`；
2. 用户输入问题或选择一个示例问题；
3. 页面请求 `POST /api/natural-questions`；
4. 成功后先展示答案、处理方式、实体和证据；
5. 使用答案中的显式 `focus_entity_id` 请求 `GET /api/graph/{entity_id}`；不依赖 `entities` 列表顺序；
6. 图谱响应转换为 Cytoscape 节点和有向边；
7. 用户选择节点后，在图谱下方显示该节点详情；
8. 新问题提交时清除旧错误和旧图谱选择，但保持布局尺寸稳定。

结构化 `/api/questions` 保留给接口调试，不作为第一版主界面的默认入口。

## 6. 状态与错误

| 状态 | 页面行为 |
| --- | --- |
| 初始 | 显示示例问题，不显示虚构答案或空白图谱框 |
| 加载 | 禁用重复提交，保留稳定布局并显示明确加载状态 |
| 有答案 | 展示结论、实体、证据，再加载邻域图 |
| 无答案 | 显示“未找到证据”，不补写解释，不请求空图 |
| 未知意图 | 显示“暂不支持这类问题”，保留用户输入 |
| 数据库离线 | 顶部显示不可用，禁用查询并提供重新检测 |
| 网络或服务错误 | 显示固定文案和重试入口，不显示堆栈或连接详情 |
| 图谱失败 | 保留答案和证据，只在图谱区域显示独立错误 |

API 错误按 `error.code` 映射为界面文案。任何来自接口的文本都按普通文本渲染，不使用 `dangerouslySetInnerHTML`。

## 7. 图谱交互

- 节点颜色按 `Component`、`Defect`、`Action`、`Standard`、`Procedure` 区分，同时显示对应中文类型标签，不能只依赖颜色；
- 边显示关系方向和关系类型；
- 节点支持鼠标选择和键盘聚焦；
- 图谱画布作为补充可视化，不承担完整的 Tab 键语义导航；图谱下方同步提供实体和关系的语义列表，使用真实按钮支持键盘选择；
- 工具栏提供适应视图和重置选择的图标按钮，并提供可访问名称；
- 使用确定性、有根的 `breadthfirst` 布局，根节点为 `center_id`，保证答辩截图和重复查询的布局稳定；
- 中文节点和关系标签启用可换行策略（等价于 Cytoscape 的 `text-overflow-wrap: anywhere`），长名称不得截断到无法辨认；
- 空图、单节点、5 个节点和 20 个节点使用一致容器尺寸；
- 图谱数据只来自 `/api/graph/{entity_id}`，不在浏览器执行数据库查询。

React Strict Mode 下 `useEffect` 可能执行额外的 setup/cleanup 周期。每次创建 Cytoscape 实例都必须注册对称的事件监听器，并在 cleanup 中调用 `cy.destroy()`，不得保留旧实例或重复监听器。

`structured/rule/ai`、五类实体和五类关系使用集中、带类型的中文映射。未识别枚举、`null`、`undefined`、内部错误码、Zod 校验细节和堆栈不得直接成为可见文本，统一显示对应的中文降级文案。

## 8. 响应式与可访问性

- 验证 320、768、1024 和 1440 像素宽度；
- 页面只有一个 `h1`，各区域使用顺序正确的 `h2`；
- 输入框有可见标签，按钮有明确名称，图标按钮有 `aria-label`；
- 根文档使用 `lang="zh-CN"`，即使浏览器 locale 为其他语言，默认界面仍保持中文；
- 动态答案和错误使用合适的 live region；
- 所有操作可通过键盘完成，焦点顺序与视觉顺序一致；
- 正文对比度达到 WCAG 2.1 AA，不用颜色作为唯一状态提示；
- 长原文、长实体名称和最长错误文案不能溢出容器。

## 9. 测试与验收

单元和组件测试覆盖：

- 健康检查在线与离线；
- 示例问题填入和自然语言提交；
- 加载期间禁止重复提交；
- 有答案、无答案、未知意图和数据库错误；
- 证据原文与双页码；
- 图谱数据转换、节点选择、单节点和空图；
- 组件卸载时释放 Cytoscape 实例。

Playwright 浏览器验收覆盖：

- 四类示例问题的完整操作路径；
- 桌面双栏和手机单栏；
- 数据库断开、接口错误和无答案状态；
- 键盘提交、节点选择和重置视图；
- 控制台无错误和警告，API 请求地址与载荷正确；
- 页面和图谱依赖在断网环境仍可加载。
- 使用 `@axe-core/playwright` 检查桌面和手机关键状态不存在 serious 或 critical 可访问性违规；
- 使用中文可访问名称完成查询、重试、图谱工具栏和节点选择，不依赖英文内部代码。

开发环境允许 Playwright 同时启动 Vite 和 FastAPI 两个 web server，并启用 `reuseExistingServer` 以复用已启动服务；生产/演示验收必须额外验证构建后的单 FastAPI 服务：`GET /` 返回前端、`/assets/*` 可加载，且 `/docs`、`/health` 和 `/api/*` 不被前端静态资源拦截。

构建验收：

- `npm test` 通过；
- `npm run build` 通过；
- Python 全量测试和仓库结构检查通过；
- FastAPI 启动后根路径能返回前端，`/docs` 和 API 路由保持可用；
- `.env`、密钥、`node_modules` 和临时设计文件不进入提交。

## 10. 调研依据

- [Vite Guide](https://vite.dev/guide/)：当前 Vite 工作流、Node 版本要求和构建方式；
- [Vite Backend Integration](https://vite.dev/guide/backend-integration)：后端托管构建产物和资源路径的约定；
- [FastAPI Static Files](https://fastapi.tiangolo.com/tutorial/static-files/) 与 [Starlette StaticFiles](https://www.starlette.io/staticfiles/)：静态资源挂载边界；
- [React `useEffect`](https://react.dev/reference/react/useEffect)：Strict Mode 下 setup/cleanup 对称性；
- [Cytoscape.js](https://js.cytoscape.org/)：`breadthfirst` 布局、文本换行和实例销毁 API；
- [Playwright webServer](https://playwright.dev/docs/test-webserver)：多服务开发测试与复用已启动服务；
- [Cytoscape.js issue #3091](https://github.com/cytoscape/cytoscape.js/issues/3091)：画布 Tab 键可访问性限制，采用同步语义列表补足。

## 11. 后续提升

当前版本先保证信息结构、证据清晰度和交互完整性。视觉提升作为独立后续任务处理，可调整字体、细节间距、图谱样式和答辩投屏效果，但不得改变已固定的 API 契约、状态语义和响应式顺序。
