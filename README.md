# 基于 PDF 的铁路检修知识图谱与问答系统

## 项目小结

本项目以《和谐2C型动车组四级检修规程》为知识来源，先完成“PDF 页面 -> OCR -> 人工复核 -> 实体关系 CSV -> Neo4j 查询”的最小闭环，再开发问答接口和展示页面。所有技术结论必须能回到规程原文和页码，不直接采用未经核对的 AI 输出。

## 当前范围

- 4.3.1 轮对
- 4.3.1.1 车轮
- 4.3.1.2 车轴
- 4.3.1.3 轮对组装
- 4.3.2 轴箱轴承

详见 [项目范围](docs/project-scope.md) 和 [知识图谱 Schema](docs/schema.md)。

## 课程最低目标

- 4 至 5 类实体和关系；
- 不少于 30 个实体、40 条关系；
- 支持部件关联、缺陷处理、限度标准、工序步骤四类查询；
- 至少 10 个自然语言问题；
- 10 至 15 个评测问题；
- 每条知识保留 PDF 页码、印刷页码和原文证据。

## 目录

```text
docs/       项目范围、Schema、分工、AI规则和会议记录
data/       OCR、人工复核、Neo4j导入表和评测题
scripts/    OCR、抽取、导入、评测和仓库检查脚本
backend/    FastAPI 问答后端与 Neo4j 查询
frontend/   React + TypeScript 查询与图谱展示
tests/      跨模块测试资料
reports/    周报、结题报告和答辩材料
.github/    Issue和Pull Request模板
```

## 新成员第一次操作

```powershell
git clone <仓库地址>
cd railway-pdf-knowledge-graph
git switch -c docs/你的任务名称
```

1. 阅读本文件、`CONTRIBUTING.md` 和自己负责的数据规范。
2. 在 GitHub Project 的“待认领”列选择一个 Issue。
3. 将 Issue 改为“已认领”，写明预计完成时间。
4. 在独立分支中工作，提交后发起 Pull Request。
5. 不要把原始 PDF、DOCX、密钥或本地数据库提交到仓库。

运行仓库结构检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-repository.ps1
```

## 当前技术状态

- 后端使用 FastAPI，通过 Neo4j Bolt 查询正式导入表。
- 前端使用 React + TypeScript，默认中文，提供自然语言问答、证据查看和图谱邻域展示。
- 当前正式数据为 65 个实体、55 条关系；成员 C 的 48 个实体、47 条关系保留在提交目录中并标记为 `draft`。
- 本地启动、导入、评测和故障处理步骤见 [环境搭建](docs/setup.md)、[演示脚本](docs/demo-script.md) 和 [故障排查](docs/troubleshooting.md)。
