import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useShop } from '../context/ShopContext';
import { supabase } from '../lib/supabase';
import { fmtDate, fmtKES } from '../lib/utils';
import { markAuditLogViewed } from '../lib/auditNavBadge';

const AUDIT_RETENTION_DAYS = 14;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function humanizeKey(key) {
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function parseMetadata(metadata) {
  if (metadata == null) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return { note: metadata };
    }
  }
  if (typeof metadata === 'object') return metadata;
  return { value: metadata };
}

function shouldOmitMetadataKey(key, value) {
  if (key === 'product_id' || key === 'user_id' || key === 'shop_id') return true;
  if (typeof value === 'string') {
    const t = value.trim();
    if (UUID_RE.test(t) && /_id$/i.test(key)) return true;
  }
  return false;
}

/** Flat rows for admin-friendly display (no raw Supabase UUIDs). */
function buildMetadataRows(obj, shopsById, depth) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const rows = [];
  const consumed = new Set();

  if (depth === 0) {
    const sid = typeof obj.shop_id === 'string' ? obj.shop_id.trim() : '';
    if (sid && UUID_RE.test(sid)) {
      const name = shopsById.get(sid)?.name || 'Unknown branch';
      rows.push({ rowKey: '__branch', label: 'Branch', value: name });
      consumed.add('shop_id');
    }
    if (obj.portal != null && String(obj.portal).trim() !== '') {
      const v = String(obj.portal).toLowerCase();
      rows.push({
        rowKey: '__portal',
        label: 'Source',
        value: v === 'branch' ? 'Branch portal' : v === 'admin' ? 'Admin portal' : String(obj.portal),
      });
      consumed.add('portal');
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (consumed.has(key)) continue;
    if (shouldOmitMetadataKey(key, value)) continue;
    if (value === undefined || value === null || value === '') continue;
    rows.push({ rowKey: key, label: humanizeKey(key), value, rawKey: key });
  }
  return rows;
}

function isMoneyKey(key) {
  return /(amount|price|revenue|profit|cost|fee)$/i.test(key) || /^(total|unit|buy|sell)_/.test(key);
}

function formatScalar(key, value, shopsById) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'number') {
    if (Number.isFinite(value) && isMoneyKey(key)) return fmtKES(value);
    return String(value);
  }

  if (typeof value === 'string') {
    const t = value.trim();
    if (UUID_RE.test(t)) {
      if (key === 'shop_id' || key.endsWith('_shop_id')) {
        return shopsById.get(t)?.name || 'Unknown branch';
      }
      return '—';
    }
    const n = Number(t);
    if (t !== '' && !Number.isNaN(n) && Number.isFinite(n) && isMoneyKey(key)) return fmtKES(n);
    return t || '—';
  }

  return String(value);
}

function actionBadgeClass(action) {
  const a = (action || '').toLowerCase();
  if (a.includes('delete')) return 'badge badge-danger';
  if (a.includes('create') || a.includes('insert') || a.includes('add')) return 'badge badge-ok';
  if (a.includes('update') || a.includes('edit') || a.includes('transfer')) return 'badge badge-info';
  return 'badge badge-neutral';
}

function formatActionLabel(action) {
  if (!action) return 'Unknown';
  return humanizeKey(action.replace(/_/g, ' '));
}

function MetadataDetails({ data, shopsById, depth = 0 }) {
  const obj = parseMetadata(data);
  if (obj == null || typeof obj !== 'object') {
    return <span className="audit-meta-empty">No extra details</span>;
  }
  if (Array.isArray(obj)) {
    return (
      <div className={`audit-meta-block ${depth > 0 ? 'audit-meta-nested' : ''}`}>
        <MetadataValue value={obj} keyName="items" shopsById={shopsById} depth={depth} />
      </div>
    );
  }

  const rows = buildMetadataRows(obj, shopsById, depth);
  if (rows.length === 0) {
    return <span className="audit-meta-empty">No extra details</span>;
  }

  return (
    <div className={`audit-meta-block ${depth > 0 ? 'audit-meta-nested' : ''}`}>
      {rows.map(r => (
        <div key={r.rowKey} className="audit-meta-row">
          <span className="audit-meta-key">{r.label}</span>
          <div className="audit-meta-val">
            <MetadataValue
              value={r.value}
              keyName={r.rawKey || 'value'}
              shopsById={shopsById}
              depth={depth}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetadataValue({ value, keyName, shopsById, depth }) {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'object' && !Array.isArray(value)) {
    return <MetadataDetails data={value} shopsById={shopsById} depth={depth + 1} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    const primitives = value.every(
      v => v === null || ['string', 'number', 'boolean'].includes(typeof v)
    );
    if (primitives) {
      return (
        <span>
          {value.map((v, i) => (
            <span key={i}>
              {i > 0 ? ', ' : null}
              {formatScalar(keyName, v, shopsById)}
            </span>
          ))}
        </span>
      );
    }
    return (
      <ul className="audit-meta-list">
        {value.map((v, i) => (
          <li key={i}>
            <MetadataValue value={v} keyName={keyName} shopsById={shopsById} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  return formatScalar(keyName, value, shopsById);
}

function ActionBadge({ action }) {
  return <span className={actionBadgeClass(action)}>{formatActionLabel(action)}</span>;
}

function RecordBlock({ log }) {
  const m = parseMetadata(log.metadata);
  const name = m.product_name || m.name;
  const typeLabel = log.entity_type ? humanizeKey(log.entity_type) : null;
  return (
    <div className="audit-entity-block">
      <span className="audit-entity-type">{name || typeLabel || '—'}</span>
      {name && typeLabel ? <span className="audit-entity-sub">{typeLabel}</span> : null}
    </div>
  );
}

function ActorBlock({ actor }) {
  const label = actor?.full_name?.trim() || actor?.email?.trim() || null;
  return (
    <div className="audit-actor-block">
      {label ? (
        <>
          <div className="audit-actor-name">{label}</div>
          {actor?.email && actor.email !== label ? (
            <div className="audit-actor-email">{actor.email}</div>
          ) : null}
        </>
      ) : (
        <div className="audit-actor-name audit-actor-unknown">Unknown user</div>
      )}
    </div>
  );
}

function AuditMobileCard({ log, shopsById, onDelete, deletingId }) {
  const busy = deletingId === log.id;
  return (
    <article className="audit-card">
      <div className="audit-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="audit-card-time">{fmtDate(log.created_at)}</div>
          <div className="audit-card-badge">
            <ActionBadge action={log.action} />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-danger btn-xs"
          disabled={!!deletingId}
          onClick={() => onDelete(log.id)}
        >
          {busy ? 'Removing…' : 'Delete'}
        </button>
      </div>
      <div className="audit-card-grid">
        <div>
          <div className="audit-card-label">Record</div>
          <RecordBlock log={log} />
        </div>
        <div>
          <div className="audit-card-label">Actor</div>
          <ActorBlock actor={log.actor} />
        </div>
      </div>
      <div className="audit-card-section">
        <div className="audit-card-label">Change details</div>
        <MetadataDetails data={log.metadata} shopsById={shopsById} />
      </div>
    </article>
  );
}

export default function AuditLogsPage() {
  const toast = useToast();
  const { shops } = useShop();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const shopsById = useMemo(() => new Map(shops.map(s => [s.id, s])), [shops]);

  const purgeExpiredLogs = useCallback(async () => {
    const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('audit_logs').delete().lt('created_at', cutoff);
    if (error) {
      console.warn('[audit_logs] retention purge failed:', error.message);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    await purgeExpiredLogs();

    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, action, entity_type, entity_id, metadata, user_id')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(true);
      setRows([]);
      toast.error('Could not load audit logs: ' + error.message);
      setLoading(false);
      return;
    }

    const list = data || [];
    const userIds = [...new Set(list.map(r => r.user_id).filter(Boolean))];
    let profileMap = new Map();

    if (userIds.length > 0) {
      const { data: profiles, error: pErr } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (!pErr && profiles) {
        profileMap = new Map(profiles.map(p => [p.id, p]));
      }
    }

    setRows(
      list.map(log => ({
        ...log,
        actor: profileMap.get(log.user_id) || null,
      }))
    );
    markAuditLogViewed();
    setLoading(false);
  }, [toast, purgeExpiredLogs]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    markAuditLogViewed();
  }, []);

  const handleDeleteOne = useCallback(
    async id => {
      if (!window.confirm('Delete this audit log entry? This cannot be undone.')) return;
      setDeletingId(id);
      const { error } = await supabase.from('audit_logs').delete().eq('id', id);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Entry removed');
        setRows(r => r.filter(x => x.id !== id));
      }
      setDeletingId(null);
    },
    [toast]
  );

  const visibleLogs = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(log => {
      const metaStr = JSON.stringify(log.metadata || {}).toLowerCase();
      const actorBits = [log.actor?.email, log.actor?.full_name].filter(Boolean).join(' ').toLowerCase();
      const hay = [log.action, log.entity_type, actorBits, metaStr].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="fade-in">
      <p className="audit-retention-hint">
        Entries older than {AUDIT_RETENTION_DAYS} days are removed automatically when you open this page.
      </p>
      <div className="audit-toolbar">
        <div className="search-bar" style={{ flex: 1, minWidth: 0 }}>
          <svg
            className="search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search by action, record, person, or details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search audit logs"
          />
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fetchAuditLogs()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="ov-loading" style={{ minHeight: 120 }}>
          <div className="spinner" />
          <span>Loading audit logs…</span>
        </div>
      ) : loadError ? (
        <div className="empty-state" style={{ padding: '28px 16px' }}>
          <p style={{ color: 'var(--red)', marginBottom: 14 }}>Unable to load audit logs.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchAuditLogs()}>
            Retry
          </button>
        </div>
      ) : visibleLogs.length === 0 ? (
        <div className="empty-state">
          <p>{search ? 'No entries match your search.' : 'No audit log entries yet.'}</p>
        </div>
      ) : (
        <>
          <div className="audit-mobile-list">
            {visibleLogs.map(log => (
              <AuditMobileCard
                key={log.id}
                log={log}
                shopsById={shopsById}
                onDelete={handleDeleteOne}
                deletingId={deletingId}
              />
            ))}
          </div>

          <div className="table-wrap audit-desktop-table">
            <table className="data-table audit-data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Actor</th>
                  <th>Details</th>
                  <th className="audit-col-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map(log => {
                  const busy = deletingId === log.id;
                  return (
                    <tr key={log.id}>
                      <td className="audit-cell-time">{fmtDate(log.created_at)}</td>
                      <td className="audit-cell-action">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="audit-cell-entity">
                        <RecordBlock log={log} />
                      </td>
                      <td className="audit-cell-actor">
                        <ActorBlock actor={log.actor} />
                      </td>
                      <td className="audit-cell-details">
                        <MetadataDetails data={log.metadata} shopsById={shopsById} />
                      </td>
                      <td className="audit-col-actions">
                        <button
                          type="button"
                          className="btn btn-danger btn-xs"
                          disabled={!!deletingId}
                          onClick={() => handleDeleteOne(log.id)}
                        >
                          {busy ? 'Removing…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
