import { EventEmitter } from 'events';

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitEvent(event: string, payload: unknown): void {
  bus.emit(event, payload);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onEvent(event: string, handler: (payload: any) => Promise<void>): void {
  bus.on(event, (payload) => {
    handler(payload).catch(console.error);
  });
}
