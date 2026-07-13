# 开发环境基线

## 本节小结

当前电脑已经具备 Python、Java、Git、GitHub CLI 和 Node.js。Neo4j、Docker 与 PowerShell 7 尚未安装，因此数据库采用 Neo4j Desktop，项目命令以 Windows PowerShell 5.1 兼容写法为准。环境检查日期为 2026-07-13。

## 已安装组件

| 组件 | 检测版本 | 当前用途 |
| --- | --- | --- |
| Python | 3.12.4 | 数据处理、后端、测试和导入脚本 |
| pip | 25.3 | Python 依赖管理 |
| Java | 21.0.8 LTS | Neo4j 运行环境 |
| Git | 2.52.0.windows.1 | 版本管理和 worktree |
| GitHub CLI | 2.93.0 | 仓库、Issue 和 Pull Request 操作 |
| Node.js | 24.11.1 | 前端工具备用 |
| npm | 11.6.2 | 前端依赖管理备用 |
| Windows PowerShell | 5.1 | 当前命令执行环境 |

## 缺失组件

| 组件 | 判断 | 处理决定 |
| --- | --- | --- |
| Neo4j Desktop 2 | 已安装并创建实例 | 使用本地 Neo4j 2026.05.0 实例 |
| Docker | 命令不可用 | 当前不安装，避免增加数据库部署路径 |
| PowerShell 7 | `pwsh` 不可用 | 脚本保持兼容 PowerShell 5.1 |

## Python 环境建立方法

在个人 worktree 根目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

验证依赖：

```powershell
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -c "import fastapi, neo4j, pandas, pytest; print('dependencies ok')"
```

`.venv` 已由 `.gitignore` 排除，不得提交虚拟环境目录。

## 本地配置方法

复制 `.env.example` 为 `.env` 后填写本机 Neo4j 密码。`.env` 不得提交：

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
git check-ignore .env
```

AI 功能默认关闭。即使未配置 AI 接口，基础图谱查询和四类问答仍应可运行。

## 已知兼容性事项

- Python 3.12 可以支持首版 FastAPI、Neo4j 驱动、pandas 和 pytest；
- PaddleOCR 的 Python 3.12 安装兼容性在 Task 5 单独验证，不提前加入基础依赖；
- Neo4j Desktop 自带或管理数据库运行环境，仍保留系统 Java 版本记录；
- PowerShell 脚本不得依赖 PowerShell 7 专有语法。

## Neo4j 本机状态

- Desktop 安装目录：`D:\Nro4j\Neo4j Desktop 2`；
- 实例版本：Neo4j 2026.05.0；
- HTTP 地址：`http://localhost:7474`；
- Bolt 地址：`bolt://localhost:7687`；
- 默认数据库：`neo4j`；
- 认证信息：仅保存在本地 `.env`，不写入本文档。

实际安装目录名为 `Nro4j`，不是 `Neo4j`。后续脚本不依赖该绝对安装路径，只通过 Bolt 地址连接数据库。
