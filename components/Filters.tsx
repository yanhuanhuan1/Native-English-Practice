"use client";

import { Sparkles } from "lucide-react";
import {
  DIFFICULTY_OPTIONS,
  TOPIC_OPTIONS,
  type Difficulty,
  type Topic
} from "@/types/scenario";

export type TopicFilter = Topic | "all";
export type DifficultyFilter = Difficulty | "all";

interface FiltersProps {
  topic: TopicFilter;
  difficulty: DifficultyFilter;
  onTopicChange: (topic: TopicFilter) => void;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function Filters({
  topic,
  difficulty,
  onTopicChange,
  onDifficultyChange,
  onGenerate,
  isGenerating
}: FiltersProps) {
  return (
    <section className="filter-bar panel">
      <label>
        <span>主题</span>
        <select
          value={topic}
          onChange={(event) => onTopicChange(event.target.value as TopicFilter)}
        >
          <option value="all">全部主题</option>
          {TOPIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>难度</span>
        <select
          value={difficulty}
          onChange={(event) =>
            onDifficultyChange(event.target.value as DifficultyFilter)
          }
        >
          <option value="all">全部难度</option>
          {DIFFICULTY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        className="secondary-button"
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        title="生成新场景"
      >
        <Sparkles size={17} aria-hidden="true" />
        {isGenerating ? "生成中..." : "AI 生成场景"}
      </button>
    </section>
  );
}
