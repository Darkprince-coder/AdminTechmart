import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

export default function AuditLogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setLoadError(false);

    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, action, entity_type, entity_id, metadata, user_id')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(true);
      setLogs([]);
      toast.error('Could not load audit logs: ' + error.message);
    } else {
      setLogs(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const visibleLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const normalized = search.trim().toLowerCase();
    return logs.filter(log => {
      const payload = [
        log.action,
        log.entity_type,
        log.entity_id,
        log.user_id,
        JSON.stringify(log.metadata || {}),
      ].join(' ').toLowerCase();
      return payload.includes(normalized);
    });
  }, [logs, search]);

  const formatAction = (action) => {
    if (!action) return '-';
    return action.split('_').join(' ');
  };

  const formatId = (id) => {
    if (!id) return '-';
    return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
  };

  const parseMetadata = (metadata) => {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return { metadata: metadata };
      }
    }
    return metadata;
  };

  const renderMetadata = (metadata) => {
    const parsed = parseMetadata(metadata);
    if (!parsed || Object.keys(parsed).length === 0) return '-';
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        {Object.entries(parsed).map(([key, value]) => (
          <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-tertiary)', minWidth: 84, fontSize: 12 }}>{key}:</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Audit Logs</h1>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-tertiary)' }}>
            Recent admin actions recorded in Supabase.
          </p>
        </div>

        <div style={{ minWidth: 260, width: '100%', maxWidth: 360 }}>
          <input
            type="search"
            className="form-input"
            placeholder="Search action, entity, user, metadata"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Entity</th>
              <th>User</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 22 }}>
                  Loading audit logs…
                </td>
              </tr>
            ) : visibleLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 22 }}>
                  {loadError ? 'Unable to load audit logs.' : 'No audit log entries found.'}
                </td>
              </tr>
            ) : (
              visibleLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ minWidth: 155 }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{formatAction(log.action)}</td>
                  <td style={{ minWidth: 180 }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{log.entity_type || '-'}</span>
                      {log.entity_id && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatId(log.entity_id)}</span>}
                    </div>
                  </td>
                  <td style={{ minWidth: 190, fontVariantNumeric: 'tabular-nums' }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span>{formatId(log.user_id)}</span>
                      {log.user_id && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{log.user_id}</span>}
                    </div>
                  </td>
                  <td style={{ maxWidth: 420, whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                    {renderMetadata(log.metadata)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
