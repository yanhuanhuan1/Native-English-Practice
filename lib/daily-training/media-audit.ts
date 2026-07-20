import type { DailyTraining, ListeningResource } from "@/types/daily-training";

interface YoutubeOEmbedResponse {
  title?: string;
  author_name?: string;
}

const requestTimeoutMs = 8_000;

const fallbackListeningResources: ListeningResource[] = [
  {
    title: "Introduce yourself and make some friends - 04 - English at Work",
    source: "BBC Learning English",
    url: "https://www.youtube.com/watch?v=1AmS9h8g3E4",
    embedUrl: "https://www.youtube.com/embed/1AmS9h8g3E4",
    level: "A2-B1",
    duration: "约 4 分钟",
    playerType: "youtube",
    whySuitable: "BBC Learning English 官方视频，适合练习职场自我介绍和寒暄表达。"
  },
  {
    title: "How to introduce yourself: Easy English Conversations Episode 1",
    source: "BBC Learning English",
    url: "https://www.youtube.com/watch?v=I_tRSrPru94",
    embedUrl: "https://www.youtube.com/embed/I_tRSrPru94",
    level: "A2-B1",
    duration: "约 6 分钟",
    playerType: "youtube",
    whySuitable: "BBC Learning English 官方对话视频，语速清楚，适合入门阶段做真实口语输入。"
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
        whySuitable: `${validFallback.whySuitable} 原 AI 资源未通过有效性审核，已自动切换到可播放备用资源。`
      };
    }
  }

  return {
    title: "VOA Learning English",
    source: "VOA Learning English",
    url: "https://learningenglish.voanews.com/",
    level: "IELTS 5.0-6.0",
    duration: "5 分钟",
    playerType: "web",
    whySuitable: "没有找到可嵌入播放的视频时，自动降级到稳定的学习资源首页。"
  };
}

async function validateListeningResource(
  resource: ListeningResource
): Promise<ListeningResource | null> {
  if (resource.playerType === "youtube" || resource.embedUrl?.includes("youtube.com/embed")) {
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

async function validateYoutubeResource(
  resource: ListeningResource
): Promise<ListeningResource | null> {
  const videoId = extractYoutubeId(resource.embedUrl ?? resource.url);

  if (!videoId) {
    return null;
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl
  )}&format=json`;
  const result = await fetchJson<YoutubeOEmbedResponse>(oEmbedUrl);

  if (!result) {
    return null;
  }

  return {
    ...resource,
    title: result.title?.trim() || resource.title,
    source: result.author_name?.trim() || resource.source,
    url: watchUrl,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    playerType: "youtube"
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
  const response = await fetchWithTimeout(url);

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

function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "") || null;
    }

    if (parsed.pathname.includes("/embed/")) {
      return parsed.pathname.split("/embed/")[1]?.split(/[/?#]/)[0] ?? null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }

  return null;
}
