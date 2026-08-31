# 任务二剩余工作实施计划

## 当前小结

系统已经完成从 CSV 校验、Neo4j 导入、FastAPI 查询到 React 前端展示的闭环。当前正式数据为 65 个实体、55 条关系，D 方向数据已经由组长复核后纳入；C 方向提交已修复为 48 个实体、47 条关系并继续保持 `draft`，未纳入正式表。API 健康检查已连接 Neo4j，四类自然语言问答和 16 道评测题均已有可执行路径。

本阶段目标是：完成 C 数据修复与取舍，完成前后端全量验证，修正文档事实，并将经过验证的个人分支合并到 `main`。数据、测试和文档工作已完成，当前只剩提交、推送和合并发布。

## 并行工作线

| 工作线 | 负责人 | 允许修改的范围 | 验收结果 |
| --- | --- | --- | --- |
| C 数据修复 | 数据审查代理 | `data/submissions/member-c/` | CSV 校验通过，证据不再是孤立标题或截断片段，关系语义明确 |
| 自动化验证 | 评测代理 | 只读执行测试与构建 | Python、前端 lint/typecheck/build/unit/e2e 结果可复现 |
| 文档事实检查 | 文档代理 | `scripts/import/README.md` 及交付文档 | 所有数量、状态、命令与当前仓库一致 |
| 数据集成与发布 | 组长 | `data/import/`、Neo4j、Git | 通过复核的数据导入，真实问答、全量测试和合并完成 |

## 执行顺序

1. [x] 完成 C 提交目录的证据和关系修复，保持 `draft`，并通过成员角色校验。
2. [x] 由组长抽查 C 的关键实体、关系、页码和原文；证据不足的记录不进入正式表。
3. [x] 试导入 C 后确认同名概念会造成问答重复语义，保留 C 的修复结果为 `draft`，正式表继续使用 65/55 数据。
4. [x] 清空并重建本地 Neo4j，执行正式导入，完成四类问答和图谱邻域检查。
5. [x] 完成 Python 全量测试、前端 lint、类型检查、构建、单元测试、E2E 和生产模式 E2E。
6. [x] 检查文档、`.gitignore`、禁止跟踪文件、差异空白和工作树状态。
7. [x] 已提交并推送 `feature/leader-implementation`；已快进合并并推送 `main`，健康检查和 16 道真实评测均通过。

## 验收门槛

- 数据：至少 30 个实体、40 条关系；所有端点存在，方向符合 Schema，页码、原文、复核人和状态完整。
- 问答：部件关联、缺陷处理、限度标准、工序步骤均返回真实证据；无答案问题返回 `found=false`，不编造内容。
- 评测：题库至少 10 道，当前为 16 道，四类意图各 4 道，结果可重复生成。
- 前端：默认中文，开发和生产构建均能加载；查询结果、证据和图谱邻域无明显错误。
- 交付：新环境可按 `docs/setup.md` 启动；文档不把 `draft` 数据写成正式数据。
- 发布：秘密、原始 PDF/DOCX、数据库目录、`node_modules`、`dist` 和浏览器输出未跟踪，`main` 与验证后的个人分支一致。

## 当前判断

C 已完成 48 个实体、47 条关系的证据修复和结构校验，但试导入后与正式样例的同名概念会造成问答返回重复语义。因此本阶段将 C 保留为 `draft` 提交成果，不纳入正式导入；当前 65/55 已满足课程最低数据量和四类功能验收。

## 可复用命令

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv
.\.venv\Scripts\python.exe scripts\import\import_graph.py
.\.venv\Scripts\python.exe scripts\evaluation\run_evaluation.py --base-url http://127.0.0.1:8000
.\.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run e2e:production
```
