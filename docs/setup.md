# 本地运行手册

## 使用前确认

本项目需要在 Windows 本机运行 Python 后端、Neo4j 图数据库和 React 前端。Neo4j 是问答接口的必需依赖；没有数据库时页面可以打开，但查询会被禁用或返回数据库不可用。

| 项目 | 要求 |
| --- | --- |
| Python | 3.12 或兼容版本 |
| Node.js / npm | 用于前端开发服务器和构建 |
| Neo4j | 已创建数据库 `neo4j`，Bolt 监听 `localhost:7687` |
| Git | 克隆仓库和切换分支 |

当前仓库中的正式导入表是 `data/import/entities.csv` 和 `data/import/relations.csv`，目前包含 65 个实体和 55 条关系，全部为 `reviewed`。其中成员 D 的首批数据经组长复核后纳入正式表，共 60 个实体和 50 条关系；成员 C 的 48 个实体和 47 条关系已完成结构与证据修复，但因与正式样例存在同名概念而暂保留在提交目录并标记为 `draft`，未导入正式表。未完成复核或会造成查询歧义的数据不能直接作为正式数据使用。评测题库目前有 16 道 `reviewed` 题目，四类意图各 4 道。

## 快速启动和检查

Neo4j 启动、`.env` 配置和前端依赖安装完成后，在仓库根目录执行：

```powershell
.\scripts\start-local.ps1
```

脚本会检查 Neo4j，启动 FastAPI 后端和 React/Vite 开发页面，并打开 `http://127.0.0.1:5173`。已有可用服务会被复用，不会重复启动。只检查不启动新窗口：

```powershell
.\scripts\start-local.ps1 -CheckOnly
```

默认服务进程在后台窗口运行；需要查看日志并手动按 `Ctrl+C` 停止时使用 `-ShowWindows`。

生产模式会先构建 `frontend/dist`，再打开由 FastAPI 托管的页面：

```powershell
.\scripts\start-local.ps1 -Production
```

脚本不会自动启动 Neo4j；使用 `-ShowWindows` 时可在后端、前端窗口按 `Ctrl+C` 停止服务。

## 获取代码

```powershell
git clone https://github.com/lemon970/railway-pdf-knowledge-graph.git
Set-Location railway-pdf-knowledge-graph
```

个人开发应在独立分支中进行：

```powershell
git switch -c docs/你的任务名称
```

## 建立 Python 环境

在仓库根目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m pip check
```

## 配置环境变量

只在本机创建 `.env`，不要提交它：

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

编辑 `.env`，至少填写：

```dotenv
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=你的Neo4j密码
NEO4J_DATABASE=neo4j
AI_ENABLED=false
```

AI 意图识别是可选项。`AI_ENABLED=false` 时使用本地规则，基础问答不依赖外部模型。不要把密码、API Key 或完整 `.env` 粘贴到 Issue、PR 或截图中。

## 启动 Neo4j

使用 Neo4j Desktop 时：

1. 打开 Neo4j Desktop。
2. 选择项目中的 DBMS，确认数据库名为 `neo4j`。
3. 点击 **Start**，等待状态变为运行中。
4. 在浏览器打开 `http://localhost:7474`，用 `.env` 中的账号密码登录。

在 PowerShell 中检查 Bolt 端口：

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 7687
```

`TcpTestSucceeded` 必须为 `True`，导入和后端查询才有条件执行。

## 校验并导入数据

先在仓库根目录校验当前正式表：

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv
```

确认 Neo4j 已启动且 `.env` 有效后导入：

```powershell
.\.venv\Scripts\python.exe scripts\import\import_graph.py
```

脚本会先校验 CSV、创建唯一约束，再用 `MERGE` 导入节点和关系。重复执行不会按相同 ID 创建重复记录。只有经过原文、PDF 页码和印刷页码复核并标记为 `reviewed` 或 `approved` 的记录，才应复制到 `data/import/`。

清空项目图谱是破坏性操作，只在明确需要重建时执行：

```powershell
.\.venv\Scripts\python.exe scripts\import\import_graph.py --clear
.\.venv\Scripts\python.exe scripts\import\import_graph.py
```

该操作只删除带 `Entity` 标签的项目节点及其关系，不删除 Neo4j 系统数据。

## 启动后端

打开一个 PowerShell 窗口，在仓库根目录执行：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

验证服务和数据库：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

正常结果为 `status=ok`、`database=connected`。API 文档地址为 `http://127.0.0.1:8000/docs`。

## 启动前端开发服务器

打开第二个 PowerShell 窗口：

```powershell
Set-Location frontend
npm install
npm run dev
```

访问 Vite 输出的地址，通常是 `http://127.0.0.1:5173`。开发服务器会把 `/api` 和 `/health` 转发到 `http://127.0.0.1:8000`，因此后端窗口必须保持运行。

## 构建并运行单服务版本

需要让 FastAPI 同时托管前端静态文件时，在 `frontend` 目录执行：

```powershell
npm run build
```

返回仓库根目录启动后端，例如使用 8027 端口：

```powershell
Set-Location ..
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8027
```

访问 `http://127.0.0.1:8027`。构建产物 `frontend/dist/` 已被 Git 忽略，不要提交。

## 停止与提交前检查

在运行服务的窗口按 `Ctrl+C` 停止。提交前执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-repository.ps1
git status --short
```

`.env`、原始 PDF/DOCX、Neo4j 数据目录、`node_modules`、`dist` 和浏览器输出不应出现在 Git 变更中。
