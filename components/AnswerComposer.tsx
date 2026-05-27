"use client";

import { Send } from "lucide-react";

interface AnswerComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function AnswerComposer({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled = false
}: AnswerComposerProps) {
  return (
    <form
      className="answer-panel panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="section-heading">
        <label htmlFor="spoken-answer">你的英文表达</label>
      </div>
      <textarea
        id="spoken-answer"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入你在这个场景里会自然说出口的英文..."
        rows={7}
        disabled={disabled || isLoading}
      />
      <div className="composer-actions">
        <span className="answer-count">{value.trim().length} 个字符</span>
        <button
          className="primary-button"
          type="submit"
          disabled={disabled || isLoading || !value.trim()}
          title="提交评分"
        >
          <Send size={17} aria-hidden="true" />
          {isLoading ? "评分中..." : "提交评分"}
        </button>
      </div>
    </form>
  );
}
