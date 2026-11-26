// Awaaz engine interface and the open reference implementation shipped in this repository.
//
// The production Awaaz engine (speaker-dependent matching against each user's own enrolled
// recordings, from the NeuroTrace project) is proprietary and not included here. It plugs in
// behind the same AwaazEngine interface. The reference engine below uses the browser's speech
// recogniser for hypotheses and ranks them against the closed phrase bank, keeping the same
// product contract: propose the top 3, abstain when unsure, never send without confirmation.

import { LANG_LOCALE } from '../i18n/phrases';
import type { Lang } from '../types';
import { emptyHabits, rankPhrases, recordConfirmation, type HabitModel, type MatchResult } from './match';

export interface AwaazResult extends MatchResult {
  transcript: string;
}

export interface AwaazEngine {
  readonly name: string;
  /** Whether live voice input is possible in this environment. */
  readonly available: boolean;
  /** LISTEN -> MATCH -> FUSE -> CHECK. Resolves with ranked candidates or an abstention. */
  listen(lang: Lang, signal?: AbortSignal): Promise<AwaazResult>;
  /** Called when the user confirms a phrase; personalises future ranking. */
  confirm(phraseId: string): void;
}

/* Minimal typing for the Web Speech API, which is not in lib.dom for all browsers. */
interface RecognitionAlternative { transcript: string; confidence: number }
interface RecognitionEvent { results: ArrayLike<ArrayLike<RecognitionAlternative> & { isFinal: boolean }> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class ReferenceAwaazEngine implements AwaazEngine {
  readonly name = 'Awaaz reference engine';
  private habits: HabitModel;

  constructor(private storageKey: string) {
    try {
      this.habits = JSON.parse(localStorage.getItem(storageKey) ?? '') as HabitModel;
    } catch {
      this.habits = emptyHabits();
    }
  }

  get available() {
    return recognitionCtor() !== null;
  }

  listen(lang: Lang, signal?: AbortSignal): Promise<AwaazResult> {
    const Ctor = recognitionCtor();
    if (!Ctor) return Promise.reject(new Error('speech recognition unavailable'));
    return new Promise((resolve, reject) => {
      const rec = new Ctor();
      rec.lang = LANG_LOCALE[lang];
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.continuous = false;
      const hypotheses: string[] = [];
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        const r = rankPhrases(hypotheses, this.habits, lang);
        resolve({ ...r, transcript: hypotheses[0] ?? '' });
      };
      rec.onresult = (e) => {
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          for (let j = 0; j < res.length; j++) hypotheses.push(res[j].transcript);
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return finish();
        settled = true;
        reject(new Error(e.error));
      };
      rec.onend = finish;
      signal?.addEventListener('abort', () => rec.stop());
      rec.start();
    });
  }

  /** Ranks typed text the same way as speech. Used by tests and the keyboard fallback. */
  rankText(text: string, lang: Lang) {
    return { ...rankPhrases([text], this.habits, lang), transcript: text };
  }

  confirm(phraseId: string) {
    this.habits = recordConfirmation(this.habits, phraseId);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.habits));
    } catch {
      /* storage can be unavailable; personalisation is best-effort */
    }
  }
}

/** SPEAK: reads a phrase aloud in the listener's language with the best available voice. */
export function speak(text: string, lang: Lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_LOCALE[lang];
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (voice) u.voice = voice;
  u.rate = 0.92;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
