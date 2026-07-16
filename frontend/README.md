# 铁路 PDF 知识图谱前端

基于 React、Vite 和 TypeScript 的中文前端。当前提供应用框架与 Neo4j 健康状态检查。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器会将 `/api` 与 `/health` 请求代理到 `http://127.0.0.1:8000`。

## 质量检查

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
