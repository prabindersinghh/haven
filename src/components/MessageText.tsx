import { LANG_LABEL, phraseText } from '../i18n/phrases';
import type { Lang, SayContent } from '../types';

/** Renders a SAY message in the reader's language; free text keeps its original language. */
export function sayText(c: SayContent, lang: Lang): string {
  return c.phraseId ? phraseText(c.phraseId, lang) : (c.text ?? '');
}

export function MessageText({ content, lang }: { content: SayContent; lang: Lang }) {
  const translated = Boolean(content.phraseId) && content.srcLang !== lang;
  return (
    <>
      <span>{sayText(content, lang)}</span>
      {translated && (
        <span className="orig" title="Sent in this language">
          {phraseText(content.phraseId, content.srcLang)} · {LANG_LABEL[content.srcLang]}
        </span>
      )}
      {!content.phraseId && content.srcLang !== lang && <span className="orig">{LANG_LABEL[content.srcLang]} (as written)</span>}
    </>
  );
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

export function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
