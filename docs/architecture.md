# Haven architecture

## Overview

```
┌──────────── Browser: member ────────────┐        ┌──────── Haven app server ────────┐
│ Large-type UI (EN / HI / PA)            │  POST  │ /api/session                     │
│ AwaazEngine: LISTEN→MATCH→FUSE→CHECK    │───────▶│  • validate profile              │
│ SPEAK: speechSynthesis in reader's lang │ token  │  • /v4/auth/access-token/issue   │
│ NexconnTransport (@nexconn/chat)        │◀───────│  • /v4/group-channel/create|join │
└───────────────┬─────────────────────────┘        │  SHA1(secret+nonce+ts) signing   │
                │                                   │  primary/backup domain failover │
                ▼                                   └──────────────────────────────────┘
        ┌──────────────── Nexconn Chat Cloud ────────────────┐
        │ Group channel "havendispatch"  (requests, cases)   │
        │ Direct channels                (1:1 replies)        │
        │ Custom messages · history · push · typing           │
        └───────────────┬────────────────────────────────────┘
                        ▼
┌──────── Browser: volunteer / staff / family ────────┐
│ Dispatch console: cases, claim/escalate/resolve,    │
│ quick replies, check-ins, SLA + missed check-in     │
│ timers (volunteer & staff only)                     │
└─────────────────────────────────────────────────────┘
```

## Messages

All application data travels as registered Nexconn custom messages.

| Type | Channel | Content | Persisted / counted |
|---|---|---|---|
| `haven:say` | group (member) or direct (carer) | `phraseId?`, `text?`, `srcLang`, `urgency`, `from`, `caseId?`, `to?` | yes / yes |
| `haven:case` | group | `caseId`, `subjectId`, `state`, `actor`, `reasonPhraseId?`, `urgency?` | yes / no |
| `haven:checkin` | group | `checkInId`, `subjectId`, `kind: ask \| reply`, `response?`, `from` | yes / yes |
| `haven:hello` | group | `from` (profile announcement) | yes / no |

Messages carry a **phrase id**, not translated text, so rendering in the reader's language is deterministic and needs no translation service.

## Case lifecycle

```
            claim            reply             resolve
  NEW ───────────▶ CLAIMED ─────────▶ IN_PROGRESS ─────────▶ RESOLVED
   │                                                    ▲
   │ unclaimed past SLA (high 2 min, medium 5 min)      │
   └──────────────▶ ESCALATED ──── claim ───────────────┘
```

Cases open when a member sends a `high` or `medium` phrase and has no open case, when a check-in reply is "not okay", or when a check-in is unanswered for 10 minutes. `RESOLVED` is terminal.

## State

`src/model/state.ts` folds the ordered message log into `people`, `cases` and `checkIns`. The reducer ignores duplicate message ids, so live delivery and history loading can overlap safely. Because state is derived only from messages, any client that reconnects rebuilds the same view from Nexconn history.

## Awaaz reference engine

`src/awaaz/match.ts` scores each phrase in the bank against recogniser hypotheses:

- **text evidence**: cue words (romanised and native script) and character-trigram similarity against the phrase in all three languages
- **habit prior**: a smoothed frequency of the member's own confirmations, overall and by part of day; it only separates close candidates
- **abstention**: if the best score is below the threshold, no candidates are proposed

The production, speaker-adaptive Awaaz engine is proprietary and plugs in behind the `AwaazEngine` interface in `src/awaaz/engine.ts`.

## Demo transport

When the server has no Nexconn credentials, `/api/session` returns `mode: "local"` and the client uses `LocalTransport`, which mirrors the group + direct semantics across tabs of one browser with `BroadcastChannel` and `localStorage`. It is never used when Nexconn is configured.
