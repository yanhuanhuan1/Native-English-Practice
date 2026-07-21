"use client";

import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mic,
  MoreHorizontal,
  Play,
  RotateCcw,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type {
  ComprehensionQuestion,
  DailyTraining,
  DailyTrainingHistorySummary,
  DictationExercise,
  EnglishTrainingRecord,
  LearningItem,
  LearningItemMastery,
  ReviewItem,
  SpeakingFeedback,
  TranscriptSegment
} from "@/types/daily-training";
import {
  getLibraryLevelCount,
  pickDailyTrainingReserve,
  trainingLibraryLevels,
  type ExactTrainingLevel
} from "@/data/dailyTrainingVideoLibrary";

interface DailyTrainingApiResponse {
  training?: DailyTraining;
  error?: string;
}

interface SpeakingFeedbackApiResponse {
  feedback?: SpeakingFeedback;
  error?: string;
}

interface ServerConfigResponse {
  configured?: boolean;
}

const storageKey = "daily-english-training-records";
const levelStorageKey = "daily-english-training-level";

const masteryLabels: Record<LearningItemMastery, string> = {
  unknown: "不认识",
  fuzzy: "模糊",
  "known-passive": "认识但不会用",
  active: "可以主动使用"
};

export function DailyEnglishTraining() {
  const [records, setRecords] = useState<EnglishTrainingRecord[]>([]);
  const [activeDate] = useState(() => getTodayKey());
  const [selectedLevel, setSelectedLevel] = useState<ExactTrainingLevel>("IELTS 5.0");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const generationRequestRef = useRef(0);

  useEffect(() => {
    setRecords(loadTrainingRecords());
    setSelectedLevel(loadSelectedLevel());

    let active = true;
    fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("config");
        }

        return (await response.json().catch(() => ({}))) as ServerConfigResponse;
      })
      .then((data) => {
        if (active) {
          setAiConfigured(!!data.configured);
        }
      })
      .catch(() => {
        if (active) {
          setAiConfigured(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const currentRecord =
    records.find((record) => record.training.date === activeDate) ?? null;
  const currentTraining = currentRecord?.training ?? null;
  const nextDayNumber = currentTraining?.dayNumber ?? getNextDayNumber(records);

  function handleLevelChange(level: ExactTrainingLevel) {
    setSelectedLevel(level);
    persistSelectedLevel(level);
  }

  async function handleGenerate(regenerate = false, level = selectedLevel) {
    if (aiConfigured === false) {
      setError("AI 服务尚未配置。请先在 Vercel 环境变量里设置 API_KEY。");
      return;
    }

    if (currentTraining && currentTraining.level === level && !regenerate) {
      return;
    }

    const reserveItem = pickDailyTrainingReserve(
      level,
      records
        .map((record) => record.training.selectedReserveId)
        .filter((item): item is string => !!item),
      `${activeDate}-${records.length}`
    );

    setIsGenerating(true);
    setError(null);
    setMenuOpen(false);
    const requestId = generationRequestRef.current + 1;
    generationRequestRef.current = requestId;

    try {
      const response = await fetch("/api/daily-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: activeDate,
          dayNumber: nextDayNumber,
          level,
          reserveItem,
          historySummary: buildHistorySummary(records)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as DailyTrainingApiResponse;

      if (!response.ok || !payload.training) {
        throw new Error(payload.error ?? "生成失败，请稍后重试。");
      }

      if (requestId !== generationRequestRef.current) {
        return;
      }

      const nextRecords = upsertRecord(records, {
        training: ensureTrainingDefaults({
          ...payload.training,
          level,
          selectedReserveId: reserveItem.id
        }),
        completedSteps: []
      });
      persistRecords(nextRecords);
      setRecords(nextRecords);
    } catch (generateError) {
      if (requestId === generationRequestRef.current) {
        setError(generateError instanceof Error ? generateError.message : "生成失败，请稍后重试。");
      }
    } finally {
      if (requestId === generationRequestRef.current) {
        setIsGenerating(false);
      }
    }
  }

  function updateTraining(updater: (training: DailyTraining) => DailyTraining) {
    if (!currentTraining) {
      return;
    }

    const nextTraining = updater(currentTraining);
    const nextRecord: EnglishTrainingRecord = {
      ...(currentRecord ?? { completedSteps: [] }),
      training: nextTraining,
      completedSteps: nextTraining.completed
        ? ["listening", "expression", "practice", "speaking", "review"]
        : currentRecord?.completedSteps ?? [],
      completedAt: nextTraining.completed ? new Date().toISOString() : currentRecord?.completedAt
    };
    const nextRecords = upsertRecord(records, nextRecord);

    persistRecords(nextRecords);
    setRecords(nextRecords);
  }

  return (
    <main className="daily-lesson-page">
      <header className="daily-lesson-appbar">
        <Link className="daily-lesson-back" href="/">
          返回口语跟练
        </Link>
      </header>

      {!currentTraining ? (
        <EmptyLesson
          aiConfigured={aiConfigured}
          error={error}
          isGenerating={isGenerating}
          selectedLevel={selectedLevel}
          onGenerate={() => void handleGenerate(false, selectedLevel)}
          onLevelChange={handleLevelChange}
        />
      ) : (
        <LessonWorkspace
          key={getTrainingInstanceKey(currentTraining)}
          error={error}
          isGenerating={isGenerating}
          menuOpen={menuOpen}
          selectedLevel={selectedLevel}
          training={currentTraining}
          onLevelChange={handleLevelChange}
          onMenuToggle={() => setMenuOpen((open) => !open)}
          onRegenerate={() => void handleGenerate(true, selectedLevel)}
          onStartLevel={() => void handleGenerate(true, selectedLevel)}
          onUpdate={updateTraining}
        />
      )}
    </main>
  );
}

function LessonWorkspace({
  error,
  isGenerating,
  menuOpen,
  onLevelChange,
  onMenuToggle,
  onRegenerate,
  onStartLevel,
  onUpdate,
  selectedLevel,
  training
}: {
  error: string | null;
  isGenerating: boolean;
  menuOpen: boolean;
  onLevelChange: (level: ExactTrainingLevel) => void;
  onMenuToggle: () => void;
  onRegenerate: () => void;
  onStartLevel: () => void;
  onUpdate: (updater: (training: DailyTraining) => DailyTraining) => void;
  selectedLevel: ExactTrainingLevel;
  training: DailyTraining;
}) {
  const trainingInstanceKey = getTrainingInstanceKey(training);
  const progress = getLessonProgress(training);

  return (
    <section className="daily-lesson-shell">
      <LessonHeader
        isGenerating={isGenerating}
        menuOpen={menuOpen}
        selectedLevel={selectedLevel}
        progress={progress}
        training={training}
        onLevelChange={onLevelChange}
        onMenuToggle={onMenuToggle}
        onRegenerate={onRegenerate}
        onStartLevel={onStartLevel}
      />
      {error ? <p className="daily-lesson-error">{error}</p> : null}

      <section className="daily-lesson-video-block">
        <div className="daily-lesson-player">
          <EmbeddedPlayer resource={training.listening.resource} />
        </div>
        <div className="daily-lesson-resource-line">
          <strong>{training.listening.resource.title}</strong>
          <span>{training.listening.resource.source}</span>
          <span>{training.listening.resource.duration}</span>
          <span>{training.listening.resource.level}</span>
          <a href={training.listening.resource.url} target="_blank" rel="noreferrer" title="原始资源">
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <LearningItemsPanel
        key={`items-${trainingInstanceKey}`}
        items={training.learningItems}
        onSpeakItem={(item) =>
          speakTrainingText(item.sourceSentence || item.reusableExample || item.text)
        }
        onUpdateItem={(itemId, updates) =>
          onUpdate((draft) => ({
            ...draft,
            learningItems: draft.learningItems.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            )
          }))
        }
      />

      <DictationPanel
        key={`dictation-${trainingInstanceKey}`}
        exercises={training.dictation}
        segments={training.transcriptSegments}
        onSpeakSegment={(segment) => speakTrainingText(segment.text)}
        onUpdate={(dictation) => onUpdate((draft) => ({ ...draft, dictation }))}
      />

      <ShadowingPanel
        key={`shadowing-${trainingInstanceKey}`}
        shadowing={training.shadowing}
        segments={training.transcriptSegments}
        onSpeakSegment={(segment) => speakTrainingText(segment.text)}
        onUpdate={(shadowing) => onUpdate((draft) => ({ ...draft, shadowing }))}
      />

      <ComprehensionPanel
        key={`comprehension-${trainingInstanceKey}`}
        questions={training.comprehension}
        onUpdate={(comprehension) => onUpdate((draft) => ({ ...draft, comprehension }))}
      />

      <OutputPanel
        key={`output-${trainingInstanceKey}`}
        learningItems={training.learningItems}
        outputTask={training.outputTask}
        topic={training.topic}
        onUpdate={(outputTask) => onUpdate((draft) => ({ ...draft, outputTask }))}
      />

      <CompleteLessonPanel
        review={training.lessonReview}
        completed={training.completed}
        onAddReview={() =>
          onUpdate((draft) => ({
            ...draft,
            lessonReview: { ...draft.lessonReview, addedToReview: true },
            review: mergeReviewItems(draft.review, draft.learningItems.slice(0, 3))
          }))
        }
        onComplete={() =>
          onUpdate((draft) => ({
            ...draft,
            completed: true,
            stepStatus: {
              listening: true,
              expression: true,
              practice: true,
              speaking: true,
              review: true
            }
          }))
        }
      />
    </section>
  );
}

function LessonHeader({
  isGenerating,
  menuOpen,
  onLevelChange,
  onMenuToggle,
  onRegenerate,
  onStartLevel,
  progress,
  selectedLevel,
  training
}: {
  isGenerating: boolean;
  menuOpen: boolean;
  onLevelChange: (level: ExactTrainingLevel) => void;
  onMenuToggle: () => void;
  onRegenerate: () => void;
  onStartLevel: () => void;
  progress: number;
  selectedLevel: ExactTrainingLevel;
  training: DailyTraining;
}) {
  const levelChanged = selectedLevel !== training.level;

  return (
    <header className="daily-lesson-header">
      <div>
        <span className="daily-lesson-kicker">Day {training.dayNumber}</span>
        <h1>{training.topic}</h1>
        <div className="daily-lesson-meta">
          <span>{training.listening.resource.level}</span>
          <span>{training.listening.resource.duration}</span>
          <span>{progress}% complete</span>
        </div>
      </div>
      <div className="daily-lesson-header-actions">
        <label className="daily-lesson-level-inline">
          <span>等级</span>
          <select
            value={selectedLevel}
            onChange={(event) => onLevelChange(event.target.value as ExactTrainingLevel)}
          >
            {trainingLibraryLevels.map((level) => (
              <option value={level} key={level}>
                {level} · {getLibraryLevelCount(level)} 条
              </option>
            ))}
          </select>
        </label>
        {levelChanged ? (
          <button
            className="daily-lesson-primary"
            disabled={isGenerating}
            type="button"
            onClick={onStartLevel}
          >
            {isGenerating ? <Loader2 className="daily-training-spin" size={16} /> : <Sparkles size={16} />}
            开始该等级
          </button>
        ) : null}
        <div className="daily-lesson-menu-wrap">
          <button className="daily-lesson-icon-btn" type="button" onClick={onMenuToggle}>
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className="daily-lesson-menu">
              <button disabled={isGenerating} type="button" onClick={onRegenerate}>
                {isGenerating ? <Loader2 className="daily-training-spin" size={16} /> : <RotateCcw size={16} />}
                重新抽取课程
              </button>
              <a href={training.listening.resource.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                查看原始资源
              </a>
              <Link href="/daily-training">返回训练记录</Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function EmbeddedPlayer({ resource }: { resource: DailyTraining["listening"]["resource"] }) {
  if (resource.playerType === "bilibili" && resource.embedUrl) {
    return (
      <iframe
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        scrolling="no"
        src={resource.embedUrl}
        title={resource.title}
      />
    );
  }

  if (resource.playerType === "youtube" && resource.embedUrl) {
    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        src={resource.embedUrl}
        title={resource.title}
      />
    );
  }

  if (resource.playerType === "audio" && resource.audioUrl) {
    return <audio controls src={resource.audioUrl} />;
  }

  return <iframe src={resource.url} title={resource.title} />;
}

function LearningItemsPanel({
  items,
  onSpeakItem,
  onUpdateItem
}: {
  items: LearningItem[];
  onSpeakItem: (item: LearningItem) => void;
  onUpdateItem: (itemId: string, updates: Partial<LearningItem>) => void;
}) {
  return (
    <section className="daily-lesson-section">
      <div className="daily-lesson-section-head">
        <h2>本课值得学的词和表达</h2>
        <span>{items.length} 项</span>
      </div>
      <div className="daily-lesson-learning-list">
        {items.map((item) => (
          <article className="daily-lesson-learning-item" key={item.id}>
            <div>
              <span>{getLearningTypeLabel(item.type)}</span>
              <h3>{item.text}</h3>
              <p>{item.meaning}</p>
              <small>{item.pronunciation}</small>
            </div>
            <p className="daily-lesson-source-sentence">{item.sourceSentence}</p>
            <div className="daily-lesson-chip-row">
              {item.collocations.map((collocation) => (
                <span key={collocation}>{collocation}</span>
              ))}
            </div>
            <q>{item.reusableExample}</q>
            <div className="daily-lesson-learning-actions">
              <button type="button" onClick={() => onSpeakItem(item)}>
                <Play size={15} />
                朗读短句
              </button>
              <button type="button" onClick={() => onUpdateItem(item.id, { saved: !item.saved })}>
                {item.saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                {item.saved ? "已收藏" : "收藏"}
              </button>
              <select
                value={item.mastery}
                onChange={(event) =>
                  onUpdateItem(item.id, { mastery: event.target.value as LearningItemMastery })
                }
              >
                {Object.entries(masteryLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DictationPanel({
  exercises,
  onSpeakSegment,
  onUpdate,
  segments
}: {
  exercises: DictationExercise[];
  onSpeakSegment: (segment: TranscriptSegment) => void;
  onUpdate: (exercises: DictationExercise[]) => void;
  segments: TranscriptSegment[];
}) {
  function updateExercise(segmentId: string, updates: Partial<DictationExercise>) {
    onUpdate(
      exercises.map((exercise) =>
        exercise.segmentId === segmentId ? { ...exercise, ...updates } : exercise
      )
    );
  }

  return (
    <section className="daily-lesson-section">
      <div className="daily-lesson-section-head">
        <h2>精听训练</h2>
        <span>3-5 句</span>
      </div>
      <div className="daily-lesson-dictation-list">
        {exercises.map((exercise, index) => {
          const segment = segments.find((item) => item.id === exercise.segmentId);
          const diff = compareWords(exercise.userAnswer, exercise.correctText);

          return (
            <article className="daily-lesson-dictation" key={exercise.segmentId}>
              <div className="daily-lesson-dictation-top">
                <strong>句子 {index + 1}</strong>
                {segment ? (
                  <button type="button" onClick={() => onSpeakSegment(segment)}>
                    <Play size={15} />
                    朗读原句
                  </button>
                ) : null}
              </div>
              <textarea
                value={exercise.userAnswer}
                onChange={(event) =>
                  updateExercise(exercise.segmentId, {
                    userAnswer: event.target.value,
                    completed: false
                  })
                }
                placeholder="先听声音，再输入你听到的英文"
                rows={3}
              />
              <button
                type="button"
                onClick={() =>
                  updateExercise(exercise.segmentId, {
                    completed: true,
                    missingWords: diff.missingWords,
                    incorrectWords: diff.incorrectWords
                  })
                }
              >
                显示对比
              </button>
              {exercise.completed ? (
                <div className="daily-lesson-diff">
                  <p>
                    正确：<strong>{exercise.correctText}</strong>
                  </p>
                  <p>漏词：{exercise.missingWords.join(" / ") || "无"}</p>
                  <p>错词：{exercise.incorrectWords.join(" / ") || "无"}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ShadowingPanel({
  onSpeakSegment,
  onUpdate,
  segments,
  shadowing
}: {
  onSpeakSegment: (segment: TranscriptSegment) => void;
  onUpdate: (shadowing: DailyTraining["shadowing"]) => void;
  segments: TranscriptSegment[];
  shadowing: DailyTraining["shadowing"];
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recordingSegmentId, setRecordingSegmentId] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const selectedSegments = shadowing.segmentIds
    .map((segmentId) => segments.find((segment) => segment.id === segmentId))
    .filter((segment): segment is TranscriptSegment => !!segment);

  async function toggleRecording(segmentId: string) {
    if (recordingSegmentId === segmentId) {
      recorderRef.current?.stop();
      setRecordingSegmentId(null);
      return;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingError(null);
    } catch {
      setRecordingError("没有获得麦克风权限。可以先朗读原句，自行跟读对比。");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunksRef.current, { type: "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
      onUpdate({
        ...shadowing,
        recordings: { ...shadowing.recordings, [segmentId]: url },
        completed: true
      });
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecordingSegmentId(segmentId);
  }

  return (
    <section className="daily-lesson-section">
      <div className="daily-lesson-section-head">
        <h2>逐句跟读</h2>
        <span>听一句，录一句</span>
      </div>
      {recordingError ? <p className="daily-lesson-error">{recordingError}</p> : null}
      <div className="daily-lesson-shadowing-list">
        {selectedSegments.map((segment) => (
          <article key={segment.id}>
            <p>{segment.text}</p>
            <div className="daily-lesson-learning-actions">
              <button type="button" onClick={() => onSpeakSegment(segment)}>
                <Play size={15} />
                朗读原句
              </button>
              <button type="button" onClick={() => void toggleRecording(segment.id)}>
                <Mic size={15} />
                {recordingSegmentId === segment.id ? "停止录音" : "开始录音"}
              </button>
              {shadowing.recordings[segment.id] ? (
                <audio controls src={shadowing.recordings[segment.id]} />
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComprehensionPanel({
  onUpdate,
  questions
}: {
  onUpdate: (questions: ComprehensionQuestion[]) => void;
  questions: ComprehensionQuestion[];
}) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <section className="daily-lesson-section">
      <div className="daily-lesson-section-head">
        <h2>理解检查</h2>
        <span>2-3 题</span>
      </div>
      <div className="daily-lesson-question-list">
        {questions.map((question) => (
          <article key={question.id}>
            <h3>{question.question}</h3>
            <div className="daily-lesson-options">
              {question.options.map((option) => (
                <button
                  data-selected={question.userAnswer === option}
                  key={option}
                  type="button"
                  onClick={() =>
                    onUpdate(
                      questions.map((item) =>
                        item.id === question.id
                          ? { ...item, userAnswer: option, completed: true }
                          : item
                      )
                    )
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            {question.completed ? (
              <p className="daily-lesson-answer">
                答案：{question.answer}。{question.explanation}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function OutputPanel({
  learningItems,
  onUpdate,
  outputTask,
  topic
}: {
  learningItems: LearningItem[];
  onUpdate: (task: DailyTraining["outputTask"]) => void;
  outputTask: DailyTraining["outputTask"];
  topic: string;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const requiredItems = outputTask.requiredItemIds
    .map((itemId) => learningItems.find((item) => item.id === itemId))
    .filter((item): item is LearningItem => !!item);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingError(null);
    } catch {
      setRecordingError("没有获得麦克风权限。你也可以直接写下自己的口语转录。");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunksRef.current, { type: "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
      onUpdate({ ...outputTask, recordingUrl: url });
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  async function requestFeedback() {
    if (!outputTask.transcript?.trim()) {
      onUpdate({ ...outputTask, feedback: "请先写下或粘贴你的口语转录，再查看基础反馈。" });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/daily-training/speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: outputTask.transcript,
          question: outputTask.prompt,
          topic,
          expressions: requiredItems.map((item) => item.text)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as SpeakingFeedbackApiResponse;

      onUpdate({
        ...outputTask,
        feedback: payload.feedback?.suggestion ?? payload.error ?? "反馈生成失败，请稍后重试。",
        completed: true
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="daily-lesson-section">
      <div className="daily-lesson-section-head">
        <h2>当日输出任务</h2>
        <span>30-60 秒</span>
      </div>
      <div className="daily-lesson-output">
        <p>{outputTask.prompt}</p>
        <div className="daily-lesson-chip-row">
          {requiredItems.map((item) => (
            <span key={item.id}>{item.text}</span>
          ))}
        </div>
        {recordingError ? <p className="daily-lesson-error">{recordingError}</p> : null}
        <div className="daily-lesson-learning-actions">
          <button type="button" onClick={() => void toggleRecording()}>
            <Mic size={15} />
            {recording ? "停止录音" : "开始录音"}
          </button>
          {outputTask.recordingUrl ? <audio controls src={outputTask.recordingUrl} /> : null}
        </div>
        <textarea
          value={outputTask.transcript ?? ""}
          onChange={(event) => onUpdate({ ...outputTask, transcript: event.target.value })}
          placeholder="查看转录：可以手动写下你刚才说的内容"
          rows={4}
        />
        <button disabled={loading} type="button" onClick={() => void requestFeedback()}>
          {loading ? <Loader2 className="daily-training-spin" size={15} /> : <Sparkles size={15} />}
          查看基础反馈
        </button>
        {outputTask.feedback ? <p className="daily-lesson-answer">{outputTask.feedback}</p> : null}
      </div>
    </section>
  );
}

function CompleteLessonPanel({
  completed,
  onAddReview,
  onComplete,
  review
}: {
  completed: boolean;
  onAddReview: () => void;
  onComplete: () => void;
  review: DailyTraining["lessonReview"];
}) {
  return (
    <section className="daily-lesson-section daily-lesson-complete">
      <div className="daily-lesson-section-head">
        <h2>Today you learned</h2>
        {completed ? <span>已完成</span> : null}
      </div>
      <ul>
        <li>3 个重点表达：{review.expressions.join(" / ") || "完成学习项后生成"}</li>
        <li>2 个声音现象：{review.soundIssues.join(" / ") || "跟读时注意弱读和连读"}</li>
        <li>1 个复习句子：{review.reviewSentence}</li>
      </ul>
      <div className="daily-lesson-learning-actions">
        <button type="button" onClick={onAddReview}>
          {review.addedToReview ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {review.addedToReview ? "已加入复习" : "加入复习"}
        </button>
        <button className="daily-lesson-primary" disabled={completed} type="button" onClick={onComplete}>
          <CheckCircle2 size={15} />
          {completed ? "本课已完成" : "完成本课"}
        </button>
      </div>
    </section>
  );
}

function EmptyLesson({
  aiConfigured,
  error,
  isGenerating,
  onGenerate,
  onLevelChange,
  selectedLevel
}: {
  aiConfigured: boolean | null;
  error: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onLevelChange: (level: ExactTrainingLevel) => void;
  selectedLevel: ExactTrainingLevel;
}) {
  return (
    <section className="daily-lesson-empty">
      <span>Daily English Training</span>
      <h1>选择等级，开始今天的精听</h1>
      <p>每个等级内置 50 条 YouTube/官方媒体优先视频储备。开始后会抽取一条，并生成精听、表达提取、跟读和输出任务。</p>
      <div className="daily-lesson-level-grid">
        {trainingLibraryLevels.map((level) => (
          <button
            aria-pressed={selectedLevel === level}
            key={level}
            type="button"
            onClick={() => onLevelChange(level)}
          >
            <strong>{level}</strong>
            <span>{getLibraryLevelCount(level)} 条储备</span>
          </button>
        ))}
      </div>
      <button disabled={isGenerating || aiConfigured === false} type="button" onClick={onGenerate}>
        {isGenerating ? <Loader2 className="daily-training-spin" size={17} /> : <Sparkles size={17} />}
        从 {selectedLevel} 开始
      </button>
      {aiConfigured === false ? <p className="daily-lesson-error">AI 服务尚未配置 API_KEY。</p> : null}
      {error ? <p className="daily-lesson-error">{error}</p> : null}
    </section>
  );
}

function loadTrainingRecords(): EnglishTrainingRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsed = rawValue ? (JSON.parse(rawValue) as unknown) : [];

    return Array.isArray(parsed)
      ? parsed.filter(isTrainingRecord).map((record) => ({
          ...record,
          training: ensureTrainingDefaults(record.training),
          completedSteps: record.completedSteps ?? []
        }))
      : [];
  } catch {
    return [];
  }
}

function persistRecords(records: EnglishTrainingRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(records.slice(-180)));
}

function loadSelectedLevel(): ExactTrainingLevel {
  if (typeof window === "undefined") {
    return "IELTS 5.0";
  }

  const savedLevel = window.localStorage.getItem(levelStorageKey);

  return isExactTrainingLevel(savedLevel) ? savedLevel : "IELTS 5.0";
}

function persistSelectedLevel(level: ExactTrainingLevel) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(levelStorageKey, level);
}

function isExactTrainingLevel(value: unknown): value is ExactTrainingLevel {
  return typeof value === "string" && trainingLibraryLevels.includes(value as ExactTrainingLevel);
}

function upsertRecord(
  records: EnglishTrainingRecord[],
  nextRecord: EnglishTrainingRecord
): EnglishTrainingRecord[] {
  return [
    ...records.filter((record) => record.training.date !== nextRecord.training.date),
    nextRecord
  ].sort((left, right) => left.training.date.localeCompare(right.training.date));
}

function buildHistorySummary(records: EnglishTrainingRecord[]): DailyTrainingHistorySummary {
  const completedRecords = records.filter((record) => record.training.completed);
  const learningItems = records.flatMap((record) => record.training.learningItems ?? []);
  const reviewItems = records.flatMap((record) => record.training.review ?? []);
  const reviewedItems = reviewItems.filter((item) => typeof item.correct === "boolean");

  return {
    totalDays: records.length,
    completedDays: completedRecords.length,
    learnedExpressions: learningItems.length,
    reviewAccuracy: reviewedItems.length
      ? Math.round((reviewedItems.filter((item) => item.correct).length / reviewedItems.length) * 100)
      : 0,
    recentTopics: records.slice(-8).map((record) => record.training.topic),
    recentWeaknesses: [],
    dueReviewExpressions: reviewItems.map((item) => item.expression).slice(0, 12),
    recentFeedback: records
      .slice(-8)
      .map((record) => record.training.outputTask?.feedback)
      .filter((item): item is string => !!item)
  };
}

function ensureTrainingDefaults(training: DailyTraining): DailyTraining {
  const transcriptSegments = training.transcriptSegments ?? [];
  const learningItems = training.learningItems ?? [];

  return {
    ...training,
    activeStep: training.activeStep ?? "listening",
    stepStatus: {
      listening: !!training.stepStatus?.listening,
      expression: !!training.stepStatus?.expression,
      practice: !!training.stepStatus?.practice,
      speaking: !!training.stepStatus?.speaking,
      review: !!training.stepStatus?.review
    },
    transcriptSource: training.transcriptSource ?? (transcriptSegments.length ? "auto" : "unavailable"),
    transcriptSegments,
    learningItems,
    dictation: training.dictation ?? [],
    comprehension: training.comprehension ?? [],
    shadowing: training.shadowing ?? {
      segmentIds: transcriptSegments.slice(0, 3).map((segment) => segment.id),
      recordings: {},
      completed: false
    },
    outputTask: training.outputTask ?? {
      prompt: training.speaking?.question ?? "Use three expressions from this lesson.",
      requiredItemIds: learningItems.slice(0, 3).map((item) => item.id),
      completed: false
    },
    lessonReview: training.lessonReview ?? {
      expressions: learningItems.slice(0, 3).map((item) => item.text),
      soundIssues: [],
      reviewSentence: transcriptSegments[0]?.text ?? "",
      addedToReview: false
    },
    expressions: training.expressions ?? [],
    practice: training.practice ?? { fillBlank: [], replacements: [], sentenceBuilders: [] },
    review: training.review ?? [],
    weaknesses: training.weaknesses ?? { listening: [], expression: [], speaking: [], reading: [] },
    dashboard: training.dashboard ?? {
      totalDays: 0,
      learnedExpressions: 0,
      listeningMinutes: 0,
      speakingPracticeCount: 0,
      reviewAccuracy: 0
    }
  };
}

function isTrainingRecord(value: unknown): value is EnglishTrainingRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EnglishTrainingRecord>;
  const training = record.training as Partial<DailyTraining> | undefined;

  return !!(training?.date && training.dayNumber && training.listening);
}

function getNextDayNumber(records: EnglishTrainingRecord[]): number {
  return records.length ? Math.max(...records.map((record) => record.training.dayNumber)) + 1 : 1;
}

function getLessonProgress(training: DailyTraining): number {
  const checks = [
    training.transcriptSegments.some((segment) => segment.markedUnclear || segment.completed),
    training.learningItems.some((item) => item.saved || item.mastery !== "unknown"),
    training.dictation.some((exercise) => exercise.completed),
    training.shadowing.completed || Object.keys(training.shadowing.recordings).length > 0,
    training.outputTask.completed || !!training.outputTask.feedback,
    training.completed
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getTrainingInstanceKey(training: DailyTraining): string {
  return [
    training.date,
    training.level,
    training.selectedReserveId,
    training.listening.resource.url,
    training.transcriptSegments.map((segment) => `${segment.id}:${segment.startTime}:${segment.endTime}`).join("|"),
    training.learningItems.map((item) => item.id).join("|")
  ]
    .filter(Boolean)
    .join("::");
}

function mergeReviewItems(review: ReviewItem[], items: LearningItem[]): ReviewItem[] {
  const nextItems = items.map((item) => ({
    expressionId: item.id,
    expression: item.text,
    meaning: item.meaning,
    dueDate: getTodayKey(),
    prompt: "用这个表达造一句自己的真实句子。"
  }));
  const existing = new Set(review.map((item) => item.expressionId));

  return [...review, ...nextItems.filter((item) => !existing.has(item.expressionId))];
}

function compareWords(userAnswer: string, correctText: string) {
  const userWords = normalizeWords(userAnswer);
  const correctWords = normalizeWords(correctText);
  const missingWords = correctWords.filter((word) => !userWords.includes(word));
  const incorrectWords = userWords.filter((word) => !correctWords.includes(word));

  return { missingWords, incorrectWords };
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function speakTrainingText(text: string) {
  if (typeof window === "undefined") {
    return;
  }

  const value = text.trim();

  if (!value) {
    return;
  }

  if (!window.speechSynthesis) {
    globalThis.alert("当前浏览器不支持朗读。");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1;

  const englishVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => /^en(-|_)/i.test(voice.lang));

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function getLearningTypeLabel(type: LearningItem["type"]): string {
  switch (type) {
    case "vocabulary":
      return "词汇";
    case "expression":
      return "表达";
    case "pronunciation":
      return "发音";
    case "connectedSpeech":
      return "连读";
  }
}

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}
