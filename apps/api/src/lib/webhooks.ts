import crypto from 'crypto';
import prisma from './prisma';

/**
 * Outbound webhook dispatch for the public API/integrations layer. Deliberately
 * separate from lib/events.ts's internal `emitEvent` (that's the in-process
 * notification bus, unrelated) — this one fans out to external subscriber
 * URLs with an HMAC signature. Fire-and-forget via setImmediate; no retry
 * queue yet (that's Phase 7 / BullMQ) — a slow or dead endpoint gets exactly
 * one delivery attempt today, logged either way in WebhookDelivery.
 */
export function dispatchWebhookEvent(organizationId: string, eventType: string, payload: unknown): void {
  setImmediate(() => {
    void deliver(organizationId, eventType, payload);
  });
}

async function deliver(organizationId: string, eventType: string, payload: unknown): Promise<void> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { organizationId, isActive: true, eventTypes: { has: eventType } },
  });

  for (const sub of subscriptions) {
    const body = JSON.stringify({ eventType, payload, sentAt: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex');

    let statusCode: number | undefined;
    let success = false;
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aadhirai-Signature': signature, 'X-Aadhirai-Event': eventType },
        body,
      });
      statusCode = res.status;
      success = res.ok;
    } catch {
      success = false;
    }

    await prisma.webhookDelivery.create({
      data: { subscriptionId: sub.id, eventType, payload: payload as object, statusCode, success },
    });
  }
}
