# 任务二 GitHub 仓库模板设计

## 1. 建设目标

在 `railway-pdf-knowledge-graph` 子文件夹中建立可直接推送到 GitHub 的课程项目仓库。仓库用于统一保存项目文档、OCR 中间结果、人工复核数据、Neo4j 导入文件、后端与前端代码、测试题以及答辩材料。

当前阶段只搭建协作和数据闭环所需的最小模板，不实现完整问答系统。

## 2. 项目范围

知识来源为《和谐2C型动车组四级检修规程》，第一阶段处理以下内容：

- 4.3.1 轮对
- 4.3.1.1 车轮
- 4.3.1.2 车轴
- 4.3.1.3 轮对组装
- 4.3.2 轴箱轴承

课程项目最低目标为：

- 4 至 5 类实体和关系；
- 不少于 30 个实体；
- 不少于 40 条关系；
- 支持部件关联、缺陷处理、限度标准、工序步骤四类查询；
- 至少准备 10 个自然语言问题；
- 建立 10 至 15 个评测问题；
- 所有知识记录保留 PDF 页码、印刷页码和规程原文证据。

## 3. 目录设计

仓库包含以下区域：

- `docs/`：范围、Schema、成员分工、AI 使用规则、会议记录和截图；
- `data/`：原始材料说明、OCR 结果、人工复核结果、Neo4j 导入表和评测问题；
- `scripts/`：OCR、候选知识抽取、Neo4j 导入和评测脚本；
- `backend/`：问答后端；
- `frontend/`：查询和图谱展示前端；
- `tests/`：跨模块测试资料；
- `reports/`：周报、结题报告和答辩材料；
- `.github/`：Issue、Pull Request 模板及协作配置。

PDF 原件默认不提交到 GitHub。仓库仅记录文件名、版本、页码映射和获取说明，避免大文件污染历史，并减少材料传播风险。

## 4. 数据规范

第一版实体类型为：

- `Component`
- `Defect`
- `Action`
- `Standard`
- `Procedure`

第一版关系类型为：

- `PART_OF`
- `HAS_DEFECT`
- `REQUIRES_ACTION`
- `HAS_STANDARD`
- `NEXT_STEP`

`entities.csv` 字段：

```text
entity_id,name,entity_type,description,pdf_page,printed_page,source_text,reviewer,status
```

`relations.csv` 字段：

```text
relation_id,source_id,relation_type,target_id,pdf_page,printed_page,source_text,reviewer,status
```

`questions.csv` 字段：

```text
question_id,category,question,expected_answer,evidence_page,status
```

状态只使用 `draft`、`reviewed`、`approved`。AI 生成内容只能以 `draft` 进入仓库；数值、单位、条件、专业术语和页码必须由成员对照原始 PDF 复核。

## 5. Git 协作设计

- 默认分支为 `main`；
- 成员通过短期功能分支工作，不直接向 `main` 提交；
- 分支使用 `feature/`、`fix/`、`docs/`、`data/` 等前缀；
- 每项工作关联一个 Issue；
- 完成后提交 Pull Request，由组长或另一名成员复核；
- 提交信息采用 `docs:`、`data:`、`feat:`、`fix:`、`test:`、`chore:` 前缀；
- `.env`、密钥、原始大体积 PDF、OCR 临时图片、数据库文件、虚拟环境和依赖目录不得提交。

## 6. 首期验收

模板搭建完成时应满足：

1. 新成员可从 README 理解项目目标、目录和首次操作；
2. CSV 模板可直接录入实体、关系和评测问题；
3. GitHub Issue 和 Pull Request 有统一模板；
4. 五个角色都有对应的工作入口；
5. 原始 PDF、大文件和凭据被 `.gitignore` 排除；
6. 空目录通过说明文件保留；
7. 仓库结构检查脚本能够验证关键文件是否存在；
8. 初始提交不包含课程原始 DOCX、PDF 或个人信息。

## 7. 暂不实施

本次模板不预先锁定具体前端框架、后端框架、OCR 引擎和大语言模型接口。首次数据闭环完成后，再根据成员学习情况选择实现工具，避免模板中出现无法运行的占位代码和不必要依赖。
