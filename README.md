# 英语口语化跟练

这是一个本地优先的英语口语表达练习网页应用。目标不是练语法题，也不是写作文，而是把中文脑子里的表达换成更本土、更像真人会说出口的英文。

## 当前练习流程

1. 选择难度：入门、进阶、高阶。
2. AI 生成一个真实生活对话场景。
3. 进入输入界面，只输入一句你会自然说出口的英文。
4. 提交后进入评分界面，看 AI 给出的口语化反馈、更自然版本和替代表达。
5. 评分页会自动预加载下一句场景，点击“再来一句”时会直接进入下一题。

输入快捷键：

- `Enter`：提交
- `Ctrl + 空格`：在光标处换行

评分逻辑强调：

- 不按书面英语、作文、商务邮件标准评分。
- 允许口语碎片、省略、缩写、语法小瑕疵。
- 允许脏话和 slang，重点判断是否符合关系、场景和语气。
- 不因为缺少主语、冠词、词缀、单复数或小 tense 错误就重罚。
- 强烈惩罚中式直译、书面腔、过度礼貌、像邮件一样的表达。

## 词汇高亮

结果页会对更自然版本、替代表达、关键短语里的词汇做高亮：

- CET4 / CET6：同一种蓝色。
- IELTS：金色。

鼠标悬浮或键盘聚焦到高亮单词时，会显示：

- 词汇标签
- 音标
- 中文释义
- 当前句子作为例句

词库文件在 `data/vocab/`，当前使用开源 Qwerty Learner 词库中的 CET4、CET6、IELTS 数据。

## 双击启动

项目根目录里有几个可双击文件：

- `启动口语跟练.cmd`
- `启动口语跟练.vbs`
- `start-app.cmd`
- `start-app.vbs`

推荐直接双击 `启动口语跟练.cmd` 或 `start-app.cmd`。它会：

1. 进入当前项目目录。
2. 如果还没有安装依赖，自动运行 `npm.cmd install`。
3. 启动本地开发服务。
4. 打开 `http://127.0.0.1:3000`。

如果 3000 端口已经有服务在运行，脚本会直接打开浏览器。

## 手动运行

安装依赖：

```powershell
npm.cmd install
```

启动应用：

```powershell
npm.cmd run dev
```

然后打开：

```text
http://127.0.0.1:3000
```

## API Key 设置

使用 DeepSeek API，在右上角设置里填写 API Key，或在服务端配置 `API_KEY` 环境变量。


## 自动识别实际请求地址

设置里的“接口地址”可以填两种形式：

```text
https://api.example.com/v1
```

或完整 endpoint：

```text
https://api.example.com/v1/chat/completions
```

应用会自动识别，不会重复拼接 `/chat/completions`。Claude 的 `/messages` 也会自动识别。

如果你把接口地址填成 OpenRouter、硅基流动、火山方舟、魔搭、Together、Groq、Anthropic、Gemini、DeepSeek 等常见域名，应用会尽量自动推断正确协议和实际请求位置。

## 默认模型

默认使用 **千问 / 阿里云百炼**，模型为 `qwen-plus`。

主要预设模型：

- 千问：`qwen-plus`
- 智谱：`glm-5.1`
- Gemini：`gemini-2.5-flash`
- Claude：`claude-sonnet-4-20250514`
- DeepSeek：`deepseek-v4-flash`
- OpenAI：`gpt-5-mini`
- OpenRouter：`qwen/qwen3-235b-a22b-2507`
- 硅基流动：`Qwen/Qwen3-235B-A22B-Instruct-2507`

这些默认模型都可以在设置里手动改。

## 本地优先

MVP 阶段设置只保存在浏览器 `localStorage` 里。API Key 不会写死在代码里，也不会放进仓库文件。评分或生成新场景时，浏览器只会把 API Key 发给本机的 Next.js API 路由。

## 修改 AI 服务商配置

默认配置在 [`lib/ai/config.ts`](lib/ai/config.ts)：

- `AI_PROVIDER_PRESETS`
- `defaultProviderId`
- `requestTimeoutMs`

## 验证命令

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```
