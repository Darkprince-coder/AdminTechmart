export default function PlaceholderPage({ title }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '50vh', gap: 12,
      color: 'var(--text-secondary)',
    }}>
      <div style={{ fontSize: 40, opacity: .3 }}>🚧</div>
      <p style={{ fontSize: 15, fontWeight: 500 }}>{title} — Coming in next session</p>
      <p style={{ fontSize: 13 }}>This tab will be built and wired up shortly.</p>
    </div>
  );
}
