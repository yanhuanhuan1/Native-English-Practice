# Daily English Training 课程库流程

## 目标

把 Daily English Training 从“用户打开时实时找视频”改成“提前批量建库，网站运行时随机抽取”。

运行时只做两件事：

1. 用户选择等级。
2. 网站从对应等级的预制库里随机抽一条课程。

这样可以减少线上等待、减少 AI 调用失败，也不会把大量课程内容塞进浏览器 localStorage。

## 当前已落地

- 每个等级已生成 50 条 Bilibili 优先视频储备。
- 数据位置：`data/daily-training-library/`
- 网站抽取源：`data/dailyTrainingVideoLibrary.ts`
- 批量脚本：`scripts/build-daily-training-library.mjs`

等级文件：

- `ielts-5-0-videos.json`
- `ielts-5-5-videos.json`
- `ielts-6-0-videos.json`
- `ielts-6-5-videos.json`
- `ielts-7-0plus-videos.json`

## 批量重建视频库

只重建视频候选：

```bash
npm run build-training-candidates -- --target-per-level=50 --search-pages=5 --results-per-query=16
```

只重建某个等级：

```bash
npm run build-training-candidates -- "--level=IELTS 7.0+" --target-per-level=50 --search-pages=7 --results-per-query=24
```

## 完整课程包生成

完整课程包必须包含：

- 视频 URL
- embedUrl
- transcriptSegments
- learningItems
- dictation
- comprehension
- shadowing
- outputTask
- lessonReview

命令：

```bash
npm run build-training-library -- --generate-lessons --target-per-level=50
```

注意：脚本只会为有可提取字幕的视频生成完整课程。Bilibili 很多视频是画面硬字幕，接口拿不到逐句字幕，这类视频不能自动生成精听课程包。

## 字幕规则

可以用于完整精听课程的来源优先级：

1. Bilibili 官方/自动外挂字幕
2. 视频对应官方网页的英文 transcript
3. 人工补录并校对的 transcript
4. 服务端 ASR 转录后人工抽查

不能使用：

- AI 凭标题虚构的 transcript
- 与视频内容不一致的 transcript
- 只有画面硬字幕但无法提取时间轴的文本

## 推荐后续路线

第一步先使用当前 250 条真实视频 URL 作为储备。

第二步逐批补 transcript：

- 每次处理 10-20 条。
- 有字幕的自动生成完整课程。
- 无字幕但质量高的视频，人工或 ASR 补 transcript 后再生成。

第三步网站运行时优先读取完整课程包；如果课程包不存在，再退回到当前 AI 动态生成逻辑。
