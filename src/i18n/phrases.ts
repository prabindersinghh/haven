import type { Lang, Urgency } from '../types';

export interface Phrase {
  id: string;
  urgency: Urgency;
  /** Who normally says it: the person being cared for, or a carer replying. */
  speaker: 'member' | 'carer' | 'system';
  text: Record<Lang, string>;
  /** Extra cues (romanised and native script) that help match a spoken attempt. */
  cues?: string[];
  icon?: string;
}

/**
 * The closed-set phrase bank. Because every Awaaz message carries a phrase id rather than
 * free text, each reader sees it in their own language with no machine translation step.
 */
export const PHRASES: Phrase[] = [
  // ---- urgent
  { id: 'pain', urgency: 'high', speaker: 'member', icon: '!', text: { en: "I'm in pain", hi: 'मुझे दर्द हो रहा है', pa: 'ਮੈਨੂੰ ਦਰਦ ਹੋ ਰਿਹਾ ਹੈ' }, cues: ['pain', 'hurt', 'hurts', 'dard', 'dukh', 'peed', 'दर्द', 'ਦਰਦ'] },
  { id: 'fell', urgency: 'high', speaker: 'member', icon: '!', text: { en: 'I have fallen', hi: 'मैं गिर गया / गई हूँ', pa: 'ਮੈਂ ਡਿੱਗ ਗਿਆ / ਗਈ ਹਾਂ' }, cues: ['fall', 'fell', 'fallen', 'gir', 'gira', 'giri', 'dig', 'diggya', 'गिर', 'ਡਿੱਗ'] },
  { id: 'breath', urgency: 'high', speaker: 'member', icon: '!', text: { en: "I can't breathe properly", hi: 'मुझे साँस लेने में तकलीफ़ है', pa: 'ਮੈਨੂੰ ਸਾਹ ਲੈਣ ਵਿੱਚ ਤਕਲੀਫ਼ ਹੈ' }, cues: ['breathe', 'breath', 'breathing', 'saans', 'sans', 'saah', 'साँस', 'सांस', 'ਸਾਹ'] },
  { id: 'help', urgency: 'high', speaker: 'member', icon: '!', text: { en: 'Please come, I need help', hi: 'कृपया आइए, मुझे मदद चाहिए', pa: 'ਕਿਰਪਾ ਕਰਕੇ ਆਓ, ਮੈਨੂੰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ' }, cues: ['help', 'come', 'madad', 'bachao', 'aao', 'मदद', 'ਮਦਦ'] },
  // ---- needs
  { id: 'water', urgency: 'medium', speaker: 'member', text: { en: 'I need water', hi: 'मुझे पानी चाहिए', pa: 'ਮੈਨੂੰ ਪਾਣੀ ਚਾਹੀਦਾ ਹੈ' }, cues: ['water', 'thirsty', 'drink', 'paani', 'pani', 'पानी', 'ਪਾਣੀ'] },
  { id: 'bathroom', urgency: 'medium', speaker: 'member', text: { en: 'I need the bathroom', hi: 'मुझे बाथरूम जाना है', pa: 'ਮੈਨੂੰ ਬਾਥਰੂਮ ਜਾਣਾ ਹੈ' }, cues: ['bathroom', 'toilet', 'washroom', 'loo', 'bathroom', 'बाथरूम', 'शौचालय', 'ਬਾਥਰੂਮ'] },
  { id: 'medicine', urgency: 'medium', speaker: 'member', text: { en: 'I need my medicine', hi: 'मुझे मेरी दवाई चाहिए', pa: 'ਮੈਨੂੰ ਮੇਰੀ ਦਵਾਈ ਚਾਹੀਦੀ ਹੈ' }, cues: ['medicine', 'tablet', 'pill', 'dawai', 'dawa', 'goli', 'दवाई', 'दवा', 'ਦਵਾਈ'] },
  { id: 'family', urgency: 'medium', speaker: 'member', text: { en: 'Please call my family', hi: 'कृपया मेरे परिवार को बुलाइए', pa: 'ਕਿਰਪਾ ਕਰਕੇ ਮੇਰੇ ਪਰਿਵਾਰ ਨੂੰ ਬੁਲਾਓ' }, cues: ['family', 'son', 'daughter', 'call', 'parivar', 'beta', 'beti', 'परिवार', 'ਪਰਿਵਾਰ'] },
  { id: 'hungry', urgency: 'medium', speaker: 'member', text: { en: "I'm hungry", hi: 'मुझे भूख लगी है', pa: 'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ' }, cues: ['hungry', 'food', 'eat', 'khana', 'bhookh', 'bhukh', 'भूख', 'खाना', 'ਭੁੱਖ', 'ਖਾਣਾ'] },
  // ---- comfort / social
  { id: 'cold', urgency: 'low', speaker: 'member', text: { en: 'I feel cold', hi: 'मुझे ठंड लग रही है', pa: 'ਮੈਨੂੰ ਠੰਢ ਲੱਗ ਰਹੀ ਹੈ' }, cues: ['cold', 'blanket', 'thand', 'thandi', 'ठंड', 'ਠੰਢ'] },
  { id: 'okay', urgency: 'low', speaker: 'member', text: { en: "I'm okay", hi: 'मैं ठीक हूँ', pa: 'ਮੈਂ ਠੀਕ ਹਾਂ' }, cues: ['okay', 'ok', 'fine', 'theek', 'thik', 'ठीक', 'ਠੀਕ'] },
  { id: 'thanks', urgency: 'low', speaker: 'member', text: { en: 'Thank you', hi: 'धन्यवाद', pa: 'ਧੰਨਵਾਦ' }, cues: ['thank', 'thanks', 'shukriya', 'dhanyavaad', 'dhanvaad', 'धन्यवाद', 'शुक्रिया', 'ਧੰਨਵਾਦ'] },
  { id: 'yes', urgency: 'low', speaker: 'member', text: { en: 'Yes', hi: 'हाँ', pa: 'ਹਾਂ' }, cues: ['yes', 'haan', 'han', 'ji', 'हाँ', 'हां', 'ਹਾਂ'] },
  { id: 'no', urgency: 'low', speaker: 'member', text: { en: 'No', hi: 'नहीं', pa: 'ਨਹੀਂ' }, cues: ['no', 'nahi', 'nahin', 'नहीं', 'ਨਹੀਂ'] },

  // ---- carer quick replies
  { id: 'r_coming', urgency: 'low', speaker: 'carer', text: { en: 'Help is on the way', hi: 'मदद आ रही है', pa: 'ਮਦਦ ਆ ਰਹੀ ਹੈ' } },
  { id: 'r_where', urgency: 'low', speaker: 'carer', text: { en: 'Where does it hurt?', hi: 'दर्द कहाँ है?', pa: 'ਦਰਦ ਕਿੱਥੇ ਹੈ?' } },
  { id: 'r_calm', urgency: 'low', speaker: 'carer', text: { en: 'Stay calm, you are not alone', hi: 'घबराइए मत, आप अकेले नहीं हैं', pa: 'ਘਬਰਾਓ ਨਾ, ਤੁਸੀਂ ਇਕੱਲੇ ਨਹੀਂ ਹੋ' } },
  { id: 'r_family', urgency: 'low', speaker: 'carer', text: { en: 'We are calling your family', hi: 'आपके परिवार को बुलाया जा रहा है', pa: 'ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਨੂੰ ਬੁਲਾਇਆ ਜਾ ਰਿਹਾ ਹੈ' } },
  { id: 'r_nurse', urgency: 'low', speaker: 'carer', text: { en: 'A nurse is on the way', hi: 'नर्स आ रही हैं', pa: 'ਨਰਸ ਆ ਰਹੀ ਹੈ' } },
  { id: 'r_better', urgency: 'low', speaker: 'carer', text: { en: 'Is everything okay now?', hi: 'क्या अब सब ठीक है?', pa: 'ਕੀ ਹੁਣ ਸਭ ਠੀਕ ਹੈ?' } },

  // ---- system
  { id: 's_checkin', urgency: 'low', speaker: 'system', text: { en: 'Hello! How are you today?', hi: 'नमस्ते! आज आप कैसे हैं?', pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਅੱਜ ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?' } },
  { id: 's_notok', urgency: 'high', speaker: 'system', text: { en: 'Said "not okay" at check-in', hi: 'चेक-इन पर "ठीक नहीं" कहा', pa: 'ਚੈੱਕ-ਇਨ ਤੇ "ਠੀਕ ਨਹੀਂ" ਕਿਹਾ' } },
  { id: 's_missed', urgency: 'medium', speaker: 'system', text: { en: 'Did not answer a check-in', hi: 'चेक-इन का जवाब नहीं दिया', pa: 'ਚੈੱਕ-ਇਨ ਦਾ ਜਵਾਬ ਨਹੀਂ ਦਿੱਤਾ' } },
];

export const PHRASE_BY_ID = new Map(PHRASES.map((p) => [p.id, p]));
export const MEMBER_PHRASES = PHRASES.filter((p) => p.speaker === 'member');
export const CARER_PHRASES = PHRASES.filter((p) => p.speaker === 'carer');

export function phraseText(id: string | undefined, lang: Lang): string {
  if (!id) return '';
  return PHRASE_BY_ID.get(id)?.text[lang] ?? id;
}

export const LANG_LABEL: Record<Lang, string> = { en: 'English', hi: 'हिन्दी', pa: 'ਪੰਜਾਬੀ' };
/** BCP-47 tags used for speech recognition and synthesis. */
export const LANG_LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };
