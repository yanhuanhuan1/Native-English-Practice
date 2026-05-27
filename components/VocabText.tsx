"use client";

import { lookupVocab } from "@/lib/vocabulary";

interface VocabTextProps {
  text: string;
  example?: string;
  className?: string;
}

export function VocabText({ text, example, className }: VocabTextProps) {
  const parts = text.split(/([A-Za-z][A-Za-z']*)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const entry = lookupVocab(part);

        if (!entry) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        const levelClass = entry.levels.includes("ielts")
          ? "vocab-ielts"
          : "vocab-cet";

        return (
          <span
            className={`vocab-word ${levelClass}`}
            key={`${part}-${index}`}
            tabIndex={0}
          >
            {part}
            <span className="vocab-card" role="tooltip">
              <strong>{part}</strong>
              <em>{entry.labels.join(" / ")}</em>
              {entry.phonetic ? <span>/{entry.phonetic}/</span> : null}
              {entry.translation ? <span>{entry.translation}</span> : null}
              {example ? <q>{example}</q> : null}
            </span>
          </span>
        );
      })}
    </span>
  );
}
