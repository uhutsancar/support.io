// The SLA background sweep — the only one.
//
// SLA counters depend on the clock: "time remaining" changes every second. This
// used to be computed on the read path and written back on every request, so
// `GET /conversations/:siteId` issued up to fifty UPDATEs in a single call.
// That cost three things: a read request could not go to a replica because it
// wrote; two agents looking at the same inbox fought over the same rows; and
// `updated_at` came to mean "last viewed" rather than "last changed".
//
// The read path now computes SLA in memory for display only. Persisting it and
// raising breaches happens here, and only for conversations that are actually
// due (`next_sla_check_at`), so the work scales with what needs checking rather
// than with the number of open tickets.
//
// There were two of these. This sweep ran every 60 seconds, and
// `SocketHandler.startSLAMonitoring` ran the same query, the same
// `calculateSLA()`, the same save and the same escalation every 30 seconds —
// so every due conversation was processed twice, breaches were escalated twice,
// and the two raced to write the same rows. Worse, `SLA_SWEEPER=off` (which
// exists so a multi-process deployment can sweep from one process only) turned
// off this one and left the socket handler's copy running in every process.
// The socket version's extra behaviour — seeding rows that have never been
// checked, deferring outside business hours, and emitting `conversation-update`
// / `sla-breach` to the site room — has been folded in below.

import Conversation from '../models/Conversation';
import Site from '../models/Site';
import { sendSLAWarning, handleSLABreach } from './escalation';
import { checkAndReassign } from './autoAssignment';
import { shouldCalculateSLA } from './businessHours';
import { refreshSla } from './conversationSla';
import { ACTIVE_CONVERSATION_STATUSES } from '../domain';
import { AdminNotifier } from '../realtime';
import type { Server } from 'socket.io';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

const DEFAULT_INTERVAL_MS = 60 * 1000;

// Upper bound for one pass. If a backlog builds up the next pass continues;
// pulling tens of thousands of rows into memory at once would stall the server.
const DEFAULT_BATCH = 200;

/** When a conversation is deferred past business hours, it resumes here. */
const NEXT_BUSINESS_MORNING_HOUR = 9;

let timer: NodeJS.Timeout | null = null;
let running = false;

/** The four SLA figures a change is judged against. */
interface SlaSnapshot {
  firstResponseStatus: string | undefined;
  resolutionStatus: string | undefined;
  firstResponseRemaining: number | null | undefined;
  resolutionRemaining: number | null | undefined;
}

function snapshot(conversation: Doc<ConversationDoc>): SlaSnapshot {
  return {
    firstResponseStatus: conversation.sla?.firstResponseStatus,
    resolutionStatus: conversation.sla?.resolutionStatus,
    firstResponseRemaining: conversation.sla?.firstResponseTimeRemaining,
    resolutionRemaining: conversation.sla?.resolutionTimeRemaining
  };
}

function changed(before: SlaSnapshot, after: SlaSnapshot): boolean {
  return (
    before.firstResponseStatus !== after.firstResponseStatus ||
    before.resolutionStatus !== after.resolutionStatus ||
    before.firstResponseRemaining !== after.firstResponseRemaining ||
    before.resolutionRemaining !== after.resolutionRemaining
  );
}

/** Tomorrow morning, for a conversation whose department is closed right now. */
function nextBusinessMorning(): Date {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(NEXT_BUSINESS_MORNING_HOUR, 0, 0, 0);
  return at;
}

/** The organization a conversation belongs to, preferring its own column. */
async function organizationOf(conversation: Doc<ConversationDoc>): Promise<unknown> {
  if (conversation.organizationId) return conversation.organizationId;
  const site = await Site.findById(conversation.siteId).select('organizationId');
  return site?.organizationId ?? null;
}

/**
 * One pass: take the conversations that are due, recompute, persist what moved,
 * and announce any new breach.
 */
async function sweepOnce(
  io: Server | null,
  { batchSize = DEFAULT_BATCH }: { batchSize?: number } = {}
) {
  const notifier = io ? new AdminNotifier(io) : null;

  // A closed ticket's SLA clock does not run. `nextSlaCheckAt: null` is
  // included so a conversation that has never been checked — one created before
  // this sweep existed, or seeded by a fixture — gets picked up rather than
  // waiting forever for a timestamp nothing will ever set.
  const due = await Conversation.find({
    status: { $in: ACTIVE_CONVERSATION_STATUSES },
    $or: [{ nextSlaCheckAt: { $lte: new Date() } }, { nextSlaCheckAt: null }]
  })
    .populate('department', 'name color icon businessHours sla')
    .sort({ nextSlaCheckAt: 1 })
    .limit(batchSize);

  if (!due.length) return { checked: 0, written: 0, breached: 0 };

  let written = 0;
  let breached = 0;

  for (const conversation of due) {
    try {
      // A department that only counts business hours has its clock paused
      // outside them; the conversation is parked until the next morning.
      if (conversation.department && !shouldCalculateSLA(conversation.department)) {
        conversation.nextSlaCheckAt = nextBusinessMorning();
        await conversation.save();
        continue;
      }

      const before = snapshot(conversation);
      refreshSla(conversation);
      const after = snapshot(conversation);

      // save() skips unchanged fields; the real saving is that this loop runs
      // once a minute rather than once per request.
      await conversation.save();
      written++;

      if (!notifier) continue;

      // The panel re-renders the row whenever any of the four figures moved,
      // not only on a breach — that is what makes the countdown live.
      if (changed(before, after)) {
        notifier.conversationUpdated(conversation, conversation);
      }

      const newBreaches = [
        before.firstResponseStatus !== 'breached' && after.firstResponseStatus === 'breached'
          ? 'first-response'
          : null,
        before.resolutionStatus !== 'breached' && after.resolutionStatus === 'breached'
          ? 'resolution'
          : null
      ].filter(Boolean) as string[];

      if (newBreaches.length === 0) {
        // Not breached yet — warn if it is close to the threshold.
        await sendSLAWarning(conversation, io!);
        continue;
      }

      breached++;
      const organizationId = await organizationOf(conversation);
      if (organizationId) {
        await handleSLABreach(conversation, String(organizationId), io!);
      }

      for (const type of newBreaches) {
        notifier.toSite(conversation.siteId, 'sla-breach', {
          conversationId: conversation._id,
          ticketNumber: conversation.ticketNumber,
          type,
          conversation: conversation.toObject()
        });
      }

      // Nobody has answered and the first-response clock has run out: try to
      // put it in front of someone else.
      if (
        newBreaches.includes('first-response') &&
        !conversation.firstResponseAt &&
        organizationId
      ) {
        await checkAndReassign(conversation._id, String(organizationId));
      }
    } catch (error) {
      // One bad conversation must not end the pass.
      console.error('[sla] sweep failed for conversation', conversation._id, error);
    }
  }

  return { checked: due.length, written, breached };
}

function startSlaSweeper(
  io: Server,
  {
    intervalMs = Number(process.env.SLA_SWEEP_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  }: { intervalMs?: number } = {}
): NodeJS.Timeout {
  if (timer) return timer;

  const tick = async () => {
    // A pass that overruns must not overlap with the next one.
    if (running) return;
    running = true;
    try {
      await sweepOnce(io);
    } catch (error) {
      console.error('[sla] sweep pass failed', error);
    } finally {
      running = false;
    }
  };

  void tick();
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return timer;
}

function stopSlaSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export { startSlaSweeper, stopSlaSweeper, sweepOnce };
