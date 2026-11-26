import type { HavenMessage, MsgType } from '../types';

export type Target = { kind: 'group' } | { kind: 'direct'; userId: string };
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

/**
 * The messaging layer Haven depends on. NexconnTransport is the production implementation;
 * LocalTransport is an in-browser stand-in used only when the server has no Nexconn credentials.
 */
export interface Transport {
  readonly mode: 'nexconn' | 'local';
  readonly userId: string;
  connect(): Promise<void>;
  send<T>(target: Target, type: MsgType, content: T): Promise<HavenMessage<T>>;
  /** Recent history of the dispatch group and of this user's direct channels, oldest first. */
  loadHistory(): Promise<HavenMessage[]>;
  onMessage(cb: (m: HavenMessage) => void): () => void;
  onConnection(cb: (s: ConnectionState) => void): () => void;
  sendTyping(userId: string): void;
  onTyping(cb: (userId: string) => void): () => void;
  disconnect(): Promise<void>;
}

export class Emitter<T> {
  private subs = new Set<(v: T) => void>();
  on(cb: (v: T) => void) {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }
  emit(v: T) {
    this.subs.forEach((cb) => cb(v));
  }
}
