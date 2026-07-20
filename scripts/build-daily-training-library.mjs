import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "data", "daily-training-library");
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Referer: "https://www.bilibili.com"
};

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62,
  11, 36, 20, 34, 44, 52
];

const levels = [
  {
    level: "IELTS 5.0",
    difficulty: "B1 / IELTS 5.0",
    minutes: [3, 7],
    topics: [
      "workplace self introduction",
      "daily small talk",
      "asking for help at work",
      "ordering coffee",
      "making simple plans",
      "casual apology",
      "clarifying a simple point",
      "daily routine conversation",
      "reacting to good news",
      "basic customer service"
    ],
    sources: [
      "BBC Learning English English at Work",
      "VOA Learning English everyday English",
      "British Council LearnEnglish A2 B1",
      "TED Ed short English lesson",
      "职场英语 英文字幕"
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
      "TED Ed English subtitles",
      "商务英语 听力 英文字幕"
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
      "TED Ed business English subtitles",
      "英语精听 B2 英文字幕"
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
      "TED Ed business communication",
      "雅思听力 6.5 英文字幕"
    ]
  },
  {
    level: "IELTS 7.0+",
    difficulty: "B2+ / IELTS 7.0+",
    minutes: [8, 15],
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
      "TED talk English subtitles business",
      "BBC Learning English advanced listening",
      "VOA Learning English technology report",
      "British Council advanced workplace English",
      "雅思口语 7分 英文字幕"
    ]
  }
];

const args = new Set(process.argv.slice(2));
const candidatesOnly = args.has("--candidates-only");
const generateLessons = args.has("--generate-lessons") && !candidatesOnly;
const targetPerLevel = numberArg("--target-per-level", 50);
const searchPages = numberArg("--search-pages", 2);
const resultsPerQuery = numberArg("--results-per-query", 10);
const onlyLevel = stringArg("--level");

await fs.mkdir(outputDir, { recursive: true });
await loadDotEnvFile(path.join(rootDir, ".env.local"));

const wbiKey = await getWbiMixinKey();
const allCandidates = [];
const allLessons = [];

const selectedLevels = onlyLevel
  ? levels.filter((config) => config.level === onlyLevel)
  : levels;

for (const config of selectedLevels) {
  const levelCandidates = await collectLevelCandidates(config);
  const selectedCandidates = levelCandidates.slice(0, targetPerLevel);
  allCandidates.push(...selectedCandidates);
  await writeJson(
    path.join(outputDir, `${levelToFile(config.level)}-videos.json`),
    selectedCandidates
  );

  console.log(
    `${config.level}: selected ${selectedCandidates.length}/${targetPerLevel} videos, ` +
      `${selectedCandidates.filter((item) => item.transcriptSegments.length > 0).length} with extractable subtitles`
  );

  if (generateLessons) {
    const lessons = [];

    for (const candidate of selectedCandidates) {
      if (!candidate.transcriptSegments.length) {
        continue;
      }

      const lesson = await generateLesson(candidate);
      lessons.push(lesson);
      await writeJson(path.join(outputDir, `${candidate.id}.json`), lesson);
    }

    allLessons.push(...lessons);
    await writeJson(path.join(outputDir, `${levelToFile(config.level)}-lessons.json`), lessons);
  }
}

await writeJson(path.join(outputDir, "video-candidates.json"), allCandidates);
await writeJson(
  path.join(outputDir, "index.json"),
  {
    generatedAt: new Date().toISOString(),
    targetPerLevel,
    levels: await buildIndexLevels(generateLessons)
  }
);

async function buildIndexLevels(includeLessons) {
  return Promise.all(
    levels.map(async (config) => ({
      level: config.level,
      videoFile: `${levelToFile(config.level)}-videos.json`,
      lessonFile: includeLessons ? `${levelToFile(config.level)}-lessons.json` : null,
      candidateCount: await countJsonArray(path.join(outputDir, `${levelToFile(config.level)}-videos.json`)),
      lessonCount: includeLessons
        ? await countJsonArray(path.join(outputDir, `${levelToFile(config.level)}-lessons.json`))
        : 0
    }))
  );
}

async function collectLevelCandidates(config) {
  const found = new Map();

  for (const topic of config.topics) {
    for (const source of config.sources) {
      if (found.size >= targetPerLevel * 2) {
        break;
      }

      const keyword = `${source} ${topic} 英文字幕 英语听力`;
      const results = await searchBilibili(keyword, searchPages);

      for (const result of results.slice(0, resultsPerQuery)) {
        const expanded = await expandVideoResult(config, topic, result);

        for (const candidate of expanded) {
          if (!found.has(candidate.key) && isUsefulCandidate(candidate, config)) {
            found.set(candidate.key, candidate);
          }

          if (found.size >= targetPerLevel * 2) {
            break;
          }
        }
      }

      await sleep(360);
    }
  }

  return [...found.values()]
    .filter(limitPagesPerBvid(10))
    .sort((left, right) => scoreCandidate(right) - scoreCandidate(left))
    .slice(0, targetPerLevel)
    .map((candidate, index) => ({
      ...candidate,
      id: `${levelToFile(config.level)}-${String(index + 1).padStart(2, "0")}`
    }));
}

async function searchBilibili(keyword, pages) {
  const results = [];

  for (let page = 1; page <= pages; page += 1) {
    const query = signWbi({
      search_type: "video",
      keyword,
      page
    });
    const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`;
    const data = await fetchJson(url).catch((error) => {
      console.warn(`skip search page: ${error.message}`);
      return null;
    });

    if (!data || data.code !== 0 || !Array.isArray(data.data?.result)) {
      continue;
    }

    results.push(...data.data.result.filter((item) => item?.bvid));
  }

  return results;
}

async function expandVideoResult(config, topic, result) {
  const bvid = result.bvid;
  const view = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`).catch(
    () => null
  );

  if (!view || view.code !== 0 || !Array.isArray(view.data?.pages)) {
    return [];
  }

  const pages = view.data.pages.slice(0, 20);
  const expanded = [];

  for (const page of pages) {
    const subtitleResult = await fetchTranscript(bvid, page.cid);
    const pageNo = page.page ?? 1;
    const title = cleanText(view.data.title);
    const part = cleanText(page.part ?? "");
    const durationSeconds = page.duration ?? result.duration ?? 0;

    expanded.push({
      key: `${bvid}-${pageNo}`,
      level: config.level,
      topic: toTitle(topic),
      title: part ? `${title} - ${part}` : title,
      source: "Bilibili",
      url: `https://www.bilibili.com/video/${bvid}${pageNo > 1 ? `?p=${pageNo}` : ""}`,
      embedUrl: `https://player.bilibili.com/player.html?bvid=${bvid}&page=${pageNo}&autoplay=0`,
      bvid,
      cid: page.cid,
      page: pageNo,
      playerType: "bilibili",
      duration: formatDuration(durationSeconds),
      durationSeconds,
      difficulty: config.difficulty,
      focus: toTitle(topic),
      keywords: [topic, cleanText(result.title ?? ""), cleanText(result.tag ?? "")].filter(Boolean),
      whySuitable: "Bilibili 可播放候选；如含外挂字幕，可直接生成逐句精听课程。",
      transcriptSource: subtitleResult.segments.length ? subtitleResult.source : "unavailable",
      transcriptSegments: subtitleResult.segments
    });
  }

  return expanded;
}

async function fetchTranscript(bvid, cid) {
  const player = await fetchJson(
    `https://api.bilibili.com/x/player/wbi/v2?${signWbi({ bvid, cid })}`
  ).catch(() => null);
  const subtitles = player?.data?.subtitle?.subtitles;

  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return { source: "unavailable", segments: [] };
  }

  const preferred =
    subtitles.find((item) => /en|eng|英语|英文/i.test(`${item.lan} ${item.lan_doc}`)) ??
    subtitles[0];
  const subtitleUrl = normalizeUrl(preferred.subtitle_url);

  if (!subtitleUrl) {
    return { source: "unavailable", segments: [] };
  }

  const subtitle = await fetchJson(subtitleUrl);
  const body = Array.isArray(subtitle.body) ? subtitle.body : [];

  return {
    source: preferred.type === 1 ? "official" : "auto",
    segments: body
      .filter((item) => typeof item.content === "string" && item.content.trim())
      .slice(0, 80)
      .map((item, index) => ({
        id: `segment-${index + 1}`,
        startTime: Number(item.from) || index * 6,
        endTime: Number(item.to) || Number(item.from) + 5 || index * 6 + 5,
        speaker: "Speaker",
        text: cleanText(item.content),
        translation: "",
        vocabularyIds: [],
        expressionIds: [],
        markedUnclear: false,
        completed: false
      }))
  };
}

async function generateLesson(candidate) {
  const apiKey = process.env.API_KEY?.trim();

  if (!apiKey) {
    throw new Error("API_KEY is required for --generate-lessons.");
  }

  const baseUrl = (process.env.API_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.API_MODEL?.trim() || "deepseek-chat";
  const messages = [
    {
      role: "system",
      content:
        "You generate strict JSON for an English listening lesson. Use only the provided transcript. Do not invent video facts. Chinese feedback, English examples."
    },
    {
      role: "user",
      content: JSON.stringify({
        task:
          "Create learningItems, dictation, comprehension, shadowing, outputTask, lessonReview for this video. Return one DailyTraining JSON object.",
        candidate,
        required:
          "6-10 learningItems from transcript, 3-5 dictation segmentIds, 2-3 comprehension questions, one 30-60 second speaking output task."
      })
    }
  ];
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;

  if (!response.ok || !content) {
    throw new Error(payload.error?.message || "AI lesson generation failed.");
  }

  return JSON.parse(content);
}

function isUsefulCandidate(candidate, config) {
  const [minMinutes, maxMinutes] = config.minutes;
  const minSeconds = minMinutes * 60;
  const maxSeconds = maxMinutes * 60;
  const text = `${candidate.title} ${candidate.keywords.join(" ")}`.toLowerCase();

  if (candidate.durationSeconds < minSeconds || candidate.durationSeconds > maxSeconds * 1.8) {
    return false;
  }

  if (/纯音乐|伴奏|直播|reaction|游戏|解说/i.test(text)) {
    return false;
  }

  return /english|英语|bbc|voa|ted|ielts|雅思|听力|口语|字幕/i.test(text);
}

function scoreCandidate(candidate) {
  const text = `${candidate.title} ${candidate.keywords.join(" ")}`.toLowerCase();
  let score = 0;

  if (candidate.transcriptSegments.length) score += 100;
  if (/bbc|voa|ted|british council/i.test(text)) score += 20;
  if (/英文字幕|英语字幕|字幕|cc/i.test(text)) score += 12;
  if (/听力|口语|conversation|work|business/i.test(text)) score += 10;
  if (candidate.durationSeconds >= 180 && candidate.durationSeconds <= 900) score += 8;

  return score;
}

function limitPagesPerBvid(maxPages) {
  const counts = new Map();

  return (candidate) => {
    const count = counts.get(candidate.bvid) ?? 0;

    if (count >= maxPages) {
      return false;
    }

    counts.set(candidate.bvid, count + 1);
    return true;
  };
}

async function getWbiMixinKey() {
  const nav = await fetchJson("https://api.bilibili.com/x/web-interface/nav");
  const imgKey = nav.data?.wbi_img?.img_url?.split("/").pop()?.split(".")[0];
  const subKey = nav.data?.wbi_img?.sub_url?.split("/").pop()?.split(".")[0];

  if (!imgKey || !subKey) {
    throw new Error("Unable to resolve Bilibili WBI key.");
  }

  const original = `${imgKey}${subKey}`;
  return mixinKeyEncTab.map((index) => original[index]).join("").slice(0, 32);
}

function signWbi(params) {
  const filtered = /[!'()*]/g;
  const withTimestamp = {
    ...params,
    wts: Math.round(Date.now() / 1000)
  };
  const query = Object.keys(withTimestamp)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(withTimestamp[key]).replace(filtered, ""))}`
    )
    .join("&");
  const wRid = crypto.createHash("md5").update(query + wbiKey).digest("hex");

  return `${query}&w_rid=${wRid}`;
}

async function fetchJson(url) {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, { headers });
    lastStatus = response.status;

    if (response.ok) {
      return response.json();
    }

    if (![412, 429, 500, 502, 503].includes(response.status)) {
      break;
    }

    await sleep(600 * attempt);
  }

  throw new Error(`HTTP ${lastStatus} for ${url}`);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function numberArg(name, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : NaN;

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function stringArg(name) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));

  return raw ? raw.slice(name.length + 1) : "";
}

async function countJsonArray(filePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));

    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.startsWith("//") ? `https:${value}` : value;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function levelToFile(level) {
  return level.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toTitle(value) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
