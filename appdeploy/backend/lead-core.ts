/**
 * Pure lead validation for the Veridata AppDeploy request form.
 * No SDK, network or customer-specific dependencies.
 */
export type LeadPayload = {
  name: string;
  email: string;
  company: string;
  state: string;
  rowCount: string;
  offer: string;
  priority: string;
  notes: string;
  requestId: string | null;
};

const clean = (value: unknown, limit: number): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : '';

export function parseLeadInput(raw: unknown):
  | { ok: true; data: LeadPayload; honeypot: boolean }
  | { ok: false; reason: string } {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  // Do not reveal honeypot behavior to public callers.
  if (clean(input.website, 200)) {
    return { ok: true, honeypot: true, data: {
      name: '', email: '', company: '', state: '', rowCount: '',
      offer: '', priority: '', notes: '', requestId: null,
    }};
  }
  const name = clean(input.name, 100);
  const email = clean(input.email, 200).toLowerCase();
  const state = clean(input.state, 80);
  const requestId = clean(input.requestId, 80);
  if (!name || !state || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'Please provide a name, valid email, and primary state.' };
  }
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return { ok: false, reason: 'Invalid request receipt. Please reload and try again.' };
  }
  return {
    ok: true,
    honeypot: false,
    data: {
      name,
      email,
      company: clean(input.company, 150),
      state,
      rowCount: clean(input.rowCount, 40),
      offer: clean(input.offer, 100),
      priority: clean(input.priority, 100),
      notes: clean(input.notes, 1000),
      requestId: requestId ? requestId.toLowerCase() : null,
    },
  };
}

export function chosenLeadId(requestId: string): string {
  // A stable, table-safe opaque ID. Caller UUID is not user identity.
  return 'lead_' + requestId.replaceAll('-', '');
}

export function sameSubmission(
  saved: Record<string, unknown>,
  incoming: LeadPayload,
): boolean {
  const fields: (keyof Omit<LeadPayload, 'requestId'>)[] = [
    'name', 'email', 'company', 'state', 'rowCount', 'offer', 'priority', 'notes',
  ];
  return fields.every((field) => saved[field] === incoming[field]);
}

export function publicReceipt(id: string): { ok: true; requestId: string } {
  return { ok: true, requestId: id };
}
