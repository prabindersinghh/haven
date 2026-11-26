// Production transport on the Nexconn Chat SDK for Web.
// Flow follows the official quickstart: initialize once -> register custom messages ->
// add handlers -> connect with a server-issued token -> send / query.

import {
  NCEngine,
  LogLevel,
  ChannelType,
  ConnectionStatusHandler,
  MessageHandler,
  ChannelHandler,
  BaseChannel,
  DirectChannel,
  GroupChannel,
  GroupChannelIdentifier,
  DirectChannelIdentifier,
  SendMessageParams,
  type AreaCode,
  type Message,
} from '@nexconn/chat';
import { MSG, type HavenMessage, type MsgType, type Session } from '../types';
import { Emitter, type ConnectionState, type Target, type Transport } from './types';

const HANDLER_ID = 'haven';
const TYPES = new Set<string>(Object.values(MSG));
let initialized = false;

export class NexconnTransport implements Transport {
  readonly mode = 'nexconn' as const;
  readonly userId: string;
  private messages = new Emitter<HavenMessage>();
  private connection = new Emitter<ConnectionState>();
  private typing = new Emitter<string>();

  constructor(private session: Session) {
    this.userId = session.userId;
  }

  async connect() {
    if (!this.session.appKey || !this.session.token) throw new Error('Nexconn session is missing appKey or token');
    if (!initialized) {
      NCEngine.initialize({
        appKey: this.session.appKey,
        areaCode: (this.session.areaCode ?? 2) as AreaCode,
        logLevel: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.WARN,
      });
      NCEngine.registerCustomMessages([
        { messageType: MSG.SAY, isPersisted: true, isCounted: true },
        { messageType: MSG.CASE, isPersisted: true, isCounted: false },
        { messageType: MSG.CHECKIN, isPersisted: true, isCounted: true },
        { messageType: MSG.HELLO, isPersisted: true, isCounted: false },
      ]);
      initialized = true;
    }

    NCEngine.addConnectionStatusHandler(
      HANDLER_ID,
      new ConnectionStatusHandler({
        onConnectionStatusChanged: ({ status }) => {
          // RCConnectionStatus: 0 connected, 1 connecting, other values are disconnected states.
          this.connection.emit(status === 0 ? 'connected' : status === 1 ? 'connecting' : 'disconnected');
        },
      }),
    );
    NCEngine.addMessageHandler(
      HANDLER_ID,
      new MessageHandler({
        onMessageReceived: ({ messages }) => {
          for (const m of messages) {
            const hm = this.normalize(m);
            if (hm) this.messages.emit(hm);
          }
        },
      }),
    );
    NCEngine.addChannelHandler(
      HANDLER_ID,
      new ChannelHandler({
        onTypingStatusChanged: ({ channelIdentifier }) => {
          if (channelIdentifier.channelType === ChannelType.DIRECT) this.typing.emit(channelIdentifier.channelId);
        },
      }),
    );

    this.connection.emit('connecting');
    const res = await NCEngine.connect({ token: this.session.token });
    if (!res.isOk) throw new Error(`Nexconn connect failed (code ${res.code})`);
    this.connection.emit('connected');
  }

  private channelFor(target: Target) {
    return target.kind === 'group' ? new GroupChannel(this.session.dispatchChannelId) : new DirectChannel(target.userId);
  }

  async send<T>(target: Target, type: MsgType, content: T): Promise<HavenMessage<T>> {
    const params = new SendMessageParams(content as Record<string, unknown>, type);
    // Urgent requests should reach volunteers who are offline: keep push enabled for SAY and CHECKIN.
    params.disableNotification = type === MSG.HELLO || type === MSG.CASE;
    const res = await this.channelFor(target).sendMessage(params);
    if (!res.isOk || !res.data) throw new Error(`Nexconn send failed (code ${res.code})`);
    return this.normalize(res.data) as HavenMessage<T>;
  }

  private async query(identifier: GroupChannelIdentifier | DirectChannelIdentifier, pages = 2) {
    const out: HavenMessage[] = [];
    const q = BaseChannel.createMessagesQuery({ channelIdentifier: identifier, pageSize: 50, isAscending: false });
    for (let i = 0; i < pages && (i === 0 || q.hasNext); i++) {
      const r = await q.loadNextPage();
      if (!r.isOk || !r.data) break;
      for (const m of r.data.data) {
        const hm = this.normalize(m);
        if (hm) out.push(hm);
      }
    }
    return out;
  }

  async loadHistory() {
    const all = await this.query(new GroupChannelIdentifier(this.session.dispatchChannelId), 4);
    const channels = await BaseChannel.createChannelsQuery({ pageSize: 50 }).loadNextPage();
    if (channels.isOk && channels.data) {
      for (const ch of channels.data.data) {
        if (ch.channelType === ChannelType.DIRECT) all.push(...(await this.query(new DirectChannelIdentifier(ch.channelId), 1)));
      }
    }
    const seen = new Set<string>();
    return all
      .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
      .sort((a, b) => a.sentTime - b.sentTime);
  }

  private normalize(m: Message): HavenMessage | null {
    if (!TYPES.has(m.messageType)) return null;
    const id = m.channelIdentifier;
    return {
      id: m.messageId || `${m.senderUserId}-${m.sentTime}`,
      type: m.messageType as MsgType,
      content: m.content,
      senderId: m.senderUserId,
      sentTime: m.sentTime,
      channel: id.channelType === ChannelType.DIRECT ? { kind: 'direct', id: id.channelId } : { kind: 'group', id: id.channelId },
    };
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
    void new DirectChannel(userId).sendTypingStatus(MSG.SAY);
  }

  async disconnect() {
    NCEngine.removeMessageHandler(HANDLER_ID);
    NCEngine.removeConnectionStatusHandler(HANDLER_ID);
    NCEngine.removeChannelHandler(HANDLER_ID);
    await NCEngine.disconnect();
  }
}
