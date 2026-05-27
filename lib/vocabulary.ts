import cet4Words from "@/data/vocab/cet4.json";
import cet6Words from "@/data/vocab/cet6.json";
import ieltsWords from "@/data/vocab/ielts.json";

export type VocabLevel = "cet" | "ielts";

export interface VocabEntry {
  word: string;
  levels: VocabLevel[];
  labels: string[];
  translation: string;
  phonetic: string;
}

interface RawVocabEntry {
  name: string;
  trans?: string[];
  usphone?: string;
  ukphone?: string;
}

const vocabMap = buildVocabMap();

export function lookupVocab(rawWord: string): VocabEntry | null {
  const normalized = normalizeWord(rawWord);
  const candidates = [
    normalized,
    stripSuffix(normalized, "s"),
    stripSuffix(normalized, "es"),
    stripSuffix(normalized, "ed"),
    stripSuffix(normalized, "ing")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const entry = vocabMap.get(candidate);

    if (entry) {
      return entry;
    }
  }

  return null;
}

function buildVocabMap(): Map<string, VocabEntry> {
  const map = new Map<string, VocabEntry>();

  addEntries(map, cet4Words as RawVocabEntry[], "cet", "CET4");
  addEntries(map, cet6Words as RawVocabEntry[], "cet", "CET6");
  addEntries(map, ieltsWords as RawVocabEntry[], "ielts", "IELTS");

  return map;
}

function addEntries(
  map: Map<string, VocabEntry>,
  entries: RawVocabEntry[],
  level: VocabLevel,
  label: string
): void {
  for (const item of entries) {
    const word = normalizeWord(item.name);

    if (!word) {
      continue;
    }

    const existing = map.get(word);
    const translation = item.trans?.join("; ") ?? "";
    const phonetic = item.usphone || item.ukphone || "";

    if (existing) {
      if (!existing.levels.includes(level)) {
        existing.levels.push(level);
      }

      if (!existing.labels.includes(label)) {
        existing.labels.push(label);
      }

      if (!existing.translation && translation) {
        existing.translation = translation;
      }

      if (!existing.phonetic && phonetic) {
        existing.phonetic = phonetic;
      }

      continue;
    }

    map.set(word, {
      word,
      levels: [level],
      labels: [label],
      translation,
      phonetic
    });
  }
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
}

function stripSuffix(word: string, suffix: string): string {
  if (word.length <= suffix.length + 2 || !word.endsWith(suffix)) {
    return "";
  }

  const stripped = word.slice(0, -suffix.length);

  if (suffix === "ing" && stripped.endsWith(stripped.at(-1) ?? "")) {
    return stripped.slice(0, -1);
  }

  return stripped;
}
