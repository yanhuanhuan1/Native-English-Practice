"use client";

import type { Attempt } from "@/types/scoring";

interface HistoryPanelProps {
  attempts: Attempt[];
  onSelect: (attempt: Attempt) => void;
}

export function HistoryPanel({ attempts, onSelect }: HistoryPanelProps) {
  return (
    <aside className="panel history-panel">
      <div className="section-heading">
        <h2>最近练习</h2>
      </div>

      {attempts.length === 0 ? (
        <div className="empty-state">还没有练习记录。</div>
      ) : (
        <div className="history-list">
          {attempts.slice(-12).reverse().map((attempt) => (
            <button
              className="history-item"
              key={attempt.id}
              type="button"
              onClick={() => onSelect(attempt)}
            >
              <span className="history-score">{Math.round(attempt.result.score)}</span>
              <span className="history-main">
                <strong>{attempt.userAnswer}</strong>
                <span>{attempt.scenarioPromptZh}</span>
              </span>
              <time dateTime={attempt.createdAt}>
                {formatAttemptTime(attempt.createdAt)}
              </time>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function formatAttemptTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "";
  }
}
