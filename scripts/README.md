# 脚本目录

- `ocr/`：OCR批处理与格式清理；
- `extraction/`：候选实体关系抽取；
- `import/`：Neo4j导入；
- `evaluation/`：问题评测；
- `check-repository.ps1`：检查仓库关键结构。
- `start-local.ps1`：快速检查并启动 Neo4j 依赖下的 FastAPI 和 React 页面。

快速启动脚本不负责启动 Neo4j；请先在 Neo4j Desktop 中启动本地数据库。

也可以直接双击仓库根目录的 `start-local.cmd`。它会调用下面的 PowerShell 脚本并显示后端、前端服务窗口。

```powershell
.\scripts\start-local.ps1
```

默认将服务窗口隐藏；需要查看日志并手动按 `Ctrl+C` 停止时，加上 `-ShowWindows`。

```powershell
.\scripts\start-local.ps1 -ShowWindows
```

只检查当前环境和已运行服务：

```powershell
.\scripts\start-local.ps1 -CheckOnly
```

构建生产前端并由 FastAPI 托管：

```powershell
.\scripts\start-local.ps1 -Production
```

## 数据校验

在导入 Neo4j 前执行：

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv
```

发现错误时，命令会显示 CSV 文件名、行号和原因，并返回非零退出码。
