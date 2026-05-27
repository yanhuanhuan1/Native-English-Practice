"use client";

import type { ScoreResult } from "@/types/scoring";

interface FeedbackPanelProps {
  result: ScoreResult | null;
  error: string | null;
  isLoading: boolean;
}

const metricLabels: Array<{ key: keyof ScoreResult; label: string }> = [
  { key: "meaningAccuracy", label: "意思准确" },
  { key: "grammar", label: "语法清楚" },
  { key: "naturalness", label: "自然程度" },
  { key: "spokenStyle", label: "口语感" },
  { key: "toneFit", label: "语气贴合" }
];

export function FeedbackPanel({ result, error, isLoading }: FeedbackPanelProps) {
  return (
    <section className="panel feedback-panel" aria-live="polite">
      <div className="section-heading">
        <h2>AI 反馈</h2>
      </div>

      {isLoading ? <div className="loading-block">正在评分...</div> : null}

      {error ? <div className="error-box">{error}</div> : null}

      {!result && !isLoading ? (
        <div className="empty-state">提交后这里会显示评分和建议。</div>
      ) : null}

      {result ? (
        <div className="feedback-content">
          <div className="score-row">
            <div>
              <span className="score-label">总分</span>
              <strong>{Math.round(result.score)}</strong>
            </div>
            <span className="score-caption">/ 100</span>
          </div>

          <div className="metric-grid">
            {metricLabels.map(({ key, label }) => {
              const value = result[key];

              return typeof value === "number" ? (
                <div className="metric" key={key}>
                  <div className="metric-topline">
                    <span>{label}</span>
                    <strong>{Math.round(value)}</strong>
                  </div>
                  <div className="metric-track" aria-hidden="true">
                    <span style={{ width: `${value}%` }} />
                  </div>
                </div>
              ) : null;
            })}
          </div>

          <div className="feedback-copy">
            <h3>具体反馈</h3>
            <p>{result.feedbackZh}</p>
          </div>

          <div className="suggestion-block">
            <h3>更自然的说法</h3>
            <p className="better-answer">{result.betterAnswer}</p>
          </div>

          {result.alternatives.length > 0 ? (
            <div className="suggestion-block">
              <h3>其他口语版本</h3>
              <ul>
                {result.alternatives.map((alternative) => (
                  <li key={alternative}>{alternative}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="feedback-copy">
            <h3>为什么更自然</h3>
            <p>{result.whyBetterZh}</p>
          </div>

          {result.keyPhrases.length > 0 ? (
            <div className="phrase-row">
              {result.keyPhrases.map((phrase) => (
                <span key={phrase}>{phrase}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
