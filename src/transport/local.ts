// Demo-only transport used when the server has no Nexconn credentials configured.
// It mirrors the Nexconn semantics Haven relies on (one dispatch group + 1:1 direct channels)
// across browser tabs on the same origin, using BroadcastChannel + localStorage.
// It is never used when the server is configured for Nexconn.

import type { HavenMessage, MsgType } from '../types';
import { Emitter, type ConnectionState, type Target, type Transport } from './types';

const STORE_KEY = 'haven.local.log.v1';
const BUS = 'haven-local-bus';
const MAX = 500;

interface Envelope {
  id: string;
  type: MsgType;
  content: unknown;
  senderId: string;
  sentTime: number;
  target: { kind: 'group'; id: string } | { kind: 'direct'; to: string };
}

function readLog(): Envelope[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as Envelope[];
  } catch {
    return [];
  }
}

export class LocalTransport implements Transport {
  readonly mode = 'local' as const;
  private bus: BroadcastChannel | null = null;
  private messages = new Emitter<HavenMessage>();
  private connection = new Emitter<ConnectionState>();
  private typing = new Emitter<string>();

  constructor(readonly userId: string, private groupId: string) {}

  async connect() {
    this.bus = new BroadcastChannel(BUS);
    this.bus.onmessage = (e: MessageEvent) => {
      const data = e.data as { kind: 'msg'; env: Envelope } | { kind: 'typing'; from: string; to: string };
      if (data.kind === 'typing') {
        if (data.to === this.userId) this.typing.emit(data.from);
        return;
      }
      const hm = this.view(data.env);
      if (hm) this.messages.emit(hm);
    };
    this.connection.emit('connected');
  }

  /** Projects an envelope into this user's view, or null if it is not addressed to them. */
  private view(env: Envelope): HavenMessage | null {
    if (env.target.kind === 'group') {
      return { ...env, channel: { kind: 'group', id: env.target.id } } as HavenMessage;
    }
    const { to } = env.target;
    if (to !== this.userId && env.senderId !== this.userId) return null;
    const other = env.senderId === this.userId ? to : env.senderId;
    return { ...env, channel: { kind: 'direct', id: other } } as HavenMessage;
  }

  async send<T>(target: Target, type: MsgType, content: T) {
    const env: Envelope = {
      id: crypto.randomUUID(),
      type,
      content,
      senderId: this.userId,
      sentTime: Date.now(),
      target: target.kind === 'group' ? { kind: 'group', id: this.groupId } : { kind: 'direct', to: target.userId },
    };
    const log = readLog();
    log.push(env);
    localStorage.setItem(STORE_KEY, JSON.stringify(log.slice(-MAX)));
    this.bus?.postMessage({ kind: 'msg', env });
    return this.view(env) as HavenMessage<T>;
  }

  async loadHistory() {
    return readLog()
      .map((e) => this.view(e))
      .filter((m): m is HavenMessage => m !== null);
  }

  onMessage(cb: (m: HavenMessage) => void) {
    return this.messages.on(cb);
  }
  onConnection(cb: (s: ConnectionState) => void) {
    return this.connection.on(cb);
  }
  onTyping(cb: (userId: string) => void) {
    return this.typing.on(cb);
  }
  sendTyping(userId: string) {
    this.bus?.postMessage({ kind: 'typing', from: this.userId, to: userId });
  }
  async disconnect() {
    this.bus?.close();
    this.bus = null;
  }

  static reset() {
    localStorage.removeItem(STORE_KEY);
  }
}
