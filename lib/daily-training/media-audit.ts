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
    title: "04 Do you work in an English environment - BBC Learning English",
    source: "Bilibili / BBC Learning English",
    url: "https://www.bilibili.com/video/BV1y54y1S7A4/",
    embedUrl: "https://player.bilibili.com/player.html?bvid=BV1y54y1S7A4&page=1&autoplay=0",
    level: "A2-B1",
    duration: "about 3 minutes",
    playerType: "bilibili",
    whySuitable: "Bilibili source with BBC Learning English workplace content; suitable for short spoken workplace input."
  },
  {
    title: "BBC Learning English collection",
    source: "Bilibili / BBC Learning English",
    url: "https://www.bilibili.com/video/BV1AE411G7hd/",
    embedUrl: "https://player.bilibili.com/player.html?bvid=BV1AE411G7hd&page=1&autoplay=0",
    level: "A2-B1",
    duration: "short episodes",
    playerType: "bilibili",
    whySuitable: "Large Bilibili collection of short BBC Learning English clips for repeated listening practice."
  },
  {
    title: "Daily English Dictation",
    source: "Bilibili / Daily English Dictation",
    url: "https://www.bilibili.com/video/BV1U7411a7xG/",
    embedUrl: "https://player.bilibili.com/player.html?bvid=BV1U7411a7xG&page=1&autoplay=0",
    level: "A2-B1",
    duration: "short episodes",
    playerType: "bilibili",
    whySuitable: "Bilibili listening practice series with clear daily English input."
  }
];

export async function auditDailyTrainingMedia(training: DailyTraining): Promise<DailyTraining> {
  const auditedResource = await auditListeningResource(training.listening.resource);

  return {
    ...training,
    listening: {
      ...training.listening,
      resource: auditedResource
    }
  };
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
        whySuitable: `${validFallback.whySuitable} The original AI resource did not pass playback validation, so it was replaced with a verified Bilibili resource.`
      };
    }
  }

  return {
    title: "Bilibili English learning search",
    source: "Bilibili",
    url: "https://search.bilibili.com/all?keyword=BBC%20Learning%20English",
    level: "IELTS 5.0-6.0",
    duration: "5 minutes",
    playerType: "web",
    whySuitable: "No verified embeddable video was available, so the module falls back to a Bilibili search page."
  };
}

async function validateListeningResource(
  resource: ListeningResource
): Promise<ListeningResource | null> {
  if (resource.playerType === "bilibili" || extractBilibiliId(resource.embedUrl ?? resource.url)) {
    return validateBilibiliResource(resource);
  }

  if (resource.playerType === "audio" && resource.audioUrl) {
    return (await isReachableMedia(resource.audioUrl)) ? resource : null;
  }

  if (resource.playerType === "web") {
    return (await isUsableWebPage(resource.url)) ? resource : null;
  }

  // YouTube is not accepted as the core listening source for China-facing training.
  return null;
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

function formatDuration(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds)) {
    return undefined;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minutes`;
}
