/**
 * Veridata AppDeploy backend — review candidate, NOT DEPLOYED.
 * Requires current AppDeploy SDK's db.tx + requireAuth + notifications + secrets.
 */
import { router, json, error, db, notifications, requireAuth, secrets,
  isAppDatabaseError } from '@appdeploy/sdk';
import { chosenLeadId, parseLeadInput, publicReceipt, sameSubmission } from './lead-core.ts';

const LEAD_TABLE = 'inbound_leads';
const OWNER_TOPIC = 'veridata-new-leads';

async function ownerAuthorized(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    // Never place this identifier in frontend source or public API responses.
    const expected = await secrets.readSecret('VERIDATA_OWNER_USER_ID');
    return !!expected && expected === userId;
  } catch {
    // Missing secret fails closed: no privileged read, no topic subscription.
    return false;
  }
}

async function savedMatching(id: string, payload: Record<string, unknown>): Promise<boolean> {
  const [saved] = await db.get<Record<string, unknown>>(LEAD_TABLE, [id], {
    consistent: true,
  });
  return !!saved && sameSubmission(saved, payload as Parameters<typeof sameSubmission>[1]);
}

async function notifyOwnerAfterSave(id: string): Promise<void> {
  try {
    // No prospect name/email/notes in push or logs.
    const delivered = await notifications.sendToTopic({
      topic: OWNER_TOPIC,
      notification: {
        title: 'Veridata: new service request',
        body: 'A new inquiry needs a review in the protected operator inbox.',
      },
      data: { kind: 'new-lead' },
    });
    if (delivered.sent > 0) {
      // Best-effort receipt; the lead remains persisted even on alert failure.
      await db.tx.update(LEAD_TABLE, [{
        id,
        record: { alertStatus: 'delivered' },
        if: { alertStatus: 'pending' },
      }], { patch: true });
    }
  } catch {
    // A saved lead must not become a misleading 'failed form' because push failed.
    // Keep alertStatus=pending for the operator to reconcile manually.
    console.error('Veridata internal alert was not confirmed');
  }
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'POST /api/leads': [
    async ({ body }) => {
      const parsed = parseLeadInput(body);
      if (!parsed.ok) return error(parsed.reason, 400);
      if (parsed.honeypot) return json({ ok: true });
      const lead = parsed.data;
      const record = {
        name: lead.name,
        email: lead.email,
        company: lead.company,
        state: lead.state,
        rowCount: lead.rowCount,
        offer: lead.offer,
        priority: lead.priority,
        notes: lead.notes,
        source: 'veridata_pilot_landing_page',
        status: 'new',
        alertStatus: 'pending',
        createdAt: new Date().toISOString(),
      };

      let id: string | null = null;
      try {
        if (lead.requestId) {
          id = chosenLeadId(lead.requestId);
          const [added] = await db.tx.add(LEAD_TABLE, [{ id, ...record }]);
          if (!added) {
            // Chosen-ID already committed. Same payload receives same receipt.
            if (await savedMatching(id, lead)) return json(publicReceipt(id));
            return error('This receipt is already associated with another request.', 409);
          }
        } else {
          // Compatibility for requests sent by the existing deployed client.
          const [added] = await db.add(LEAD_TABLE, [record]);
          if (!added) return error('Could not save the request. Please retry.', 503);
          id = added;
        }
      } catch (err: unknown) {
        // Unknown/duplicate commit outcome: reconcile with the original receipt.
        // Never blindly re-issue the write with a different ID.
        if (lead.requestId && id && isAppDatabaseError(err) &&
          (err.code === 'AppDatabaseDuplicateId' || err.code === 'AppDatabaseUnknownOutcome')) {
          try {
            if (await savedMatching(id, lead)) return json(publicReceipt(id));
          } catch { /* Incomplete read is NOT proof that no write happened. */ }
        }
        console.error('Veridata inquiry write was not confirmed');
        return error('We could not confirm your request. Retry without refreshing the page.', 503);
      }

      await notifyOwnerAfterSave(id);
      return json(publicReceipt(id));
    },
  ],

  // Protected operator inbox: no CRM export, no bulk messaging, no public PII.
  'GET /api/operator/leads': [
    requireAuth(),
    async ({ user }) => {
      if (!(await ownerAuthorized(user?.userId))) return error('Forbidden', 403);
      try {
        const page = await db.list(LEAD_TABLE, { limit: 25 });
        return json({ items: page.items, nextToken: page.nextToken ?? null });
      } catch {
        return error('Operator inbox unavailable', 503);
      }
    },
  ],

  // Admin topic membership is server-authorized. Browser permission must be
  // requested separately by an explicit owner click via client notifications.subscribe().
  'POST /api/operator/subscribe-alerts': [
    requireAuth(),
    async ({ user }) => {
      if (!(await ownerAuthorized(user?.userId))) return error('Forbidden', 403);
      try {
        await notifications.subscribeTopic({ userIds: [user!.userId], topic: OWNER_TOPIC });
        return json({ ok: true });
      } catch {
        return error('Could not enable internal alerts', 503);
      }
    },
  ],
});
