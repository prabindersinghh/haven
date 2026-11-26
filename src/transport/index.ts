import type { Session } from '../types';
import type { Transport } from './types';

export type { Transport, Target, ConnectionState } from './types';

/** Picks the transport the server asked for. The Nexconn SDK is loaded lazily. */
export async function createTransport(session: Session): Promise<Transport> {
  if (session.mode === 'nexconn') {
    const { NexconnTransport } = await import('./nexconn');
    return new NexconnTransport(session);
  }
  const { LocalTransport } = await import('./local');
  return new LocalTransport(session.userId, session.dispatchChannelId);
}
