# 脚本目录

- `ocr/`：OCR批处理与格式清理；
- `extraction/`：候选实体关系抽取；
- `import/`：Neo4j导入；
- `evaluation/`：问题评测；
- `check-repository.ps1`：检查仓库关键结构。

具体工具确定后再添加依赖和运行脚本。

## 数据校验

在导入 Neo4j 前执行：

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv
```

发现错误时，命令会显示 CSV 文件名、行号和原因，并返回非零退出码。
