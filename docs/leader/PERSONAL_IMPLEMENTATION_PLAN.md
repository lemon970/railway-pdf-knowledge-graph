# 组长个人实现计划

## 计划小结

本计划覆盖组长承担的技术主线：项目规则、数据管道、Neo4j、受控问答后端、最小前端、评测、集成和合并。实现顺序以可验证闭环为准，先用 5 个实体和 5 条关系证明路线可行，再扩大数据和功能。每项任务应在一个集中工作时段内完成，验收不通过时不得进入下一检查点。

## 1. 工作位置与分支

```text
稳定工作区：D:\desktop\stu\铁信实习\railway-pdf-knowledge-graph
稳定分支：main

个人工作区：D:\desktop\stu\铁信实习\railway-pdf-knowledge-graph-leader
个人分支：feature/leader-implementation
```

所有个人实现只在 `railway-pdf-knowledge-graph-leader` 中进行。`main` 工作区仅用于查看团队稳定版本和最终合并结果。

## 2. 成果边界

### 本节小结

组长负责把成员数据接入一个能重复运行、能回答问题、能显示证据的系统。成员负责的 OCR 和知识录入不能直接替代组长的数据验收，组长也不包办全部数据录入。

### 组长直接负责

- Schema、CSV 接口和数据质量规则；
- Neo4j 安装说明、约束、清空、导入和查询脚本；
- 四类问题的受控查询逻辑；
- 后端 API、异常处理和证据返回；
- 最小前端、图谱展示和演示流程；
- 自动化检查、评测结果和最终 Pull Request；
- 每周任务拆分、接口变更通知和成员交付验收。

### 从成员接收

- B：OCR 文本、PDF 页码、印刷页码和人工复核记录；
- C：车轮部分实体和关系 CSV；
- D：车轴、轮对组装和轴箱轴承实体关系 CSV；
- E：自然语言问题、预期答案、界面反馈和报告材料。

### 不进入 Git 的内容

- 原始 PDF、课程 DOCX 和页面临时图片；
- `.env`、API Key、Neo4j 密码；
- Neo4j 本地数据库和日志；
- Python 虚拟环境、Node 依赖和构建产物；
- 未准备给团队查看的个人笔记。

## 3. 暂定技术方案

### 本节小结

默认选择学习成本较低、资料充足且适合课程演示的组合。问答先采用“意图分类 + Cypher 模板”，不让模型直接执行任意 Cypher；这样四类课程问题可测试，也能避免错误查询修改数据库。

| 层次 | 默认选择 | 采用理由 | 决策时点 |
| --- | --- | --- | --- |
| 语言 | Python 3.11+ | 数据处理、Neo4j和AI工具生态统一 | Task 1 |
| 图数据库 | Neo4j 5 Desktop | 本机未检测到 Docker，桌面版便于零基础演示 | Task 2 |
| 数据处理 | Python 标准库 + `pandas` | CSV 校验和转换直观 | Task 3 |
| OCR | PaddleOCR CPU 为首选 | 中文扫描文档识别通常优于通用英文OCR | Task 5 |
| 后端 | FastAPI + Pydantic | 接口定义清楚，自带 OpenAPI 调试页 | Task 9 |
| Neo4j访问 | 官方 `neo4j` Python Driver | 参数化查询、事务和错误处理明确 | Task 4 |
| 问答策略 | 规则意图分类 + 参数化Cypher模板 | 可控、可测试、适合四类固定问题 | Task 8 |
| AI辅助 | 可选兼容接口，默认不开启 | 不让外部API成为演示必需条件 | Task 10 |
| 前端 | 原生 HTML/CSS/JavaScript + Cytoscape.js | 不增加前端框架学习负担 | Task 11 |
| 测试 | pytest + FastAPI TestClient | 覆盖数据、查询和接口 | Task 3 起 |

最终技术决定记录在 `docs/leader/decision-log.md`。若验证失败，先记录失败证据，再替换单个组件，不同时更换多层技术。

## 4. 依赖关系

```text
环境基线
  -> 最小样例数据
  -> Neo4j约束和导入
  -> CSV自动校验
  -> OCR交付规范
  -> 课程规模数据
  -> 四类受控查询
  -> 后端问答API
  -> 可选AI辅助
  -> 前端问答与图谱
  -> 评测和演示
  -> PR复核与合并
```

Task 1 至 Task 4 必须顺序执行。Task 5 的 OCR 规范完成后，成员可以并行整理数据；组长继续开发查询原型。后端接口固定后，前端和评测准备可以并行。

## 5. 阶段一：环境和最小数据闭环

### 本节小结

本阶段先证明 Neo4j 能在本机运行，CSV 能被程序读取，最小图谱可以重复导入和查询。没有完成这一闭环前，不开发前端。

### Task 1：记录开发环境基线

**说明：** 检查 Python、Git、Node.js、PowerShell 和 Neo4j 状态，建立可复现的环境说明与 Python 依赖入口。

**验收条件：**

- [ ] `docs/leader/environment.md` 记录版本、安装位置和缺失组件；
- [ ] 建立 `.env.example`，只含变量名和示例值；
- [ ] 后端依赖文件能够创建干净虚拟环境。

**验证：**

- [ ] 执行版本检查命令并保存输出摘要；
- [ ] `git check-ignore .env` 返回已忽略；
- [ ] 新虚拟环境安装依赖无错误。

**依赖：** 无。

**预计涉及：** `docs/leader/environment.md`、`.env.example`、`backend/requirements.txt`。

**规模：** S，约 1 至 2 小时。

### Task 2：建立最小真实样例

**说明：** 从已人工确认的规程页面建立 5 个实体和 5 条关系，用于验证数据结构。样例必须包含至少一个部件、缺陷、措施和标准。

**验收条件：**

- [ ] 每条样例包含合法 ID、类型、状态、双页码和原文证据；
- [ ] 每个关系的起点和终点实体都存在；
- [ ] 样例数据不包含猜测值或未经核对的 OCR 文本。

**验证：**

- [ ] 人工逐条对照 PDF 页面；
- [ ] 用表格软件重新打开 CSV，中文、逗号和换行未错位。

**依赖：** Task 1。

**预计涉及：** `data/import/entities.csv`、`data/import/relations.csv`。

**规模：** S，约 1 至 2 小时。

### Task 3：实现 CSV 数据校验器

**说明：** 在导入数据库之前自动检查字段、ID、类型、状态、空值、重复项和关系引用完整性。

**验收条件：**

- [ ] 非法实体类型、关系类型和状态会返回具体行号；
- [ ] 重复 ID 和不存在的关系端点会导致非零退出码；
- [ ] 正确的最小样例检查通过。

**验证：**

- [ ] `pytest tests/data_validation -q` 通过；
- [ ] 分别制造错误类型、重复ID和缺失端点，脚本均能阻止导入。

**依赖：** Task 2。

**预计涉及：** `scripts/validation/validate_csv.py`、`tests/data_validation/test_validate_csv.py`、`scripts/README.md`。

**规模：** M，约 2 至 3 小时。

### Task 4：跑通 Neo4j 导入和查询

**说明：** 安装 Neo4j Desktop，建立约束、清空和参数化导入脚本，并对最小样例执行查询。

**验收条件：**

- [ ] 一条命令或明确步骤可从空数据库导入样例；
- [ ] 重复执行导入不会产生重复节点和关系；
- [ ] 查询能返回部件及其缺陷、措施或标准，并显示来源页码。

**验证：**

- [ ] `pytest tests/neo4j -q` 在已启动测试数据库时通过；
- [ ] Neo4j Browser 中执行示例 Cypher，节点数和关系数符合 CSV；
- [ ] 清空后重新导入结果一致。

**依赖：** Task 3。

**预计涉及：** `scripts/import/init_constraints.cypher`、`scripts/import/import_graph.py`、`scripts/import/clear_graph.cypher`、`tests/neo4j/test_import.py`。

**规模：** M，约 3 至 4 小时。

### Checkpoint A：最小闭环

- [ ] `scripts/check-repository.ps1` 通过；
- [ ] CSV 自动校验通过；
- [ ] 空数据库可以重复导入；
- [ ] 至少一条图查询返回真实知识和页码；
- [ ] 提交独立保存点：`feat: complete minimum neo4j data loop`。

## 6. 阶段二：OCR 接口和正式数据

### 本节小结

本阶段不追求完全自动抽取，而是建立“机器提出候选、成员人工确认、校验器把关”的数据生产线。数据达到课程数量只是最低条件，证据完整性优先于数量。

### Task 5：验证 OCR 工具和交付格式

**说明：** 选择包含正文、数值、单位和表格的 2 至 3 页，对 PaddleOCR CPU 做小样验证，记录安装、参数、耗时和主要错误类型。

**验收条件：**

- [ ] 输出按 PDF 页码分隔，保留原始结果和人工修订结果；
- [ ] 明确记录数字、小数点、单位和专业术语的错误；
- [ ] 若 PaddleOCR 无法稳定安装，记录证据并选择可运行替代工具。

**验证：**

- [ ] 随机抽查至少 20 个含数字或术语的片段；
- [ ] 所有修订都能定位回原 PDF 页面。

**依赖：** Task 1。

**预计涉及：** `scripts/ocr/`、`docs/leader/ocr-evaluation.md`、`data/ocr/README.md`。

**规模：** M，约 3 至 4 小时。

### Task 6：建立成员数据交付门槛

**说明：** 将 Schema、CSV 校验器和 OCR 经验转成成员可以照做的交付检查表，避免组长收到格式各异的数据。

**验收条件：**

- [ ] 检查表涵盖文件名、字段、ID、状态、页码、证据和复核人；
- [ ] 提供一条正确样例和常见错误示例；
- [ ] C、D 两名数据负责人能按检查表提交一小批数据。

**验证：**

- [ ] 分别用 C、D 的样例运行校验器；
- [ ] 发现的问题通过 Issue 返回，不在聊天中口头修改后丢失记录。

**依赖：** Task 3、Task 5。

**预计涉及：** `docs/data-submission-guide.md`、`.github/ISSUE_TEMPLATE/data-review.md`。

**规模：** S，约 1 至 2 小时。

### Task 7：验收课程规模数据

**说明：** 接收并合并成员数据，处理 ID 冲突、重复实体、关系方向和证据缺失，形成可导入的数据版本。

**验收条件：**

- [ ] 至少 30 个实体和 40 条关系通过自动检查；
- [ ] 五类实体和主要关系均有合理覆盖；
- [ ] 所有 `approved` 数据均有复核人、双页码和原文证据。

**验证：**

- [ ] 输出实体类型、关系类型、状态和章节分布统计；
- [ ] 随机复核不少于 20% 数据，数值类和标准类数据全部复核；
- [ ] 清空数据库后完整重导，节点关系数量一致。

**依赖：** Task 4、Task 6；依赖 B、C、D 的数据交付。

**预计涉及：** `data/import/*.csv`、`scripts/validation/report_dataset.py`、`reports/weekly/`。

**规模：** M，分批进行，每批不超过 2 小时。

### Checkpoint B：正式数据版本

- [ ] 数据数量达到课程最低要求；
- [ ] 所有标准值和单位已人工核对；
- [ ] 数据质量报告已生成；
- [ ] Neo4j 完整重导成功；
- [ ] 提交独立保存点：`data: add reviewed wheelset knowledge dataset`。

## 7. 阶段三：四类受控问答

### 本节小结

问答先覆盖课程明确要求的四类问题。系统不执行用户提交的 Cypher，也不直接执行模型自由生成的查询；所有查询都从白名单模板生成并使用参数绑定。

### Task 8：定义问题意图和查询契约

**说明：** 为部件关联、缺陷处理、限度标准和工序步骤定义输入参数、Cypher 模板和统一答案结构。

**验收条件：**

- [ ] 四类意图各有至少一个参数化查询模板；
- [ ] 查询只读，不包含创建、删除或更新语句；
- [ ] 返回结构统一包含答案、实体、关系、PDF页码、印刷页码和原文证据。

**验证：**

- [ ] 每类至少执行 2 个已知问题；
- [ ] 不存在的部件返回“未找到证据”，不编造答案。

**依赖：** Task 4，可先用最小样例开发；最终验收依赖 Task 7。

**预计涉及：** `backend/app/query_templates.py`、`backend/app/models.py`、`tests/queries/test_templates.py`。

**规模：** M，约 3 至 4 小时。

### Task 9：实现 FastAPI 最小问答接口

**说明：** 建立健康检查、问题提交和图谱邻域查询接口，封装 Neo4j 会话和错误处理。

**验收条件：**

- [ ] `GET /health` 能区分应用可用与数据库不可用；
- [ ] `POST /api/questions` 返回统一答案和证据；
- [ ] `GET /api/graph/{entity_id}` 返回节点和边，不泄露数据库凭据。

**验证：**

- [ ] `pytest backend/tests -q` 通过；
- [ ] FastAPI `/docs` 中手工完成四类请求；
- [ ] Neo4j 停止时接口返回明确的服务错误，而不是堆栈页面。

**依赖：** Task 8。

**预计涉及：** `backend/app/main.py`、`backend/app/database.py`、`backend/app/services/qa.py`、`backend/tests/`。

**规模：** M，拆成数据库层与接口层两个提交，各约 2 至 3 小时。

### Task 10：加入可选 AI 辅助

**说明：** AI 只负责把自然语言候选映射到四类意图和实体参数，或在已有结构化证据上组织回答。关闭 AI 时系统仍能回答模板问题。

**验收条件：**

- [ ] AI 功能通过环境变量显式开启，默认关闭；
- [ ] 模型输出经过 Pydantic 校验，不能携带任意 Cypher；
- [ ] 无API、超时或输出无效时自动退回规则解析，并标明处理方式。

**验证：**

- [ ] 使用模拟响应测试正常、超时、无效JSON和未知意图；
- [ ] 日志不记录 API Key、完整敏感请求或原始课程文件；
- [ ] 关闭网络后基础四类问题仍可运行。

**依赖：** Task 9。

**预计涉及：** `backend/app/services/intent.py`、`backend/app/settings.py`、`backend/tests/test_intent.py`、`.env.example`。

**规模：** M，约 3 至 4 小时。

### Checkpoint C：后端问答闭环

- [ ] 四类问题均通过 API 返回答案和证据；
- [ ] 查询全部参数化且只读；
- [ ] 数据库断开、问题无答案、AI超时均有可理解响应；
- [ ] 后端测试通过；
- [ ] 提交独立保存点：`feat: add evidence-backed graph question API`。

## 8. 阶段四：最小前端和图谱展示

### 本节小结

前端服务于反复查询和答辩演示，第一版只做问题输入、答案证据、图谱邻域和系统状态。不要先做登录、复杂设置、动画背景或与课程无关的页面。

### Task 11：完成问答主界面

**说明：** 建立单页操作界面，支持输入问题、选择示例问题、查看加载状态、答案、证据和错误信息。

**验收条件：**

- [ ] 桌面与手机宽度下文字和按钮不重叠；
- [ ] 答案同时显示来源页码和原文证据；
- [ ] 加载、空结果、接口错误和数据库离线状态清楚可见。

**验证：**

- [ ] 在常用桌面和手机视口手工检查；
- [ ] 连续提交、空问题和后端断开时页面不崩溃；
- [ ] 四类示例问题均能从页面完成。

**依赖：** Task 9。

**预计涉及：** `frontend/index.html`、`frontend/styles.css`、`frontend/app.js`。

**规模：** M，约 3 至 4 小时。

### Task 12：加入图谱邻域展示

**说明：** 使用 Cytoscape.js 展示当前答案涉及的节点和关系，提供节点选择、关系标签和重置视图。

**验收条件：**

- [ ] 图谱非空时能显示节点类型和关系方向；
- [ ] 选择节点可查看名称、类型和证据；
- [ ] 空图、单节点和较多节点时布局仍可操作。

**验证：**

- [ ] 使用 1、5、20 个节点的测试数据检查布局；
- [ ] 浏览器控制台无错误；
- [ ] 图谱结果与 Neo4j 查询结果一致。

**依赖：** Task 11、`GET /api/graph/{entity_id}`。

**预计涉及：** `frontend/graph.js`、`frontend/app.js`、`frontend/styles.css`、`frontend/tests/`。

**规模：** M，约 3 至 4 小时。

### Checkpoint D：可演示系统

- [ ] 新环境按 README 可以启动数据库、后端和前端；
- [ ] 页面完成四类问答和图谱查看；
- [ ] 所有答案展示来源证据；
- [ ] 手机与桌面视口无明显遮挡；
- [ ] 提交独立保存点：`feat: add question and graph exploration interface`。

## 9. 阶段五：评测、文档和合并

### 本节小结

最后阶段用固定问题集检验结果，不以“演示时刚好成功”为验收。合并前必须同步最新 `main`、复跑测试并让至少一名成员复核数据或操作说明。

### Task 13：建立并执行评测集

**说明：** 与 E 共同整理 10 至 15 道问题，覆盖四类意图、无答案问题和常见措辞变体，记录系统答案及通过情况。

**验收条件：**

- [ ] 四类问题均至少有 2 道；
- [ ] 每题有预期答案、证据页码和判定结果；
- [ ] 失败问题记录原因，不只记录总正确率。

**验证：**

- [ ] 评测脚本可重复执行并生成结果文件；
- [ ] 人工抽查所有标准值类答案；
- [ ] 修复后重新运行不会覆盖历史结果。

**依赖：** Task 10、Task 12；依赖 E 的问题初稿。

**预计涉及：** `data/evaluation/questions.csv`、`scripts/evaluation/run_evaluation.py`、`output/evaluation/`（本地生成，已加入 `.gitignore`）。

**规模：** M，约 3 至 4 小时。

### Task 14：完成运行和演示文档

**说明：** 将安装、配置、导入、启动、测试、常见故障和答辩演示顺序写成新人可复现的说明。

**验收条件：**

- [ ] README 不依赖组长口头补充即可运行；
- [ ] 演示脚本包含正常问题、无答案问题和证据展示；
- [ ] 常见故障包含 Neo4j 未启动、密码错误、CSV 校验失败和端口占用。

**验证：**

- [ ] 由一名成员按文档在新环境执行；
- [ ] 文档中的命令逐条验证，无失效路径和过期截图。

**依赖：** Task 13。

**预计涉及：** `README.md`、`docs/setup.md`、`docs/demo-script.md`、`docs/troubleshooting.md`。

**规模：** M，约 2 至 3 小时。

### Task 15：准备 Pull Request 并合并

**说明：** 同步远程 `main`，在个人分支解决冲突，复跑全部检查，发起 Pull Request 并根据复核意见修改。

**验收条件：**

- [ ] 分支包含按功能拆分的可读提交，不含临时文件和秘密；
- [ ] Pull Request 说明包含范围、验证结果、已知限制和演示步骤；
- [ ] 至少一名成员审批，自动和人工检查均通过后再合并。

**验证：**

- [ ] `git diff origin/main...HEAD --check` 无格式错误；
- [ ] 仓库结构、数据、后端、前端和评测检查全部通过；
- [ ] `git ls-files` 中不存在 PDF、DOCX、`.env`、密钥或数据库文件。

**依赖：** Task 14。

**预计涉及：** 所有已验收成果，不新增功能。

**规模：** S，约 1 至 2 小时加复核等待时间。

### Checkpoint E：最终完成

- [ ] 30 个以上实体、40 条以上关系；
- [ ] 四类问题可查询；
- [ ] 10 至 15 道评测题有结果；
- [ ] 数据、单位、条件和证据经过人工复核；
- [ ] 新成员能按文档运行；
- [ ] `main` 合并后再次执行冒烟测试；
- [ ] 删除已合并分支和 worktree 前确认没有未提交文件。

## 10. 建议时间安排

### 本节小结

以下按 14 个有效工作日规划，不要求连续自然日。数据成员延期时，优先保证 30/40 指标和四类查询，不牺牲证据核对去补界面功能。

| 工作日 | 组长重点 | 当日必须留下的结果 |
| --- | --- | --- |
| Day 1 | Task 1、Task 2 | 环境记录、5实体5关系 |
| Day 2 | Task 3 | CSV校验器和测试 |
| Day 3 | Task 4 | Neo4j最小闭环 |
| Day 4 | Task 5 | OCR验证记录 |
| Day 5 | Task 6、Task 8起步 | 交付规范、查询契约 |
| Day 6 | Task 8 | 四类查询模板 |
| Day 7 | Task 9 | 后端数据库层和健康检查 |
| Day 8 | Task 9 | 问答API及测试 |
| Day 9 | Task 7 | 第一批正式数据验收和重导 |
| Day 10 | Task 10 | 可选AI意图映射和降级 |
| Day 11 | Task 11 | 问答主界面 |
| Day 12 | Task 12 | 图谱展示 |
| Day 13 | Task 13 | 评测结果与修复 |
| Day 14 | Task 14、Task 15 | 文档、PR和最终验收 |

成员数据未按 Day 9 到达时，组长先用最小样例完成系统开发，同时创建阻塞 Issue；最迟在评测前切换到正式数据。

## 11. 每日工作方法

1. 从本计划选择一个 Task，不同时开启多个未完成技术任务；
2. 在 GitHub Issue 或 `docs/leader/progress-log.md` 记录当天目标；
3. 先写验收或测试样例，再做实现；
4. 完成后执行该 Task 的验证命令；
5. 检查 `git diff` 和敏感文件；
6. 做一次原子提交；
7. 更新进度、问题和下一步。

建议提交序列：

```text
docs: record local development environment
data: add verified minimum graph sample
feat: add csv data validation
feat: add repeatable neo4j import
docs: define reviewed data handoff
feat: add controlled graph query templates
feat: add evidence-backed question api
feat: add optional ai intent mapping
feat: add question interface
feat: add graph neighborhood view
test: add question evaluation suite
docs: add setup and demonstration guide
```

## 12. 风险和处理

| 风险 | 影响 | 处理办法 |
| --- | --- | --- |
| Neo4j 安装或端口失败 | 高 | Day 3 前验证；记录端口、版本和错误；不等到集成阶段处理 |
| OCR 数字和单位错误 | 高 | OCR只产出候选；标准值全部人工复核；保存双页码和原文 |
| 成员数据格式不统一 | 高 | 用统一CSV、校验器和小批次预验收，不到最后一次性接收 |
| AI生成错误Cypher | 高 | 模型不直接执行Cypher；只输出受控意图和参数 |
| API Key 或原始文档泄露 | 高 | `.gitignore`、环境变量、提交前扫描和PR复核四层控制 |
| 前端耗时挤压主线 | 中 | 先做功能型单页；数据、查询和证据未完成前不做视觉扩展 |
| 分支长期偏离 `main` | 中 | 每日 fetch；每个检查点同步 `origin/main` 并复测 |
| 演示依赖网络 | 中 | 基础规则问答离线可用；AI和CDN依赖准备本地降级方案 |
| 问题能查询但答案无证据 | 高 | API模型强制证据字段；无证据时返回未找到而非生成结论 |

## 13. 合并操作清单

合并前按以下顺序执行，不在 `main` 工作区手工复制文件：

```powershell
cd D:\desktop\stu\铁信实习\railway-pdf-knowledge-graph-leader
git status
git fetch origin
git rebase origin/main
powershell -ExecutionPolicy Bypass -File scripts/check-repository.ps1
# 继续执行数据、后端、前端和评测测试
git diff origin/main...HEAD --check
git push -u origin feature/leader-implementation
gh pr create --base main --head feature/leader-implementation
```

Pull Request 合并并完成 `main` 冒烟测试后，才移除 worktree：

```powershell
cd D:\desktop\stu\铁信实习\railway-pdf-knowledge-graph
git pull
git worktree remove ..\railway-pdf-knowledge-graph-leader
git branch -d feature/leader-implementation
```

移除前必须确认个人工作区没有未提交文件。不要使用强制删除或 `git reset --hard` 清理尚未核对的成果。

## 14. 开始实施前的确认

- [ ] 组长确认采用本计划的技术默认值；
- [ ] 五名成员完成角色认领；
- [ ] B、C、D 知道首批小样的文件格式和截止时间；
- [ ] 课程原始 PDF 可在本地访问但未进入 Git；
- [ ] Neo4j Desktop 安装权限可用；
- [ ] Task 1 和 Task 2 对应的 GitHub Issue 已创建。

上述六项确认后，从 Task 1 开始，不提前开发前端。
