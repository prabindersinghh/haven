import type { Lang } from '../types';

/** Interface strings for the large-type member screen, in the member's own language. */
const STRINGS = {
  holdToSpeak: { en: 'Tap and speak', hi: 'टैप करें और बोलें', pa: 'ਟੈਪ ਕਰੋ ਅਤੇ ਬੋਲੋ' },
  listening: { en: 'Listening…', hi: 'सुन रहे हैं…', pa: 'ਸੁਣ ਰਹੇ ਹਾਂ…' },
  heardYou: { en: 'Awaaz heard you. Is it…', hi: 'आवाज़ ने सुना। क्या आपने कहा…', pa: 'ਆਵਾਜ਼ ਨੇ ਸੁਣਿਆ। ਕੀ ਤੁਸੀਂ ਕਿਹਾ…' },
  notSure: { en: "I'm not sure. Please try again, or choose below.", hi: 'मुझे पक्का नहीं पता। फिर से बोलें या नीचे चुनें।', pa: 'ਮੈਨੂੰ ਪੱਕਾ ਨਹੀਂ ਪਤਾ। ਫਿਰ ਬੋਲੋ ਜਾਂ ਹੇਠਾਂ ਚੁਣੋ।' },
  noneOfThese: { en: 'None of these', hi: 'इनमें से कोई नहीं', pa: 'ਇਹਨਾਂ ਵਿੱਚੋਂ ਕੋਈ ਨਹੀਂ' },
  orChoose: { en: 'Or choose what you want to say', hi: 'या चुनें आप क्या कहना चाहते हैं', pa: 'ਜਾਂ ਚੁਣੋ ਤੁਸੀਂ ਕੀ ਕਹਿਣਾ ਚਾਹੁੰਦੇ ਹੋ' },
  sent: { en: 'Sent to your care team', hi: 'आपकी देखभाल टीम को भेजा गया', pa: 'ਤੁਹਾਡੀ ਦੇਖਭਾਲ ਟੀਮ ਨੂੰ ਭੇਜਿਆ' },
  claimedBy: { en: 'is helping you', hi: 'आपकी मदद कर रहे हैं', pa: 'ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਰਹੇ ਹਨ' },
  waiting: { en: 'Waiting for a volunteer…', hi: 'स्वयंसेवक का इंतज़ार…', pa: 'ਵਲੰਟੀਅਰ ਦੀ ਉਡੀਕ…' },
  howAreYou: { en: 'How are you today?', hi: 'आज आप कैसे हैं?', pa: 'ਅੱਜ ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?' },
  imOkay: { en: "I'm okay", hi: 'मैं ठीक हूँ', pa: 'ਮੈਂ ਠੀਕ ਹਾਂ' },
  notOkay: { en: 'Not okay', hi: 'ठीक नहीं', pa: 'ਠੀਕ ਨਹੀਂ' },
  conversation: { en: 'Conversation', hi: 'बातचीत', pa: 'ਗੱਲਬਾਤ' },
  urgent: { en: 'Urgent', hi: 'ज़रूरी', pa: 'ਜ਼ਰੂਰੀ' },
  needs: { en: 'Needs', hi: 'ज़रूरतें', pa: 'ਲੋੜਾਂ' },
  other: { en: 'Everyday', hi: 'रोज़ की बातें', pa: 'ਰੋਜ਼ ਦੀਆਂ ਗੱਲਾਂ' },
  speakAloud: { en: 'Read aloud', hi: 'ज़ोर से पढ़ें', pa: 'ਉੱਚੀ ਪੜ੍ਹੋ' },
  noSpeech: { en: 'Voice input is not available in this browser. Choose a phrase below.', hi: 'इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। नीचे चुनें।', pa: 'ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਆਵਾਜ਼ ਇਨਪੁਟ ਉਪਲਬਧ ਨਹੀਂ। ਹੇਠਾਂ ਚੁਣੋ।' },
  you: { en: 'You', hi: 'आप', pa: 'ਤੁਸੀਂ' },
  showCard: { en: 'Or show a card', hi: 'या कार्ड दिखाएँ', pa: 'ਜਾਂ ਕਾਰਡ ਦਿਖਾਓ' },
  tryAgain: { en: 'Try again', hi: 'फिर से बोलें', pa: 'ਫਿਰ ਬੋਲੋ' },
  stop: { en: 'Tap to stop', hi: 'रोकने के लिए टैप करें', pa: 'ਰੋਕਣ ਲਈ ਟੈਪ ਕਰੋ' },
  latest: { en: 'Latest reply', hi: 'नया जवाब', pa: 'ਨਵਾਂ ਜਵਾਬ' },
} satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof STRINGS;
export const t = (key: UiKey, lang: Lang) => STRINGS[key][lang];
