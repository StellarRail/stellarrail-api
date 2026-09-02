import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
export interface Notification { id: string; type: string; payload: any; read: boolean; createdAt: Date; }
@Injectable()
export class NotificationsService {
  private items: Notification[] = [];
  queued: Notification[] = [];
  enqueue(type: string, payload: any): Notification {
    const n = { id: randomUUID(), type, payload, read: false, createdAt: new Date() };
    this.items.push(n); this.queued.push(n);
    return n;
  }
  list() { return this.items; }
  markRead(id: string) { const n = this.items.find((x) => x.id === id); if (n) n.read = true; return n; }
}
