# 成员 C 数据审查报告

## 当前结论

截至 2026-08-31，成员 C 提交已完成证据文本和关系结构修复，并通过成员角色 CSV 校验。提交目录保留为 `draft`，未纳入正式 Neo4j 导入表；正式表继续使用已复核的 65 个实体和 55 条关系。

## 当前统计

| 项目 | 数量 | 状态 |
| --- | ---: | --- |
| 实体 | 48 | 全部 `draft` |
| 关系 | 47 | 全部 `draft` |
| 孤立实体 | 0 | 通过 |
| 缺失端点 | 0 | 通过 |
| 重复实体 ID | 0 | 通过 |
| 重复关系 ID | 0 | 通过 |

执行命令：

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv `
  --entities data\submissions\member-c\entities.csv `
  --relations data\submissions\member-c\relations.csv `
  --submission-role member-c
```

输出：`CSV validation passed.`

## 暂不纳入正式表的原因

成员 C 数据与正式样例存在“车轮”“轮对”等同名概念。试导入后，部分自然语言问答会返回重复语义，影响答案唯一性和演示稳定性。因此本阶段保留 C 的修复成果供后续人工复核，不把它们直接改为 `reviewed`。

## 后续复核入口

若要纳入正式表，需要由非提交人逐条对照 PDF 原文，确认实体边界、关系语义、页码和证据文本，再将确认记录改为 `reviewed`，并重新运行导入、问答和评测。
