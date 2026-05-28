# 英语口语化跟练

这是一个本地优先、但 AI 由服务端统一提供的英语口语化练习网站。
用户先选难度，再看中文场景提示，输入自己会自然说出口的英文，提交后拿到 AI 评分和更地道的说法。

## 现在的运行方式

- 界面里不再提供 API 配置入口。
- AI 只读取服务器环境变量里的 `API_KEY`、`API_PROVIDER_ID`、`API_MODEL`、`API_BASE_URL`。
- 你可以在本地开发时使用 `.env.local`，线上部署时使用 Vercel 环境变量。

## 本地开发

1. 安装依赖

```powershell
npm.cmd install
```

2. 创建 `.env.local`

把下面这些环境变量填进去：

```env
API_KEY=your_api_key_here
API_PROVIDER_ID=deepseek
API_MODEL=deepseek-chat
API_BASE_URL=
```

3. 启动开发服务器

```powershell
npm.cmd run dev
```

4. 打开浏览器

访问 `http://127.0.0.1:3000`

你也可以直接双击仓库里的启动脚本：

- `启动口语跟练.cmd`
- `启动口语跟练.vbs`

## 部署到 Vercel

1. 把代码推到 GitHub。
2. 在 Vercel 导入这个仓库。
3. 在 Vercel 的 Project Settings -> Environment Variables 里配置：
   - `API_KEY`
   - `API_PROVIDER_ID`
   - `API_MODEL`
   - `API_BASE_URL`
4. 部署完成后直接使用网站即可。

## 说明

- 这是一个口语表达练习工具，不是语法刷题工具。
- 评分会更偏向真实对话里的自然度、语气、口语感和实用性。
- 如果服务器没有配置 `API_KEY`，页面会提示你先去 Vercel 配置环境变量。
