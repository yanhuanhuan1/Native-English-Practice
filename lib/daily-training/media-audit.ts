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
