import type { ChatMessage } from "@/lib/ai/config";
import type { DailyTrainingHistorySummary } from "@/types/daily-training";

interface BuildDailyTrainingMessagesArgs {
  date: string;
  dayNumber: number;
  historySummary: DailyTrainingHistorySummary;
}

export function buildDailyTrainingMessages({
  date,
  dayNumber,
  historySummary
}: BuildDailyTrainingMessagesArgs): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are designing a daily English listening training lesson for a Chinese learner.",
        "The learner is CET6-ish in reading, weak in listening and speaking, and currently needs IELTS 5.0-6.0 input.",
        "The product is not a textbook page. It is an interactive listening tool.",
        "",
        "Core workflow:",
        "Watch -> synchronized transcript -> mark unclear sentences -> dictation -> learn useful items -> shadowing -> one output task -> complete lesson.",
        "",
        "Resource rules:",
        "- Prefer Bilibili embeddable videos for China-based users.",
        "- Use public Bilibili videos related to BBC Learning English, TED/TED-Ed, VOA, workplace spoken English, daily conversation, or clear listening practice.",
        "- Provide a valid normal Bilibili video URL and an embed URL like https://player.bilibili.com/player.html?bvid=BV...&page=1&autoplay=0.",
        "- YouTube is a last fallback only.",
        "- Do not use dead pages, moved pages, private videos, non-embeddable videos, or old BBC Chinese paths.",
        "",
        "Transcript rules:",
        "- Provide transcriptSegments only when you have real transcript/subtitle text from the selected resource or visible source data.",
        "- Do not invent a fake transcript unrelated to the video.",
        "- Split transcript by speaker turn or sentence with startTime/endTime in seconds.",
        "- If no reliable transcript is available, set transcriptSource to unavailable and return empty transcriptSegments.",
        "",
        "Learning item rules:",
        "- Extract useful items from the transcript, not random words.",
        "- Prefer reusable expressions, workplace collocations, connected speech, weak forms, and useful vocabulary slightly above the learner's level.",
        "- Avoid names, places, rare proper nouns, isolated basic words, and low-reuse trivia.",
        "",
        "Return strict JSON only. Keep UI-facing explanations in Simplified Chinese."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Generate one Daily English Training lesson for ${date}.`,
        `Day number: ${dayNumber}.`,
        buildPhaseRule(dayNumber),
        "",
        "Recent state:",
        JSON.stringify(historySummary, null, 2),
        "",
        "Return exactly this JSON shape:",
        `{
  "date": "YYYY-MM-DD",
  "dayNumber": number,
  "level": "IELTS 5.0-6.0",
  "phase": "phase1-foundation",
  "topic": string,
  "listening": {
    "resource": {
      "title": string,
      "source": string,
      "url": string,
      "embedUrl": string,
      "audioUrl": string,
      "level": "B1 / IELTS 5.0-5.5",
      "duration": string,
      "playerType": "bilibili" | "youtube" | "audio" | "web",
      "whySuitable": string
    },
    "transcript": string
  },
  "transcriptSource": "official" | "auto" | "asr" | "unavailable",
  "transcriptSegments": [
    {
      "id": string,
      "startTime": number,
      "endTime": number,
      "speaker": string,
      "text": string,
      "translation": string,
      "vocabularyIds": [string],
      "expressionIds": [string],
      "markedUnclear": false,
      "completed": false
    }
  ],
  "learningItems": [
    {
      "id": string,
      "type": "vocabulary" | "expression" | "pronunciation" | "connectedSpeech",
      "text": string,
      "meaning": string,
      "pronunciation": string,
      "sourceSentence": string,
      "sourceStartTime": number,
      "collocations": [string],
      "reusableExample": string,
      "level": string,
      "saved": false,
      "mastery": "unknown"
    }
  ],
  "dictation": [
    {
      "segmentId": string,
      "userAnswer": "",
      "correctText": string,
      "missingWords": [],
      "incorrectWords": [],
      "completed": false,
      "hint": string
    }
  ],
  "comprehension": [
    {
      "id": string,
      "type": "mainIdea" | "relationship" | "keyInfo" | "meaning",
      "question": string,
      "options": [string],
      "answer": string,
      "explanation": string,
      "completed": false
    }
  ],
  "shadowing": {
    "segmentIds": [string],
    "recordings": {},
    "completed": false
  },
  "outputTask": {
    "prompt": string,
    "requiredItemIds": [string],
    "completed": false
  },
  "lessonReview": {
    "expressions": [string],
    "soundIssues": [string],
    "reviewSentence": string,
    "addedToReview": false
  },
  "completed": false
}`,
        "",
        "Quality requirements:",
        "- transcriptSegments should include the full usable transcript for the selected clip, ideally 8-25 segments for a short lesson.",
        "- dictation must contain 3-5 segmentIds selected from transcriptSegments.",
        "- learningItems must contain 6-10 useful items from transcriptSegments.",
        "- comprehension must contain 2-3 interactive questions based on the video content.",
        "- outputTask must be one 30-60 second speaking task using 3 lesson expressions.",
        "- Do not include old modules like large reading cards, growth stats, weak-point panels, or static first/second listen cards."
      ].join("\n")
    }
  ];
}

export function buildSpeakingFeedbackMessages({
  answer,
  expressions,
  question,
  topic
}: {
  answer: string;
  expressions: string[];
  question: string;
  topic: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an AI speaking coach for practical, natural English.",
        "Judge the learner as if they are speaking in a real conversation, not writing an essay.",
        "Reward clear spoken English and useful lesson expressions.",
        "Do not invent precise accent scores. Give verifiable feedback only.",
        "Return strict JSON only. Chinese feedback, English examples."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Topic: ${topic}`,
        `Speaking task: ${question}`,
        `Lesson expressions: ${expressions.join(" / ")}`,
        `Learner answer: ${answer}`,
        "",
        `{
  "fluency": number,
  "grammar": number,
  "vocabulary": number,
  "naturalness": number,
  "suggestion": string,
  "betterVersion": string
}`
      ].join("\n")
    }
  ];
}

function buildPhaseRule(dayNumber: number): string {
  if (dayNumber <= 60) {
    return [
      "Phase 1:",
      "- IELTS 5.0-6.0.",
      "- Prioritize clear real speech, high-frequency expressions, workplace/daily topics, and short output.",
      "- No writing module in the first two weeks."
    ].join("\n");
  }

  if (dayNumber <= 120) {
    return [
      "Phase 2:",
      "- IELTS 6.0-6.5.",
      "- Add accessible news/business content while keeping listening trainable."
    ].join("\n");
  }

  return [
    "Phase 3:",
    "- IELTS 7+.",
    "- Add harder topics and more abstract spoken output, but keep real speech and transcript-first training."
  ].join("\n");
}
