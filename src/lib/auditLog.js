/**
 * Optional audit trail for sensitive actions (requires `audit_logs` table — see supabase/migrations).
 * Failures are swallowed so the app works before migration is applied.
 */

import { supabase } from './supabase';

/**
 * @param {object} opts
 * @param {string} opts.action e.g. 'sale_delete', 'product_delete'
 * @param {string} [opts.entityType]
 * @param {string} [opts.entityId] uuid
 * @param {Record<string, unknown>} [opts.metadata]
 */
export async function insertAuditLog({ action, entityType, entityId, metadata }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    const { error } = await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      metadata: metadata ?? {},
    });

    if (error && process.env.NODE_ENV === 'development') {
      console.warn('[audit_logs]', error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.warn('[audit_logs]', e);
  }
}
