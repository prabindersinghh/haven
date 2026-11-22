# Haven — powered by Awaaz

**Chat for people who can't be understood.**

Haven is an accessible, multilingual care chat for seniors and people with neurological speech impairment (after a stroke, or with Parkinson's, ALS/MND, cerebral palsy or a brain injury). It is built on the **Nexconn Chat SDK** for the Nexconn Build Challenge, in the **Humanitarian & Social Good** track.

> Haven supports care. It does not diagnose.

---

## The problem

After a stroke or in many neurological conditions, people develop **dysarthria**: the muscles used for speech are weak, so words come out slurred or slow. Their thinking is fine, but:

- family, nurses and volunteers **can't understand them**
- they **can't type** easily on a phone
- standard speech recognition is **trained on healthy voices** and fails on dysarthric speech
- there is **no public dysarthric speech dataset in Hindi or Punjabi**

The result is unmet needs, frustration and isolation, and help that arrives late.

## The solution

| Layer | What it does |
|---|---|
| **Awaaz** (input) | Learns each user's *own* voice from a few everyday phrases. Shows the **top 3 likely phrases** as big buttons. The user confirms with one tap. If Awaaz isn't confident, it asks the user to try again instead of guessing. |
| **Haven chat** (Nexconn) | The confirmed message is sent over the Nexconn Chat SDK. **Each reader sees it in their own language** (EN / HI / PA), with optional clear text-to-speech. |
| **Dispatch** | Urgent phrases ("I'm in pain", "I fell") become **case cards** in a volunteer dispatch room. A volunteer **claims** the case with one tap; unclaimed cases **escalate** to staff. |
| **Check-ins** | Scheduled peer-support check-ins. No reply, or a reply of "not okay", alerts a volunteer. |

## How a message flows

```
 User speaks (slurred)        Awaaz on device              Nexconn Chat SDK              Volunteer
 "paani... dard..."   ──▶  match own voice examples  ──▶  Awaaz message (1:1)    ──▶  reads in own language
                            top-3 big buttons              + urgency tag                 hears clear TTS
                            user taps "I'm in pain"        ──▶ case card in              claims ▸ replies
                            (abstains if unsure)               Dispatch room (group)     ▸ resolves
```

## Nexconn Chat SDK usage

- **1:1 channels**: user ↔ volunteer / family
- **Group channels**: volunteer dispatch room, peer-support circles
- **Custom message types**: `AwaazMessage`, `CaseCard` (Claim / Escalate / Resolve), `CheckIn`
- **Message history**: case timeline and handover
- **Read receipts, presence, typing**: user can see that someone is responding
- **Push**: urgent cases and missed check-ins
- **Server SDK + callbacks**: per-reader translation, urgency tagging, claim timeouts, scheduled check-ins

## Architecture

```
┌──────────────── Phone (user) ────────────────┐      ┌──────── Haven server ────────┐
│ Large-font UI · Awaaz on-device engine        │      │ Nexconn Server SDK           │
│ LISTEN → MATCH → FUSE → CHECK → SPEAK         │      │ Translation service          │
│ Nexconn Chat SDK client                       │◀────▶│ Urgency tagger · Case engine │
└───────────────────────────────────────────────┘      │ Check-in scheduler           │
┌──────────── Volunteer / staff app ────────────┐      └──────────────┬───────────────┘
│ Dispatch room · Case cards · 1:1 chat         │◀───── Nexconn Chat Cloud ─────┘
└───────────────────────────────────────────────┘
```

## Privacy and safety

- Voice audio is processed **on the device**. Only confirmed phrases are sent.
- **Nothing is sent without the user's confirmation**, and Awaaz abstains when it isn't sure.
- Haven is opt-in and consent-based, with role-based access (user, volunteer, staff, family).
- It is a communication and care-coordination tool, **not a diagnostic device**.

## Background

Awaaz was the flagship feature of **NeuroTrace**, our post-stroke recovery system, which placed in the **Top 5 nationally out of 39,843+ applications** at Samsung Solve for Tomorrow 2026. Haven takes Awaaz beyond stroke recovery and connects it to a live, multilingual care network.

## Status

🚧 Code is being committed during the challenge. See the write-up PDF in the submission for the full design.

## Team

Team **Incognito**: Thapar Institute of Engineering & Technology, Patiala.

## License

MIT (Haven application code). Awaaz core algorithms © the NeuroTrace team; proprietary and not included in this repository.
