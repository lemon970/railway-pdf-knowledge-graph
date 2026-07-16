# Member B source materials

本目录存放成员 B 整理的 PDF 页码映射、OCR 修正记录和面向成员 C/D 的原文摘录材料。

这些文件用于人工复核和实体关系抽取参考，不属于 Neo4j 直接导入数据。正式导入数据仍应放在 `data/import/`，成员首次提交的实体和关系 CSV 应放在 `data/submissions/<member>/`。

## 文件说明

- `page_mapping.xlsx`：条款号、PDF 文件页码、规格印刷页码和段落关键词映射。
- `ocr-corrections.xlsx`：OCR 或录入错误修正记录。
- `for_C_轮对车轮.txt`：轮对与车轮相关原文材料，供成员 C 抽取参考。
- `for_D_车轴轴承组装.txt`：车轴、轮对组装、轴箱轴承及装置相关原文材料，供成员 D 抽取参考。

## 使用要求

- 抽取实体关系时必须回到 PDF 或本目录材料核对原文。
- `source_text` 不应使用省略号代替原文。
- 若发现页码、数字、单位或术语错误，应先修正本目录材料，再更新对应 CSV。
