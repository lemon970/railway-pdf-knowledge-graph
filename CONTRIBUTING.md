# 协作规范

## 本节小结

每项工作先建 Issue，再从 `main` 创建短期分支，完成后通过 Pull Request 合并。任何人不得直接修改 `main`；AI 生成内容必须人工复核。

## 基本流程

```powershell
git switch main
git pull
git switch -c data/wheel-entities
# 完成修改
git add <本次修改的文件>
git commit -m "data: add reviewed wheel entities"
git push -u origin data/wheel-entities
```

随后在 GitHub 创建 Pull Request，并关联对应 Issue。

## 分支命名

- `docs/<内容>`：文档；
- `data/<内容>`：OCR、实体、关系或测试数据；
- `feature/<功能>`：系统功能；
- `fix/<问题>`：修复；
- `test/<内容>`：测试。

分支应在 1 至 3 天内完成并合并，合并后删除。

## 提交信息

```text
docs: 补充项目研究范围
data: 添加车轮实体初稿
fix: 修正限度值对应页码
feat: 添加Neo4j导入脚本
test: 增加缺陷处理类评测题
chore: 更新仓库配置
```

一次提交只处理一类工作。不要把格式整理、数据录入和功能开发混在同一提交中。

## Pull Request 验收

- 已关联 Issue；
- CSV 列名和状态值符合规范；
- 数值、单位、条件、术语和页码已人工核对；
- 没有原始 PDF、DOCX、密钥、个人信息或本地数据库；
- 至少指定一名复核人；
- 结构检查脚本通过。

