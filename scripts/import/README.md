# Neo4j 导入脚本

## 本节小结

导入脚本先校验 CSV，再创建唯一约束并使用参数化 `MERGE` 写入 Neo4j。重复导入不会创建重复节点或关系。密码只从被 Git 忽略的 `.env` 读取。

## 前置条件

- Neo4j 实例已经启动；
- 已从 `.env.example` 建立 `.env`；
- `.env` 中的账号密码可以连接本地数据库；
- Python 依赖已经安装到 `.venv`。

## 导入

```powershell
.\.venv\Scripts\python.exe scripts\import\import_graph.py
```

默认读取：

- `data/import/entities.csv`
- `data/import/relations.csv`

## 清空项目图谱

```powershell
.\.venv\Scripts\python.exe scripts\import\import_graph.py --clear
```

清空操作只删除带 `Entity` 标签的项目节点及其关系，不删除 Neo4j 系统数据。清空后需要重新执行导入命令。

## 测试

集成测试会清空并重建项目图谱，要求本地 Neo4j 正在运行：

```powershell
.\.venv\Scripts\python.exe -m pytest tests\neo4j -q
```

测试结束后数据库中保留当前 `data/import/` 对应的 65 个节点和 55 条关系，均为 `reviewed`。当前正式表包含 6 个 `Procedure` 节点和 5 条 `NEXT_STEP` 关系，可用于工序步骤查询。成员 D 的 60 个实体和 50 条关系已纳入正式表；成员 C 的 48 个实体和 47 条关系已完成修复，但因同名概念造成查询歧义暂不导入，提交目录仍保持 `draft`。
