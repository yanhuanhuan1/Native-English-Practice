import type { DailyTraining, ListeningResource } from "@/types/daily-training";

interface BilibiliViewResponse {
  code?: number;
  message?: string;
  data?: {
    bvid?: string;
    title?: string;
    duration?: number;
    owner?: {
      name?: string;
    };
  };
}

const requestTimeoutMs = 8_000;

const fallbackListeningResources: ListeningResource[] = [
  {
    title: "How to prepare for an interview - English at Work",
    source: "YouTube / BBC Learning English",
    url: "https://www.youtube.com/watch?v=KN2jyw6D1ak",
    embedUrl: "https://www.youtube.com/embed/KN2jyw6D1ak",
    level: "A2-B1",
    duration: "about 3 minutes",
    playerType: "youtube",
    whySuitable: "BBC Learning English workplace content; suitable for short spoken workplace input."
  },
  {
    title: "Introduce yourself and make some friends - English at Work",
    source: "YouTube / BBC Learning English",
    url: "https://www.youtube.com/watch?v=1AmS9h8g3E4",
    embedUrl: "https://www.youtube.com/embed/1AmS9h8g3E4",
    level: "A2-B1",
    duration: "about 4 minutes",
    playerType: "youtube",
    whySuitable: "Short BBC Learning English workplace clip for repeated listening practice."
  },
  {
    title: "BBC Learning English 6 Minute English",
    source: "YouTube / BBC Learning English",
    url: "https://www.youtube.com/@bbclearningenglish/search?query=6%20Minute%20English",
    level: "B1-B2",
    duration: "short episodes",
    playerType: "web",
    whySuitable: "Official BBC Learning English channel search for short listening practice."
  }
];

export async function auditDailyTrainingMedia(training: DailyTraining): Promise<DailyTraining> {
  const originalResource = training.listening.resource;
  const auditedResource = await auditListeningResource(training.listening.resource);
  const resourceChanged = !isSamePlayableResource(originalResource.url, auditedResource.url);

  const auditedTraining = {
    ...training,
    listening: {
      ...training.listening,
      resource: auditedResource
    }
  };

  return resourceChanged ? rebuildLessonForAuditedResource(auditedTraining) : auditedTraining;
}

async function auditListeningResource(resource: ListeningResource): Promise<ListeningResource> {
  const validResource = await validateListeningResource(resource);

  if (validResource) {
    return validResource;
  }

  for (const fallback of fallbackListeningResources) {
    const validFallback = await validateListeningResource(fallback);

    if (validFallback) {
      return {
        ...validFallback,
        whySuitable: `${validFallback.whySuitable} The original AI resource did not pass playback validation, so it was replaced with a verified YouTube or official media resource.`
      };
    }
  }

  return {
    title: "BBC Learning English official channel",
    source: "YouTube / BBC Learning English",
    url: "https://www.youtube.com/@bbclearningenglish",
    level: "IELTS 5.0-6.0",
    duration: "5 minutes",
    playerType: "web",
    whySuitable: "No verified embeddable video was available, so the module falls back to an official YouTube channel page."
  };
}

async function validateListeningResource(
  resource: ListeningResource
): Promise<ListeningResource | null> {
  if (resource.playerType === "bilibili" || extractBilibiliId(resource.embedUrl ?? resource.url)) {
    return validateBilibiliResource(resource);
  }

  if (resource.playerType === "youtube" || extractYoutubeId(resource.embedUrl ?? resource.url)) {
    return validateYoutubeResource(resource);
  }

  if (resource.playerType === "audio" && resource.audioUrl) {
    return (await isReachableMedia(resource.audioUrl)) ? resource : null;
  }

  if (resource.playerType === "web") {
    return (await isUsableWebPage(resource.url)) ? resource : null;
  }

  return null;
}

function validateYoutubeResource(resource: ListeningResource): ListeningResource | null {
  const videoId = extractYoutubeId(resource.embedUrl ?? resource.url);

  if (!videoId) {
    return null;
  }

  return {
    ...resource,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    playerType: "youtube"
  };
}

function rebuildLessonForAuditedResource(training: DailyTraining): DailyTraining {
  const resource = training.listening.resource;
  const learningItems = buildResourceLearningItems(resource, training.level);

  return {
    ...training,
    topic: resource.title,
    transcriptSource: "unavailable",
    transcriptSegments: [],
    learningItems,
    dictation: [],
    comprehension: [],
    shadowing: {
      segmentIds: [],
      recordings: {},
      completed: false
    },
    outputTask: {
      prompt: `看完这个视频后，用 30-60 秒复述你听懂的内容，并尽量用上：${learningItems
        .slice(0, 3)
        .map((item) => item.text)
        .join(" / ")}。`,
      requiredItemIds: learningItems.slice(0, 3).map((item) => item.id),
      completed: false
    },
    lessonReview: {
      expressions: learningItems.slice(0, 3).map((item) => item.text),
      soundIssues: ["注意视频里的弱读和连读", "跟读时模仿停顿和语调"],
      reviewSentence: learningItems[0]?.reusableExample ?? "Summarize the video in your own words.",
      addedToReview: false
    },
    completed: false
  };
}

function buildResourceLearningItems(
  resource: ListeningResource,
  level: DailyTraining["level"]
): DailyTraining["learningItems"] {
  const topic = inferTopic(resource.title);
  const levelLabel = typeof level === "string" ? level : "IELTS 5.0";
  const templates = [
    {
      type: "expression" as const,
      text: `talk through ${topic}`,
      meaning: "把一个话题或事情讲清楚",
      sourceSentence: `Let me talk through ${topic} in a simple way.`,
      collocations: ["talk through a plan", "talk through an idea"]
    },
    {
      type: "expression" as const,
      text: `the main point is`,
      meaning: "重点是……",
      sourceSentence: `The main point is that this topic is useful in real conversation.`,
      collocations: ["the main point is", "get the main point"]
    },
    {
      type: "vocabulary" as const,
      text: "pick up",
      meaning: "通过听和接触慢慢学会",
      sourceSentence: `Try to pick up useful phrases while watching the video.`,
      collocations: ["pick up a phrase", "pick up natural English"]
    },
    {
      type: "connectedSpeech" as const,
      text: "want to",
      meaning: "自然语速里常弱读成 wanna",
      sourceSentence: `You may want to replay short parts and shadow them.`,
      collocations: ["want to know", "want to try"]
    },
    {
      type: "expression" as const,
      text: "in a real situation",
      meaning: "在真实场景里",
      sourceSentence: `Use the expressions in a real situation, not just as isolated words.`,
      collocations: ["use it in a real situation", "say it in a real situation"]
    },
    {
      type: "pronunciation" as const,
      text: "listen for weak forms",
      meaning: "留意弱读形式",
      sourceSentence: `Listen for weak forms instead of trying to catch every word equally.`,
      collocations: ["listen for details", "listen for weak forms"]
    }
  ];

  return templates.map((item, index) => ({
    id: `${slugifyResource(resource.url || resource.title)}-item-${index + 1}`,
    type: item.type,
    text: item.text,
    meaning: item.meaning,
    pronunciation: "放进完整句子里听和跟读，注意自然重音。",
    sourceSentence: item.sourceSentence,
    sourceStartTime: 0,
    collocations: item.collocations,
    reusableExample: item.sourceSentence,
    level: levelLabel,
    saved: false,
    mastery: "unknown"
  }));
}

function inferTopic(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !["english", "learning", "video", "lesson"].includes(word))
    .slice(0, 3);

  return words.length ? words.join(" ") : "this topic";
}

function isSamePlayableResource(left: string, right: string): boolean {
  const leftYoutubeId = extractYoutubeId(left);
  const rightYoutubeId = extractYoutubeId(right);

  if (leftYoutubeId || rightYoutubeId) {
    return leftYoutubeId === rightYoutubeId;
  }

  const leftBilibiliId = extractBilibiliId(left);
  const rightBilibiliId = extractBilibiliId(right);

  if (leftBilibiliId || rightBilibiliId) {
    return leftBilibiliId === rightBilibiliId;
  }

  return normalizeUrl(left) === normalizeUrl(right);
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim();
  }
}

function slugifyResource(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "daily-training";
}

async function validateBilibiliResource(
  resource: ListeningResource
): Promise<ListeningResource | null> {
  const bvid = extractBilibiliId(resource.embedUrl ?? resource.url);

  if (!bvid) {
    return null;
  }

  const result = await fetchJson<BilibiliViewResponse>(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`
  );

  if (result?.code !== 0 || !result.data?.bvid || !result.data.title) {
    return null;
  }

  const embedUrl = `https://player.bilibili.com/player.html?bvid=${result.data.bvid}&page=1&autoplay=0`;

  if (!(await isReachableEmbed(embedUrl))) {
    return null;
  }

  return {
    ...resource,
    title: result.data.title.trim(),
    source: result.data.owner?.name
      ? `Bilibili / ${result.data.owner.name}`
      : resource.source || "Bilibili",
    url: `https://www.bilibili.com/video/${result.data.bvid}/`,
    embedUrl,
    duration: formatDuration(result.data.duration) ?? resource.duration,
    playerType: "bilibili"
  };
}

async function isReachableMedia(url: string): Promise<boolean> {
  const response = await fetchWithTimeout(url, {
    headers: { Range: "bytes=0-1023" }
  });

  if (!response?.ok && response?.status !== 206) {
    return false;
  }

  const contentType = response.headers.get("content-type") ?? "";
  return /audio|mpeg|mp3|mp4|octet-stream/i.test(contentType);
}

async function isReachableEmbed(url: string): Promise<boolean> {
  const response = await fetchWithTimeout(url);

  if (!response?.ok) {
    return false;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const html = (await response.text()).slice(0, 12_000).toLowerCase();

  return contentType.includes("text/html") && html.includes("bilibili");
}

async function isUsableWebPage(url: string): Promise<boolean> {
  const response = await fetchWithTimeout(url);

  if (!response?.ok) {
    return false;
  }

  const xFrameOptions = response.headers.get("x-frame-options")?.toLowerCase() ?? "";
  const csp = response.headers.get("content-security-policy")?.toLowerCase() ?? "";

  if (xFrameOptions.includes("deny") || xFrameOptions.includes("sameorigin")) {
    return false;
  }

  if (csp.includes("frame-ancestors") && !csp.includes("*")) {
    return false;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    return false;
  }

  const text = (await response.text()).slice(0, 20_000).toLowerCase();

  return ![
    "page not found",
    "404",
    "not found",
    "页面未找到",
    "您请求的页面不可用或已移动",
    "this video is unavailable",
    "video unavailable",
    "此视频不能观看",
    "video cannot be played"
  ].some((pattern) => text.includes(pattern));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response?.ok) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractBilibiliId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("bvid");

    if (fromQuery?.startsWith("BV")) {
      return fromQuery;
    }

    const match = parsed.pathname.match(/BV[a-zA-Z0-9]+/);
    return match?.[0] ?? null;
  } catch {
    const match = url.match(/BV[a-zA-Z0-9]+/);
    return match?.[0] ?? null;
  }
}

function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] ?? null;
      }

      return parsed.searchParams.get("v");
    }
  } catch {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
    return match?.[1] ?? null;
  }

  return null;
}

function formatDuration(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds)) {
    return undefined;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minutes`;
}
