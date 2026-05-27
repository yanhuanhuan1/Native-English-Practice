import type { ChatMessage } from "@/lib/ai/config";
import type { Scenario, Difficulty, Topic } from "@/types/scenario";
import type { Attempt, InsightReport } from "@/types/scoring";

const SCORING_JSON_SHAPE = `{
  "score": number,
  "meaningAccuracy": number,
  "grammar": number,
  "naturalness": number,
  "spokenStyle": number,
  "toneFit": number,
  "feedbackZh": string,
  "betterAnswer": string,
  "alternatives": string[],
  "whyBetterZh": string,
  "keyPhrases": string[]
}`;

const INSIGHT_JSON_SHAPE = `{
  "weaknesses": string[],
  "vocabularyIssues": string[],
  "analysis": string,
  "improvement": string
}`;

export function buildEvaluatorMessages(
  scenario: Scenario,
  userAnswer: string
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are NOT a grammar teacher, essay grader, business-writing editor, or politeness filter.",
        "You are a street-smart spoken-English coach helping a Chinese speaker sound local, casual, and human in real conversation.",
        "Judge whether the answer sounds like something a real person might actually say out loud in the exact situation.",
        "Reward native/local everyday phrasing, casual rhythm, contractions, slang, fragments, ellipsis, simple words, emotional timing, and context-appropriate tone.",
        "Do not punish a sentence just because it is not a full written sentence. Spoken English can be incomplete, messy, blunt, sarcastic, or very short.",
        "Profanity is allowed. If a swear word fits the relationship, mood, and situation, do not moralize and do not deduct for profanity itself. Only warn in Chinese if the register could offend the listener.",
        "Do not over-penalize tiny word-form, prefix, suffix, article, plural, or tense slips if a real listener would understand the meaning instantly.",
        "Strongly penalize Chinese-to-English literal translation, stiff textbook phrasing, over-formal writing, unnatural politeness, and answers that sound like emails or essays.",
        "Meaning and real conversational usefulness matter more than perfect written grammar.",
        "Feedback must be specific, practical, and written in Simplified Chinese.",
        "Return only strict JSON. Do not include markdown, comments, code fences, or extra text.",
        `The JSON object must match this exact shape: ${SCORING_JSON_SHAPE}`,
        "All numeric scores must be numbers from 0 to 100."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Evaluate this answer as live spoken English, not written English.",
          scenario: {
            promptZh: scenario.promptZh,
            speaker: scenario.speaker,
            listener: scenario.listener,
            relationship: scenario.relationship,
            mood: scenario.mood,
            situation: scenario.situation,
            topic: scenario.topic,
            difficulty: scenario.difficulty,
            intent: scenario.intent,
            referenceAnswers: scenario.referenceAnswers
          },
          userAnswer,
          scoringRules: [
            "score: overall usefulness in a real face-to-face or chat conversation.",
            "meaningAccuracy: whether the intended meaning lands in context.",
            "grammar: only penalize grammar when it hurts understanding or sounds clearly non-native in speech.",
            "naturalness: the most important dimension; would a local/fluent speaker actually say it?",
            "spokenStyle: reward casual, short, human, colloquial speech; punish formal written style.",
            "toneFit: relationship, mood, bluntness, sarcasm, swear words, softness, and emotional temperature must fit.",
            "betterAnswer should be one highly natural spoken version, not a polished written sentence.",
            "alternatives should include 2 or 3 casual local versions with different tone choices if useful.",
            "whyBetterZh should explain rhythm, wording, tone, and why it sounds more local.",
            "keyPhrases should list reusable conversational chunks, not grammar labels."
          ],
          forbiddenJudgingStyles: [
            "Do not say an answer is bad because it lacks a subject if it works in speech.",
            "Do not prefer formal words like 'therefore', 'I would like to', or 'I am writing to'.",
            "Do not turn casual emotion into polite corporate language.",
            "Do not remove profanity automatically; judge register instead."
          ]
        },
        null,
        2
      )
    }
  ];
}

export function buildScenarioGeneratorMessages(
  topic?: Topic,
  difficulty?: Difficulty
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You create real-life spoken-English expression practice scenarios for Chinese speakers.",
        "The goal is local, casual, human English, not textbook English and not written English.",
        "The scenario prompt must be in Simplified Chinese and should make the user produce one natural sentence or short spoken reply.",
        "Make it feel like an actual text message, hallway chat, dinner table reaction, office aside, awkward moment, complaint, joke, apology, or emotional response.",
        "Avoid exams, formal writing, business letters, grammar drills, and polite textbook dialogs.",
        "Return only strict JSON. Do not include markdown, comments, code fences, or extra text.",
        "The JSON shape is: {\"promptZh\": string, \"speaker\": string, \"listener\": string, \"relationship\": string, \"mood\": string, \"situation\": string, \"topic\": string, \"difficulty\": string, \"intent\": string, \"referenceAnswers\": string[], \"wordHints\": string[]}.",
        "topic must be one of: daily, workplace, help, disagreement, plans, food, apology, clarifying, reacting, emotions.",
        "difficulty must be one of: beginner, intermediate, advanced.",
        "referenceAnswers must contain 2 or 3 short, casual, local spoken English answers.",
        "wordHints must contain only 1 or 2 short English words or phrases that are semantically related or near-synonyms. Do not reveal a full answer."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Create one new natural spoken-English practice scenario.",
        requestedTopic: topic ?? "any casual real-life topic",
        requestedDifficulty: difficulty ?? "any",
        mustFeelLike: [
          "real person talking",
          "local everyday English",
          "casual and practical",
          "possibly messy or emotional",
          "not a grammar drill"
        ]
      })
    }
  ];
}

export function buildInsightMessages(
  attempts: Attempt[],
  previousReports: InsightReport[]
): ChatMessage[] {
  const summaries = attempts.map((a) => ({
    prompt: a.scenarioPromptZh,
    answer: a.userAnswer,
    score: a.result.score,
    feedback: a.result.feedbackZh,
    topic: a.topic,
    difficulty: a.difficulty
  }));

  return [
    {
      role: "system",
      content: [
        "You are an English speaking coach analyzing a Chinese learner's practice history.",
        "Identify recurring weaknesses, vocabulary gaps, and patterns across multiple attempts.",
        "Be specific and practical. Write all output in Simplified Chinese.",
        "Return only strict JSON matching this shape: " + INSIGHT_JSON_SHAPE,
        "weaknesses: 3-5 specific recurring problems (e.g. 'over-formal phrasing', 'missing contractions').",
        "vocabularyIssues: 3-5 specific word/phrase patterns to improve.",
        "analysis: 2-3 sentences summarizing the overall pattern.",
        "improvement: only include if previousReports exist — 1-2 sentences on what has improved since the first report."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        recentAttempts: summaries,
        previousReports: previousReports.map((r) => ({
          attemptCount: r.attemptCount,
          weaknesses: r.weaknesses,
          analysis: r.analysis
        }))
      })
    }
  ];
}
