"use client";

import {
  DIFFICULTY_OPTIONS,
  TOPIC_OPTIONS,
  type Scenario
} from "@/types/scenario";

interface ScenarioCardProps {
  scenario: Scenario | null;
  totalCount: number;
}

export function ScenarioCard({ scenario, totalCount }: ScenarioCardProps) {
  if (!scenario) {
    return (
      <section className="panel scenario-card">
        <div className="empty-state">当前筛选条件下没有场景。</div>
      </section>
    );
  }

  return (
    <section className="panel scenario-card">
      <div className="scenario-topline">
        <span>{getTopicLabel(scenario.topic)}</span>
        <span>{getDifficultyLabel(scenario.difficulty)}</span>
        {scenario.source === "ai" ? <span>AI</span> : null}
        <span>{totalCount} 个场景</span>
      </div>

      <h1>{scenario.promptZh}</h1>

      <dl className="context-grid">
        <div>
          <dt>谁在说</dt>
          <dd>{scenario.speaker}</dd>
        </div>
        <div>
          <dt>对谁说</dt>
          <dd>{scenario.listener}</dd>
        </div>
        <div>
          <dt>关系</dt>
          <dd>{scenario.relationship}</dd>
        </div>
        <div>
          <dt>语气</dt>
          <dd>{scenario.mood}</dd>
        </div>
      </dl>

      <div className="scenario-detail">
        <span>场景</span>
        <p>{scenario.situation}</p>
      </div>
      <div className="scenario-detail">
        <span>表达目标</span>
        <p>{scenario.intent}</p>
      </div>
    </section>
  );
}

function getTopicLabel(value: Scenario["topic"]): string {
  return TOPIC_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getDifficultyLabel(value: Scenario["difficulty"]): string {
  return (
    DIFFICULTY_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}
