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
        "You are a practical English training coach for a Chinese native speaker.",
        "The learner is around CET6 in reading, but weak in listening, speaking, vocabulary depth, language chunks, real speech speed, connected speech, and practical output.",
        "Your job is to create one Daily English Training plan using real online resources.",
        "",
        "Critical product direction:",
        "- Do not sound like an IELTS template book.",
        "- Do not use outdated test phrases such as: Every coin has two sides, With the development of society, Nowadays more and more people.",
        "- Train modern, natural, useful English input and output.",
        "- Prefer workplace, business basics, daily conversation, travel, meetings, and practical real-life topics in the early stage.",
        "- Vocabulary must come mainly from the listening and reading resources you select, not from a random word list.",
        "",
        "Resource rules:",
        "- You must use web search or browsing capability if available through the connected AI agent API.",
        "- Select real resources and provide exact links.",
        "- Prefer BBC Learning English, British Council LearnEnglish, VOA Learning English, TED-Ed when suitable, and high-quality YouTube channels only when the level is appropriate.",
        "- For reading, prefer British Council LearnEnglish, BBC Learning English, and simple business English articles.",
        "- Do not fabricate article transcripts, full passages, or large learning materials.",
        "- Design tasks based on the selected resources.",
        "",
        "Return strict JSON only. No markdown, no comments, no surrounding prose."
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
        "The JSON object must match this exact structure:",
        `{
  "date": "YYYY-MM-DD",
  "dayNumber": number,
  "level": "IELTS 5.0-6.0" | "IELTS 6.0-6.5" | "IELTS 7+",
  "phase": "phase1-foundation" | "phase2-bridge" | "phase3-ielts7",
  "topic": string,
  "resources": [
    {
      "type": "listening" | "reading",
      "websiteName": string,
      "title": string,
      "url": string,
      "difficulty": string,
      "whySuitable": string
    }
  ],
  "listeningTask": {
    "resource": {
      "type": "listening",
      "websiteName": string,
      "title": string,
      "url": string,
      "difficulty": string,
      "whySuitable": string
    },
    "firstListen": {
      "instruction": "不开字幕听一遍。",
      "questions": [
        "What is the topic?",
        "Who is speaking?",
        "What is the main idea?"
      ]
    },
    "secondListen": {
      "instruction": "打开英文字幕再听一遍。",
      "extractionTarget": "Extract 5 language chunks from the resource."
    }
  },
  "vocabulary": [
    {
      "word": string,
      "meaning": string,
      "commonCollocations": [string],
      "exampleSentence": string
    }
  ],
  "chunks": [
    {
      "expression": string,
      "meaning": string,
      "example": string
    }
  ],
  "readingTask": {
    "resource": {
      "type": "reading",
      "websiteName": string,
      "title": string,
      "url": string,
      "difficulty": string,
      "whySuitable": string
    },
    "readingTarget": string,
    "extractionInstruction": "Do not translate the full text. Extract 5 useful expressions with meaning and example."
  },
  "speakingTask": {
    "topic": string,
    "requirement": string,
    "structure": ["Introduction", "Point 1", "Point 2", "Conclusion"],
    "simpleExpressionFrame": [string]
  },
  "writingTask": {
    "enabled": boolean,
    "taskType": "none" | "sentence" | "paragraph" | "ielts-task-2",
    "prompt": string,
    "bannedTemplates": [
      "Every coin has two sides",
      "With the development of society",
      "Nowadays more and more people"
    ]
  },
  "feedbackTask": {
    "englishAnswerPrompt": string,
    "chunkSentencePrompt": string,
    "nextDayAdjustmentRule": string
  },
  "completed": false
}`,
        "",
        "Quality constraints:",
        "- Listening and reading resources must be different pages unless one official page contains both audio/video and article tasks.",
        "- Include exactly 5-10 vocabulary items.",
        "- Include exactly 5-8 language chunks.",
        "- Vocabulary items must include common collocations, not isolated dictionary meanings.",
        "- Speaking must be realistic for the current phase and not require complex abstract opinions.",
        "- For the first 14 days, writingTask.enabled must be false and taskType must be none.",
        "- All links must be publicly accessible web URLs."
      ].join("\n")
    }
  ];
}

function buildPhaseRule(dayNumber: number): string {
  if (dayNumber <= 60) {
    return [
      "Phase 1 rule:",
      "- Level target: IELTS 5.0-6.0.",
      "- Focus: high-frequency vocabulary, common expressions, daily English, business basics, workplace communication, listening adaptation, simple speaking output.",
      dayNumber <= 14
        ? "- First two weeks: writing training is forbidden. Focus only on Vocabulary, Language Chunks, Listening, Reading, Speaking."
        : "- After the first two weeks: writing can begin only as short sentence training, not IELTS essay writing."
    ].join("\n");
  }

  if (dayNumber <= 120) {
    return [
      "Phase 2 rule:",
      "- Level target: IELTS 6.0-6.5.",
      "- Add accessible news English, simple business articles, and slightly more complex expression patterns.",
      "- Writing can be paragraph-level only when the daily input is suitable."
    ].join("\n");
  }

  return [
    "Phase 3 rule:",
    "- Level target: IELTS 7+.",
    "- Add higher-level reading, academic expressions, writing training, and more complex opinion discussion.",
    "- Keep language modern and natural; do not use memorized IELTS templates."
  ].join("\n");
}
