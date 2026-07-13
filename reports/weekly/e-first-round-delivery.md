# 实验二 E 角色第一轮交付记录

## 1. 本轮范围

本轮以《和谐2C型动车组四级检修规程》中的第 4.3 节“轮对轴箱装置”为范围，覆盖轮对、车轮、车轴、轴箱轴承、轮对组装与检压测试等内容。

- PDF 页码：第 6-12 页
- 印刷页码：第 29-35 页
- 查询类别：部件关联、缺陷处置、标准限度、流程步骤

## 2. 已完成内容

- `docs/schema.md`：固定五类实体、五类关系和 ID/状态命名规则。
- `data/import/entities.csv`：首轮 11 个实体，状态均为 `draft`。
- `data/import/relations.csv`：首轮 8 条关系，状态均为 `draft`。
- `data/evaluation/questions.csv`：15 道测试问题，覆盖四类查询，状态均为 `draft`。
- `frontend/example_data.json`：前端联调格式示例。
- `frontend/page_sketch.md`：问答页面草图。

## 3. 当前验证

- JSON 结构、ID 格式、关系类型和状态值检查通过。
- `scripts/check-repository.ps1` 运行通过。
- 尚未填写实际查询答案、成功率、耗时和失败分类，因为当前仓库尚未提供可运行的 Neo4j/问答后端。

## 4. 待人工复核

- 逐条对照 PDF 原文确认实体名称、数值、单位、条件和页码。
- 将状态从 `draft` 改为 `reviewed` 前，由组员完成复核并填写 reviewer。
- 后端联调后，逐题填写实际答案、是否正确、失败类型和耗时。

