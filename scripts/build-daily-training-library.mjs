import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const outputDir = path.join(rootDir, "data", "daily-training-library");
const args = new Set(process.argv.slice(2));
const candidatesOnly = args.has("--candidates-only");
const generateLessons = args.has("--generate-lessons") && !candidatesOnly;
const targetPerLevel = numberArg("--target-per-level", 50);
const resultsPerQuery = numberArg("--results-per-query", 12);
const onlyLevel = stringArg("--level");

const levels = [
  {
    level: "IELTS 5.0",
    difficulty: "B1 / IELTS 5.0",
    minutes: [3, 7],
    topics: [
      "workplace self introduction",
      "daily small talk",
      "asking for help",
      "ordering food coffee",
      "making simple plans",
      "casual apology",
      "clarifying a point",
      "daily routine conversation",
      "reacting to good news",
      "basic customer service"
    ],
    sources: [
      "BBC Learning English English at Work",
      "VOA Learning English everyday English",
      "British Council LearnEnglish speaking",
      "TED-Ed English lesson",
      "English conversation for beginners official"
    ]
  },
  {
    level: "IELTS 5.5",
    difficulty: "B1+ / IELTS 5.5",
    minutes: [4, 8],
    topics: [
      "joining a new team",
      "weekend plans conversation",
      "polite requests",
      "handling a small mistake",
      "explaining a simple problem",
      "giving quick opinions",
      "booking travel conversation",
      "workplace phone calls",
      "talking about preferences",
      "short meeting updates"
    ],
    sources: [
      "BBC Learning English workplace English",
      "VOA Learning English conversation",
      "British Council LearnEnglish listening B1",
      "TED-Ed English subtitles",
      "business English conversation official"
    ]
  },
  {
    level: "IELTS 6.0",
    difficulty: "B2- / IELTS 6.0",
    minutes: [5, 10],
    topics: [
      "giving feedback at work",
      "negotiating schedules",
      "explaining priorities",
      "solving a customer issue",
      "talking about productivity",
      "disagreeing politely",
      "summarizing a short talk",
      "workplace culture",
      "travel problems",
      "money and budgeting"
    ],
    sources: [
      "BBC Learning English 6 Minute English",
      "VOA Learning English As It Is",
      "British Council LearnEnglish B2 listening",
      "TED-Ed business English",
      "BBC News Review Learning English"
    ]
  },
  {
    level: "IELTS 6.5",
    difficulty: "B2 / IELTS 6.5",
    minutes: [6, 12],
    topics: [
      "business decision making",
      "remote work discussion",
      "handling disagreement",
      "explaining trade offs",
      "team communication",
      "career development",
      "consumer behavior",
      "technology at work",
      "work life balance",
      "short news discussion"
    ],
    sources: [
      "BBC Learning English business English",
      "VOA Learning English news words",
      "British Council workplace communication",
      "TED-Ed business communication",
      "TED talk English subtitles business"
    ]
  },
  {
    level: "IELTS 7.0+",
    difficulty: "B2+ / IELTS 7.0+",
    minutes: [8, 18],
    topics: [
      "leadership communication",
      "presenting an argument",
      "innovation and society",
      "global business trends",
      "education and technology",
      "health and lifestyle debate",
      "media and misinformation",
      "climate and business",
      "complex problem solving",
      "culture and identity"
    ],
    sources: [
      "TED talk English subtitles",
      "BBC Learning English advanced listening",
      "VOA Learning English technology report",
      "British Council advanced English",
      "BBC ideas English"
    ]
  }
];

await fs.mkdir(outputDir, { recursive: true });
await loadDotEnvFile(path.join(rootDir, ".env.local"));

const selectedLevels = onlyLevel
  ? levels.filter((config) => config.level === onlyLevel)
  : levels;

for (const config of selectedLevels) {
  const candidates = await collectLevelCandidates(config);
  await writeJson(path.join(outputDir, `${levelToFile(config.level)}-videos.json`), candidates);

  console.log(`${config.level}: selected ${candidates.length}/${targetPerLevel} videos`);

  if (generateLessons) {
    const lessons = [];

    for (const candidate of candidates.filter((item) => item.transcriptSegments.length > 0)) {
      const lesson = await generateLesson(candidate);
      lessons.push(lesson);
      await writeJson(path.join(outputDir, `${candidate.id}.json`), lesson);
    }

    await writeJson(path.join(outputDir, `${levelToFile(config.level)}-lessons.json`), lessons);
  }
}

const allCandidates = [];

for (const config of levels) {
  allCandidates.push(
    ...(await readJsonArray(path.join(outputDir, `${levelToFile(config.level)}-videos.json`)))
  );
}

await writeJson(path.join(outputDir, "video-candidates.json"), allCandidates);
await writeJson(path.join(outputDir, "index.json"), {
  generatedAt: new Date().toISOString(),
  targetPerLevel,
  sourcePriority: ["YouTube", "BBC Learning English", "British Council", "VOA Learning English", "TED-Ed", "Bilibili"],
  levels: await Promise.all(
    levels.map(async (config) => ({
      level: config.level,
      videoFile: `${levelToFile(config.level)}-videos.json`,
      lessonFile: generateLessons ? `${levelToFile(config.level)}-lessons.json` : null,
      candidateCount: await countJsonArray(path.join(outputDir, `${levelToFile(config.level)}-videos.json`)),
      lessonCount: generateLessons
        ? await countJsonArray(path.join(outputDir, `${levelToFile(config.level)}-lessons.json`))
        : 0
    }))
  )
});

async function collectLevelCandidates(config) {
  const found = new Map();

  for (const source of config.sources) {
    if (found.size >= targetPerLevel) break;

    const results = await searchYoutube(`${source} English subtitles`);
    addResults(config, source, results, found);
  }

  for (const topic of config.topics) {
    if (found.size >= targetPerLevel) break;

    const source = config.sources[found.size % config.sources.length];
    const results = await searchYoutube(`${source} ${topic}`);
    addResults(config, topic, results, found);
  }

  for (const official of officialWebFallbacks(config)) {
    if (found.size >= targetPerLevel) break;
    found.set(official.key, official);
  }

  for (const fallback of bilibiliFallbacks(config)) {
    if (found.size >= targetPerLevel) break;
    found.set(fallback.key, fallback);
  }

  return [...found.values()]
    .sort((left, right) => scoreCandidate(right) - scoreCandidate(left))
    .slice(0, targetPerLevel)
    .map((candidate, index) => ({
      ...candidate,
      id: `${levelToFile(config.level)}-${String(index + 1).padStart(2, "0")}`
    }));
}

function addResults(config, focus, results, found) {
  for (const result of results) {
    if (found.size >= targetPerLevel) break;

    const candidate = toYoutubeCandidate(config, focus, result);

    if (candidate && !found.has(candidate.key)) {
      found.set(candidate.key, candidate);
    }
  }
}

async function searchYoutube(query) {
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      [
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        `ytsearch${resultsPerQuery}:${query}`
      ],
      {
        cwd: rootDir,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 12,
        timeout: 90000
      }
    );

    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    console.warn(`skip YouTube query "${query}": ${error.message}`);
    return [];
  }
}

function toYoutubeCandidate(config, focus, result) {
  const durationSeconds = Number(result.duration) || 0;
  const [minMinutes, maxMinutes] = config.minutes;

  if (durationSeconds < minMinutes * 60 || durationSeconds > maxMinutes * 60) {
    return null;
  }

  const text = `${result.title ?? ""} ${result.channel ?? ""} ${result.description ?? ""}`;

  if (/live|playlist|compilation|music|song|kids|cartoon|minecraft|reaction/i.test(text)) {
    return null;
  }

  const officialScore = scoreOfficialChannel(result);

  if (officialScore < 26) {
    return null;
  }

  const videoId = result.id;

  if (!videoId) {
    return null;
  }

  return {
    key: `youtube-${videoId}`,
    level: config.level,
    topic: toTitle(focus),
    title: cleanText(result.title),
    source: result.channel ? `YouTube · ${cleanText(result.channel)}` : "YouTube",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    videoId,
    playerType: "youtube",
    duration: formatDuration(durationSeconds),
    durationSeconds,
    difficulty: config.difficulty,
    focus: toTitle(focus),
    keywords: [
      focus,
      cleanText(result.channel ?? ""),
      cleanText(result.uploader ?? ""),
      "YouTube",
      "official media"
    ].filter(Boolean),
    whySuitable:
      "YouTube 优先来源，来自英语学习或官方媒体频道，适合在站内嵌入并使用播放器字幕。",
    transcriptSource: "unavailable",
    transcriptSegments: [],
    channel: cleanText(result.channel ?? ""),
    channelId: result.channel_id ?? "",
    thumbnail: result.thumbnails?.at?.(-1)?.url ?? "",
    viewCount: Number(result.view_count) || 0
  };
}

function officialWebFallbacks(config) {
  const providers = [
    {
      name: "BBC Learning English",
      url: "https://www.bbc.co.uk/learningenglish",
      keyword: "BBC Learning English"
    },
    {
      name: "British Council LearnEnglish",
      url: "https://learnenglish.britishcouncil.org/",
      keyword: "British Council LearnEnglish"
    },
    {
      name: "VOA Learning English",
      url: "https://learningenglish.voanews.com/",
      keyword: "VOA Learning English"
    },
    {
      name: "TED-Ed",
      url: "https://ed.ted.com/",
      keyword: "TED-Ed"
    }
  ];

  return config.topics.flatMap((topic) =>
    providers.map((provider) => ({
      key: `official-${levelToFile(config.level)}-${slugify(provider.name)}-${slugify(topic)}`,
      level: config.level,
      topic: toTitle(topic),
      title: `${toTitle(topic)} - ${provider.name}`,
      source: provider.name,
      url: `${provider.url}?q=${encodeURIComponent(topic)}`,
      playerType: "web",
      duration: `${config.minutes[0]}-${config.minutes[1]} min`,
      durationSeconds: config.minutes[0] * 60,
      difficulty: config.difficulty,
      focus: toTitle(topic),
      keywords: [provider.keyword, topic, "official website"],
      whySuitable: "官方媒体学习资源兜底入口；当 YouTube 候选不足时用于人工筛选补库。",
      transcriptSource: "unavailable",
      transcriptSegments: []
    }))
  );
}

function bilibiliFallbacks(config) {
  return config.topics.map((topic) => ({
    key: `bilibili-${levelToFile(config.level)}-${slugify(topic)}`,
    level: config.level,
    topic: toTitle(topic),
    title: `${toTitle(topic)} - Bilibili fallback`,
    source: "Bilibili",
    url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${topic} 英语听力 英文字幕`)}`,
    playerType: "web",
    duration: `${config.minutes[0]}-${config.minutes[1]} min`,
    durationSeconds: config.minutes[0] * 60,
    difficulty: config.difficulty,
    focus: toTitle(topic),
    keywords: [topic, "Bilibili", "fallback"],
    whySuitable: "最后兜底来源；仅在 YouTube 和官方媒体候选不足时使用。",
    transcriptSource: "unavailable",
    transcriptSegments: []
  }));
}

function scoreCandidate(candidate) {
  let score = 0;

  if (candidate.playerType === "youtube") score += 80;
  if (candidate.source.includes("BBC Learning English")) score += 35;
  if (candidate.source.includes("British Council")) score += 32;
  if (candidate.source.includes("VOA")) score += 30;
  if (candidate.source.includes("TED")) score += 28;
  if (candidate.source.includes("Bilibili")) score -= 80;
  if (candidate.viewCount > 100000) score += 8;
  if (candidate.durationSeconds >= 180 && candidate.durationSeconds <= 720) score += 8;

  return score;
}

function scoreOfficialChannel(result) {
  const channel = `${result.channel ?? result.uploader ?? ""}`.toLowerCase().trim();
  const text = `${result.channel ?? ""} ${result.uploader ?? ""} ${result.channel_id ?? ""}`.toLowerCase();

  if (text.includes("bbc learning english")) return 50;
  if (text.includes("voa learning english")) return 48;
  if (text.includes("british council")) return 46;
  if (channel === "ted-ed" || channel === "ted ed") return 44;
  if (channel === "ted" || channel === "tedx talks") return 38;
  if (text.includes("bbc world service")) return 36;
  if (text.includes("wall street journal") || text.includes("dw ")) return 30;

  return 0;
}

async function generateLesson(candidate) {
  const apiKey = process.env.API_KEY?.trim();

  if (!apiKey) {
    throw new Error("API_KEY is required for --generate-lessons.");
  }

  const baseUrl = (process.env.API_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.API_MODEL?.trim() || "deepseek-chat";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Generate strict JSON for a listening lesson. Use only verified transcriptSegments if provided. Do not invent transcript text."
        },
        {
          role: "user",
          content: JSON.stringify({ candidate })
        }
      ]
    })
  });
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;

  if (!response.ok || !content) {
    throw new Error(payload.error?.message || "AI lesson generation failed.");
  }

  return JSON.parse(content);
}

async function loadDotEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // Environment variables can also be provided by the shell or Vercel.
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJsonArray(filePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function countJsonArray(filePath) {
  return (await readJsonArray(filePath)).length;
}

function numberArg(name, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : NaN;

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function stringArg(name) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));

  return raw ? raw.slice(name.length + 1) : "";
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function levelToFile(level) {
  return level.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toTitle(value) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
