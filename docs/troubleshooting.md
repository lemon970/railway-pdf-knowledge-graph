# 常见故障处理

## `python` 找不到或导入模块失败

确认当前目录是仓库根目录，并使用项目虚拟环境中的解释器：

```powershell
Get-Location
Test-Path .venv\Scripts\python.exe
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

不要依赖全局 Python 中是否安装了 FastAPI、Neo4j 或 pytest。

## `.env` 缺失或提示缺少配置

重新创建本地配置并填写 Neo4j 密码：

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

导入脚本至少需要 `NEO4J_URI`、`NEO4J_USERNAME` 和 `NEO4J_PASSWORD`。`.env` 在 `.gitignore` 中，不能提交到仓库。

## `/health` 返回 `database=unavailable`

按顺序检查：

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 7687
Invoke-RestMethod http://127.0.0.1:8000/health
```

若 7687 不通，打开 Neo4j Desktop 并启动 DBMS。若端口已通但仍不可用，核对 `.env` 中的 URI、用户名、密码和数据库名；不要把密码写入命令行截图。

## 导入时报 `Import stopped: CSV validation failed`

先单独运行校验器：

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv
```

根据文件名和行号修复：表头必须与模板完全一致，实体 ID 使用类型前缀，关系端点必须存在，关系方向必须符合 `docs/schema.md`，PDF 页码、印刷页码、原文、复核人和状态不能为空。成员 C 使用 100-199 号段，成员 D 使用 200-299 号段；新提交目录中的状态必须是 `draft`。D 首批数据已经过校验和复核，并以 `reviewed` 状态进入正式 `data/import/`；C 的 48 个实体和 47 条关系虽已修复并通过校验，但因同名概念造成查询歧义暂未导入。后续新增或修改仍应先在提交目录校验、复核，再更新正式表。

## 导入成功但问答没有答案

先确认查询主题和关系类型：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/graph/C002
```

如果图谱接口也失败，问题在数据库连接或导入。若图谱正常但某类问答为空，检查正式 CSV 是否真的包含对应关系。`procedure_steps` 只查询 `Procedure - NEXT_STEP -> Procedure`，没有工序节点或关系时必须返回“未找到证据”。

## 前端页面打不开或显示数据库不可用

开发模式需要两个进程：

1. 后端监听 `127.0.0.1:8000`；
2. 前端通过 Vite 访问并代理 `/api`、`/health`。

确认前端目录依赖和启动命令：

```powershell
Set-Location frontend
npm install
npm run dev
```

生产单服务模式需要先执行 `npm run build`，否则根路径会提示前端尚未构建。

## `422 UNKNOWN_INTENT`

自然语言没有命中四类受控意图，改用包含明确关键词的问题，例如“属于哪个部件”“如何处理”“限度标准”“下一步工序”。也可以直接调用 `/api/questions`，显式传入 `intent` 和 `subject`。

## 误用了 `--clear`

`--clear` 会删除当前数据库中带 `Entity` 标签的项目节点和关系。重新导入正式 CSV 即可恢复当前表中的内容：

```powershell
.\.venv\Scripts\python.exe scripts\import\import_graph.py
```

运行前确认 `.env` 指向本项目数据库，避免对其他 Neo4j 数据库执行清空。
