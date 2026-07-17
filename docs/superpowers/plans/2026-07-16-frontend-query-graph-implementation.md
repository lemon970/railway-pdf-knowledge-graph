# 问答与图谱前端实施计划

## 计划小结

本计划落实已确认的 React/Vite + FastAPI 单服务方案，覆盖个人总计划 Task 11 和 Task 12。实施按后端契约、前端基础、问答闭环、图谱闭环、静态托管和浏览器验收依次推进；每个行为变更先写失败测试，再做最小实现，完成一项即验证并提交。Task 13 的评测集依赖成员 E，不在本计划中提前处理。

截至 2026-07-17，Task 11.0 至 Task 12.4 已完成并通过各自的自动化测试、规格复核与质量复核。界面默认语言固定为简体中文；Vite 双服务浏览器验收与 FastAPI 单服务演示验收均已通过。正式 reviewed CSV 同步到 Neo4j 后，`component_association`、`defect_action` 和 `limit_standard` 三类可返回真实答案、证据和图谱；`procedure_steps` 的“更换闸瓦”示例仍缺少 reviewed 工序实体及 `NEXT_STEP` 关系。因此 Checkpoint D2 的四类真实证据验收尚未通过，不能用 fixture 验收替代。

## 架构决定

- `QuestionAnswer` 显式返回 `focus_entity_id`，前端不推断实体顺序。
- 前端位于 `frontend/`，使用 React 19.2.7、Vite 8.1.5、TypeScript、Vitest 和 Cytoscape.js 3.34.0，并提交锁文件。
- 开发环境由 Vite 代理 `/api` 和 `/health`；演示环境由 FastAPI 返回 `index.html` 并挂载 `/assets`。
- Cytoscape.js 直接在 React `useEffect` 中管理，使用以 `center_id` 为根的确定性 `breadthfirst` 布局。
- 图谱画布配合同步实体/关系列表，保证键盘用户不依赖画布内部导航。
- 根文档和所有默认可见界面使用简体中文；内部代码、API 枚举保持英文并通过集中映射显示中文。

## 成熟工具复用原则

每一步优先使用已有成熟能力，不自行实现图布局、图标、接口结构校验、键盘事件模拟或浏览器运行器：

| 需求 | 采用工具 | 不自行实现的部分 |
| --- | --- | --- |
| 应用与构建 | React、Vite、`@vitejs/plugin-react` | 模块打包、热更新和构建管线 |
| API 运行时校验 | Zod | 嵌套响应字段的手写类型判断 |
| 组件交互测试 | Vitest、React Testing Library、`jest-dom`、`@testing-library/user-event` | DOM 查询、可访问断言、键盘和输入事件模拟 |
| 图谱布局与交互 | Cytoscape.js | 节点布局、视口适配、边方向和选择事件 |
| 图标 | `lucide-react` | 手绘 SVG 和字符图标 |
| 代码检查 | ESLint、`eslint-plugin-react-hooks` | React Hooks 生命周期规则和常见静态问题 |
| 浏览器验收 | Playwright、`@axe-core/playwright` | 多视口、控制台、网络、截图和自动可访问性扫描 |
| 后端静态响应 | FastAPI `FileResponse`、Starlette `StaticFiles` | 手写文件读取、MIME 类型和路径解析 |

对于只需少量代码的部分保留平台原生能力：API 请求使用浏览器 `fetch`，页面状态使用 React state，布局使用项目 CSS。当前没有缓存、分页或复杂跨页状态，不引入 Axios、TanStack Query、Redux 或完整 UI 组件库。

中文文案和枚举映射集中定义并保持类型完整。用户输入、实体名称、规程原文和后端答案按原文展示；`null`、`undefined`、内部错误码、校验细节和堆栈不得进入可见界面。当前只有一种语言，不引入 `react-i18next`；只有未来确认运行时语言切换后再增加国际化框架。

## Task 11.0：增加图谱焦点实体契约

**说明：** 为问答响应增加明确的图谱中心实体。查询有结果时使用第一条数据库结果的 `subject_id` 作为焦点；无结果时返回 `null`。该选择表达“用户所问对象”为邻域中心，而不是把答案实体顺序当作业务规则。

**验收条件：**

- [ ] 有答案的 `QuestionAnswer` 必须包含存在于 `entities` 中的 `focus_entity_id`；
- [ ] 无答案响应的 `focus_entity_id` 为 `null`；
- [ ] 结构化与自然语言接口都返回相同焦点语义。

**验证：**

- [ ] 先新增测试并确认因字段缺失而失败；
- [ ] `pytest tests/backend/test_qa.py tests/backend/test_api.py -q` 通过；
- [ ] Python 全量测试通过。

**依赖：** 已完成 Task 9、Task 10。

**预计涉及：** `backend/app/models.py`、`backend/app/services/qa.py`、`tests/backend/test_qa.py`、`tests/backend/test_api.py`。

**规模：** M。

## Task 11.1：建立可测试的 React/Vite 基础

**说明：** 初始化前端依赖、TypeScript、Vite、Vitest 和基础应用入口，固定版本并配置后端代理。第一步只显示页面框架与系统状态，不接问答和图谱。

**验收条件：**

- [ ] `npm ci`、类型检查、测试和构建均有明确脚本；
- [ ] 页面包含唯一 `h1`、数据范围和 Neo4j 连接状态；
- [ ] `/health` 在线、离线和重新检测状态都有组件测试。
- [ ] 根文档使用 `lang="zh-CN"`，页面标题、`h1`、状态和重新检测按钮默认显示中文，不受浏览器 locale 影响。

**验证：**

- [ ] 先写 `SystemStatus` 失败测试，再实现组件；
- [ ] `npm test -- --run`、`npm run lint`、`npm run typecheck`、`npm run build` 通过；
- [ ] `dist/` 与 `node_modules/` 保持忽略。

**依赖：** Task 11.0。

**预计涉及：** `frontend/package.json`、`frontend/package-lock.json`、`frontend/vite.config.ts`、`frontend/src/`、`frontend/tests/`。依赖使用 Vite、React、Zod、Testing Library、`user-event` 和 Lucide 的正式包，不复制第三方源码。

**规模：** M；初始化文件较多，但只形成一个可运行基础。

## Task 11.2：完成问答与证据纵向闭环

**说明：** 从自然语言输入直达真实 API 响应，使用 Zod 校验服务端数据，再展示结论、处理方式、相关实体和双页码证据，并处理加载、无答案、未知意图、数据库错误和网络错误。

**验收条件：**

- [ ] 四个示例问题可填入并提交，加载期间禁止重复请求；
- [ ] 有答案显示结论、实体、证据原文、PDF 页码和印刷页码；
- [ ] 空输入、无答案和三类错误状态使用固定、可重试的界面语义。
- [ ] 标签、占位符、四个示例、提交/加载/重试、处理方式、实体类型、证据字段和全部错误状态默认显示中文。

**验证：**

- [ ] `ApiClient` 和问答组件测试先失败后通过；
- [ ] 测试覆盖成功、无答案、未知意图、数据库不可用和网络失败；
- [ ] `npm test -- --run`、类型检查和构建通过。

**依赖：** Task 11.1。

**预计涉及：** `frontend/src/api.ts`、`frontend/src/App.tsx`、`frontend/src/components/QuestionForm.tsx`、`frontend/src/components/AnswerPanel.tsx`、对应测试。

**规模：** M。

## Checkpoint D1：问答界面

- [ ] 后端全量测试通过；
- [ ] 前端测试、类型检查和构建通过；
- [ ] 页面在没有图谱组件时已能完整回答并显示证据；
- [ ] 提交历史包含后端契约、前端基础和问答闭环三个独立保存点。

## Task 12.1：完成图谱数据转换与展示

**说明：** 根据 `focus_entity_id` 请求邻域接口，将节点和边转换为 Cytoscape 元素，展示有根布局、类型标签、关系方向和独立错误状态。

**验收条件：**

- [ ] 有焦点实体时请求对应邻域，无答案时不请求图谱；
- [ ] 空图、单节点、5 个节点和 20 个节点保持稳定容器尺寸；
- [ ] React Strict Mode 重复 setup/cleanup 后没有残留实例或重复监听器。

**验证：**

- [ ] 数据转换和 `GraphExplorer` 测试先失败后通过；
- [ ] 测试断言有根 `breadthfirst` 配置与 `cy.destroy()` cleanup；
- [ ] `npm test -- --run`、类型检查和构建通过。

**依赖：** Task 11.2。

**预计涉及：** `frontend/src/graph.ts`、`frontend/src/components/GraphExplorer.tsx`、`frontend/src/App.tsx`、对应测试。

**规模：** M。

## Task 12.2：补齐节点详情与键盘替代路径

**说明：** 图谱下方同步展示实体和关系列表。实体使用真实按钮，可通过鼠标或键盘选择并查看名称、类型、说明和来源；画布选择与语义列表共享选中状态。

**验收条件：**

- [ ] 实体类型和关系类型都有文字，不只依赖颜色；
- [ ] Tab、Enter 和 Space 可通过语义列表完成节点选择；
- [ ] 长中文名称、证据和关系标签可以换行且不改变工具栏尺寸。
- [ ] 图谱工具栏 tooltip 与 `aria-label`、实体和关系列表、节点详情、空图及图谱错误状态全部使用中文。

**验证：**

- [ ] 组件测试覆盖画布事件、列表按钮和节点详情同步；
- [ ] 键盘操作测试通过；
- [ ] `npm test -- --run`、类型检查和构建通过。

**依赖：** Task 12.1。

**预计涉及：** `frontend/src/components/GraphExplorer.tsx`、`frontend/src/components/NodeDetails.tsx`、`frontend/src/styles.css`、对应测试。

**规模：** M。

## Task 12.3：接入 FastAPI 单服务演示

**说明：** 让 FastAPI 在前端构建存在时返回根页面和 `/assets`，同时保持纯后端测试环境可启动，不增加 SPA catch-all。

**验收条件：**

- [ ] `GET /` 返回构建后的 `index.html`，资源从 `/assets/*` 加载；
- [ ] `/docs`、`/openapi.json`、`/health` 和 `/api/*` 不被静态托管拦截；
- [ ] 前端未构建时返回明确状态，不影响 API 和测试启动。

**验证：**

- [ ] 先写 FastAPI 静态托管失败测试，再实现路由；
- [ ] 前端构建后执行静态托管测试和 Python 全量测试；
- [ ] 单 FastAPI 服务下用 HTTP 请求验证根页面、资源和 API。

**依赖：** Task 12.2。

**预计涉及：** `backend/app/main.py`、`tests/backend/test_static_frontend.py`、`frontend/vite.config.ts`、运行说明。

**规模：** M。

## Task 12.4：完成 Playwright 响应式验收

**说明：** 使用开发双服务和演示单服务两种模式检查关键用户路径、布局、控制台和网络请求；视觉只落实已批准的检修台账与规程文档融合方向。

**验收条件：**

- [ ] 桌面双栏和手机单栏均无重叠、截断或横向溢出；
- [ ] 查询、证据、图谱、节点详情和错误重试路径可在真实浏览器完成；
- [ ] 控制台无应用错误，断网时本地页面和图谱依赖仍能加载。

**验证：**

- [ ] Playwright 验证 320、768、1024 和 1440 像素宽度；
- [ ] 在浏览器 locale 为 `en-US` 时仍通过中文可访问名称完成查询、重试和节点选择；
- [ ] `@axe-core/playwright` 在桌面和手机关键状态无 serious 或 critical 违规；
- [ ] 保存桌面和手机验收截图到忽略的临时目录，不提交测试噪声；
- [ ] 最终执行前端测试、类型检查、构建、Python 全量测试和仓库检查。

**依赖：** Task 12.3。

**预计涉及：** `frontend/playwright.config.ts`、`frontend/e2e/`、`frontend/src/styles.css`、必要的运行脚本。

**规模：** M。

## Checkpoint D2：可演示系统

- [ ] 四类问题可从页面查询并显示证据；
- [ ] 图谱使用明确焦点、稳定布局和可访问替代列表；
- [ ] 开发双服务与演示单服务都通过验收；
- [ ] 320–1440 像素范围没有内容重叠；
- [ ] 分支已推送，尚未合并 `main`。

## 风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| Cytoscape 在 jsdom 中缺少真实画布 | 中 | 单元测试隔离实例工厂，真实渲染交给 Playwright |
| Strict Mode 产生重复监听器 | 高 | 测试 cleanup，并保持创建和销毁完全对称 |
| FastAPI 根挂载拦截接口 | 高 | 只定义 `GET /` 和 `/assets`，测试 `/docs` 与 API |
| 真实 Neo4j 数据不完整 | 中 | 组件测试使用固定 API 数据；端到端只验证当前已审数据 |
| 前端工作扩大到视觉重做 | 中 | 只实现已批准设计，进一步美化留作独立任务 |

## 当前阻塞边界

Task 11 和 Task 12 不需要其他成员即可完成。完成 Checkpoint D2 后，Task 13 必须等待成员 E 提供或确认评测问题、预期答案和证据页码；到达该点后停止并等待。
