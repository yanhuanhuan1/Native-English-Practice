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
  const phaseRule = buildPhaseRule(dayNumber);

  return [
    {
      role: "system",
      content: [
        "You are a real English growth coach for a Chinese native speaker.",
        "The learner is around CET6 in reading, but weak in listening, speaking, vocabulary depth, connected speech, real-speed input, and natural output.",
        "Create one Daily English Training session as a complete training loop: Input -> Understand -> Practice -> Output -> Review.",
        "",
        "Product direction:",
        "- This is not a textbook page and not an IELTS template generator.",
        "- Reduce explanation density. Create actionable tasks the learner can finish in 30-60 minutes.",
        "- Train modern, natural English expression chunks, not isolated dictionary words.",
        "- Do not use old IELTS templates such as: Every coin has two sides, With the development of society, Nowadays more and more people.",
        "- Prefer workplace, daily life, meetings, travel, simple business, and real conversation in early stages.",
        "",
        "Resource rules:",
        "- Use web search or browsing if your connected agent API supports it.",
        "- Prefer real resources from BBC Learning English, British Council LearnEnglish, VOA Learning English, TED-Ed, and high-quality YouTube channels.",
        "- Listening must be playable inside the site when possible: provide YouTube embedUrl or a direct audioUrl. If neither is available, use playerType web and provide the source URL plus a short transcript/summary.",
        "- Reading must be a Daily Reading Card of 100-200 words based on or adapted from a real linked source. Do not paste a copyrighted full article.",
        "- Vocabulary must come from the selected listening/reading theme and be written as reusable expression chunks.",
        "- Provide all resource links and difficulty judgments.",
        "",
        "Strict output rules:",
        "- Return strict JSON only. No markdown, no comments, no surrounding prose.",
        "- Keep all user-facing strings in Simplified Chinese except English expressions, examples, URLs, and titles."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Generate Daily English Training for date: ${date}.`,
        `This is Day ${dayNumber}.`,
        phaseRule,
        "",
        "Recent learning state:",
        JSON.stringify(historySummary, null, 2),
        "",
        "Return exactly this JSON shape:",
        `{
  "date": "YYYY-MM-DD",
  "dayNumber": number,
  "level": "IELTS 5.0-6.0" | "IELTS 6.0-6.5" | "IELTS 7+",
  "phase": "phase1-foundation" | "phase2-bridge" | "phase3-ielts7",
  "topic": string,
  "activeStep": "listening",
  "stepStatus": {
    "listening": false,
    "expression": false,
    "practice": false,
    "speaking": false,
    "review": false
  },
  "listening": {
    "resource": {
      "title": string,
      "source": string,
      "url": string,
      "embedUrl": string,
      "audioUrl": string,
      "level": string,
      "duration": string,
      "playerType": "youtube" | "audio" | "web",
      "whySuitable": string
    },
    "firstListen": {
      "instruction": "第一遍：不看字幕，只抓大意。",
      "questions": [
        "What is the topic?",
        "Who is speaking?",
        "What is the main idea?"
      ]
    },
    "secondListen": {
      "instruction": "第二遍：打开英文字幕，抓表达块。",
      "task": "写下 5 个你能马上用到的表达。"
    },
    "transcript": string
  },
  "expressions": [
    {
      "id": string,
      "expression": string,
      "meaning": string,
      "example": string,
      "scenario": string,
      "pronunciation": string,
      "difficulty": string,
      "favorite": false,
      "reviewDate": "YYYY-MM-DD",
      "mastery": "new"
    }
  ],
  "practice": {
    "fillBlank": [
      {
        "id": string,
        "prompt": "I am responsible ___ managing projects.",
        "answer": "for",
        "hint": string
      }
    ],
    "replacements": [
      {
        "id": string,
        "baseSentence": "I work in marketing.",
        "targetWord": "marketing",
        "replacements": ["sales", "finance", "customer service"],
        "modelAnswer": "I work in sales."
      }
    ],
    "sentenceBuilders": [
      {
        "id": string,
        "keywords": ["responsible", "manage", "project"],
        "modelAnswer": "I am responsible for managing this project.",
        "context": string
      }
    ]
  },
  "speaking": {
    "question": string
  },
  "reading": {
    "title": string,
    "source": string,
    "url": string,
    "level": string,
    "text": string,
    "zhAssist": string,
    "highlightedExpressions": [
      {
        "expression": string,
        "meaning": string,
        "example": string
      }
    ]
  },
  "review": [
    {
      "expressionId": string,
      "expression": string,
      "meaning": string,
      "dueDate": "YYYY-MM-DD",
      "prompt": string
    }
  ],
  "weaknesses": {
    "listening": [string],
    "expression": [string],
    "speaking": [string],
    "reading": [string]
  },
  "dashboard": {
    "totalDays": number,
    "learnedExpressions": number,
    "listeningMinutes": number,
    "speakingPracticeCount": number,
    "reviewAccuracy": number
  },
  "completed": false
}`,
        "",
        "Quality constraints:",
        "- Include 5-8 expressions, each as a reusable language chunk.",
        "- Include 2 fillBlank tasks, 1 replacement task, and 1 sentenceBuilder task.",
        "- The reading text must be 100-200 words and easy enough for IELTS 5.0-6.0 during the first 60 days.",
        "- Review items should prioritize dueReviewExpressions from history. If there are none, review 2 current expressions.",
        "- Weaknesses should be short Chinese labels based on history and current task, not generic long paragraphs.",
        "- For the first 14 days, do not include writing tasks at all.",
        "- All URLs must be valid http(s) URLs.",
        "- If using YouTube, convert watch URLs to embed URLs."
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
        "Reward simple, clear, natural spoken English, useful chunks, contractions, and context-appropriate wording.",
        "Do not over-penalize small spoken slips, missing minor prefixes, fragments, or casual wording if the meaning is clear.",
        "Penalize stiff translation-style English, unnatural written style, word-for-word Chinese phrasing, and tone mismatch.",
        "Return strict JSON only. All explanations must be in Simplified Chinese except English examples."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Topic: ${topic}`,
        `Speaking question: ${question}`,
        `Target expressions: ${expressions.join(" / ")}`,
        `Learner answer: ${answer}`,
        "",
        "Return exactly:",
        `{
  "fluency": number,
  "grammar": number,
  "vocabulary": number,
  "naturalness": number,
  "suggestion": string,
  "betterVersion": string
}`,
        "",
        "Scores must be 0-100. suggestion should be concise Chinese feedback focused on spoken naturalness."
      ].join("\n")
    }
  ];
}

function buildPhaseRule(dayNumber: number): string {
  if (dayNumber <= 60) {
    return [
      "Phase 1 rule:",
      "- Level target: IELTS 5.0-6.0.",
      "- Focus: high-frequency expressions, language chunks, daily/business basics, listening adaptation, simple spoken output, and short reading.",
      dayNumber <= 14
        ? "- First two weeks: writing training is forbidden. Use Listening, Expression Bank, Practice, Speaking, Reading Card, and Review only."
        : "- After the first two weeks: writing may be introduced later, but do not include it in this module yet."
    ].join("\n");
  }

  if (dayNumber <= 120) {
    return [
      "Phase 2 rule:",
      "- Level target: IELTS 6.0-6.5.",
      "- Add accessible news English, business articles, and more complex expression patterns.",
      "- Keep tasks practical and modern."
    ].join("\n");
  }

  return [
    "Phase 3 rule:",
    "- Level target: IELTS 7+.",
    "- Add higher-level reading, academic expression, and more complex opinion discussion.",
    "- Keep language modern and natural; never rely on memorized IELTS templates."
  ].join("\n");
}
