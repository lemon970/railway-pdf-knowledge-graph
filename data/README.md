# 数据目录说明

数据从 `raw` 经过 `ocr` 和 `reviewed`，最终进入 `import`。不得跳过人工复核直接将 AI 或 OCR 输出标记为正式数据。

```text
raw/         原始资料获取和版本说明，不提交原文件
ocr/         OCR文本和处理说明
reviewed/    人工核对后的文本及页码映射
import/      Neo4j导入CSV
evaluation/  问答评测题
```

