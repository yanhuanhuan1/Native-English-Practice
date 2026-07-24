interface SpeakEnglishOptions {
  onEnd?: () => void;
  onError?: () => void;
  onStart?: () => void;
  pitch?: number;
  rate?: number;
}

export function speakEnglishWithBestVoice(text: string, options: SpeakEnglishOptions = {}): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const value = text.trim();

  if (!value) {
    return null;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = "en-US";
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = 1;

  if (options.onStart) {
    utterance.onstart = options.onStart;
  }

  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }

  if (options.onError) {
    utterance.onerror = options.onError;
  }

  const speak = () => {
    const voice = selectPreferredEnglishVoice(window.speechSynthesis.getVoices());

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-US";
    }

    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();

  if (voices.length) {
    speak();
    return utterance;
  }

  let spoken = false;
  const previousHandler = window.speechSynthesis.onvoiceschanged;
  const speakOnce = () => {
    if (spoken) {
      return;
    }

    spoken = true;
    window.speechSynthesis.onvoiceschanged = previousHandler;
    speak();
  };

  window.speechSynthesis.onvoiceschanged = speakOnce;
  window.setTimeout(speakOnce, 180);

  return utterance;
}

export function selectPreferredEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));

  if (!englishVoices.length) {
    return voices[0] ?? null;
  }

  return [...englishVoices].sort((first, second) => getEnglishVoiceScore(second) - getEnglishVoiceScore(first))[0];
}

function getEnglishVoiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  const service = voice.voiceURI.toLowerCase();
  let score = 0;

  if (lang === "en-us") {
    score += 45;
  } else if (lang.startsWith("en-us")) {
    score += 38;
  } else if (lang === "en-gb") {
    score += 28;
  } else if (lang.startsWith("en-")) {
    score += 16;
  }

  if (name.includes("google") || service.includes("google")) {
    score += 90;
  }

  if (name.includes("microsoft") || service.includes("microsoft")) {
    score += 80;
  }

  if (name.includes("aria") || name.includes("jenny") || name.includes("guy")) {
    score += 70;
  }

  if (name.includes("natural") || name.includes("neural")) {
    score += 60;
  }

  if (name.includes("online")) {
    score += 45;
  }

  if (name.includes("enhanced") || name.includes("premium")) {
    score += 25;
  }

  if (!voice.localService) {
    score += 15;
  }

  if (voice.default) {
    score += 8;
  }

  if (name.includes("compact")) {
    score -= 25;
  }

  return score;
}
