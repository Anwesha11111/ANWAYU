import { Request, Response, NextFunction } from 'express';
import { runQuery, withTransaction } from '../config/database';
import { apiSuccess, apiError } from '../types';
import { logger } from '../config/logger';
import type { ClientSyncPayload, SyncJournalEntry, ServerDeltaPack } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ─── POST /api/sync/delta ─────────────────────────────────────────────────────
/**
 * Pseudo-CRDT / Last-Write-Wins (LWW) merge engine.
 *
 * Algorithm:
 * 1. Parse client journal (operations + client vector clock)
 * 2. For each operation, compare client_timestamp vs latest server record
 * 3. LWW rule: higher timestamp wins; ties → server wins
 * 4. Apply accepted ops inside a transaction
 * 5. Return delta pack: what was applied, what conflicted, what client is missing
 */
export async function deltaSyncHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as ClientSyncPayload;
    const { device_id, client_vector_clock, operations } = body;

    if (!device_id || !Array.isArray(operations)) {
      res.status(400).json(apiError('INVALID_PAYLOAD', '`device_id` and `operations` array required'));
      return;
    }

    const applied:    string[] = [];
    const conflicts:  string[] = [];
    const rejected:   string[] = [];

    await withTransaction(async (client) => {
      for (const op of operations) {
        const opId = uuidv4();

        try {
          // ── LWW check: find latest server record for same resource ──────
          const serverRows = await client.query<{ client_timestamp: Date; sync_status: string }>(
            `SELECT client_timestamp, sync_status FROM offline_sync_journal
             WHERE target_table = $1 AND resource_id = $2
             ORDER BY client_timestamp DESC LIMIT 1`,
            [op.target_table, op.resource_id ?? null]
          );

          const serverRecord = serverRows.rows[0];

          if (serverRecord && serverRecord.sync_status === 'APPLIED') {
            const serverTs = new Date(serverRecord.client_timestamp).getTime();
            const clientTs = new Date(op.client_timestamp).getTime();

            if (clientTs <= serverTs) {
              // Server record is newer or equal → conflict, server wins
              await client.query(
                `INSERT INTO offline_sync_journal
                 (id, user_id, device_id, operation_type, target_table, resource_id,
                  payload, vector_clock, client_timestamp, sync_status, conflict_resolution)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'CONFLICT','LWW_SERVER_WINS')`,
                [opId, op.user_id, device_id, op.operation_type, op.target_table,
                 op.resource_id ?? null, JSON.stringify(op.payload), JSON.stringify(op.vector_clock),
                 op.client_timestamp]
              );
              conflicts.push(opId);
              continue;
            }
          }

          // ── Apply the operation ──────────────────────────────────────────
          await client.query(
            `INSERT INTO offline_sync_journal
             (id, user_id, device_id, operation_type, target_table, resource_id,
              payload, vector_clock, client_timestamp, server_timestamp, sync_status, applied_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),'APPLIED',NOW())`,
            [opId, op.user_id, device_id, op.operation_type, op.target_table,
             op.resource_id ?? null, JSON.stringify(op.payload), JSON.stringify(op.vector_clock),
             op.client_timestamp]
          );

          applied.push(opId);
        } catch (opErr) {
          logger.error('Sync op failed', { opId, error: (opErr as Error).message });
          rejected.push(opId);
        }
      }
    });

    // ── Build server vector clock ──────────────────────────────────────────
    const clockRows = await runQuery<{ device_id: string; max_ts: string }>(
      `SELECT device_id, MAX(EXTRACT(EPOCH FROM client_timestamp) * 1000)::BIGINT AS max_ts
       FROM offline_sync_journal WHERE sync_status = 'APPLIED'
       GROUP BY device_id`
    );

    const server_vector_clock: Record<string, number> = {};
    for (const row of clockRows) {
      server_vector_clock[row.device_id] = parseInt(row.max_ts, 10);
    }

    // ── Compute what client is missing ──────────────────────────────────────
    // Server mutations the client hasn't seen (newer than client's reported clock)
    const clientTs = client_vector_clock[device_id] ?? 0;
    const missingRows = await runQuery<SyncJournalEntry>(
      `SELECT * FROM offline_sync_journal
       WHERE sync_status = 'APPLIED'
         AND EXTRACT(EPOCH FROM client_timestamp) * 1000 > $1
         AND device_id != $2
       ORDER BY client_timestamp ASC
       LIMIT 200`,
      [clientTs, device_id]
    );

    const delta: ServerDeltaPack = {
      server_vector_clock,
      applied,
      conflicts,
      rejected,
      server_mutations: missingRows,
    };

    logger.info('Delta sync complete', {
      device_id,
      applied: applied.length,
      conflicts: conflicts.length,
      rejected: rejected.length,
      server_mutations: missingRows.length,
    });

    res.json(apiSuccess(delta));
  } catch (err) {
    next(err);
  }
}
