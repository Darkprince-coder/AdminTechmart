export default function NoShopAssigned() {
  return (
    <div className="branch-no-shop">
      <div className="branch-no-shop-card">
        <div className="branch-no-shop-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <line x1="9" y1="22" x2="9" y2="12"/>
            <line x1="15" y1="22" x2="15" y2="12"/>
            <line x1="12" y1="11" x2="12" y2="11.01"/>
          </svg>
        </div>
        <h2 className="branch-no-shop-title">No branch assigned</h2>
        <p className="branch-no-shop-desc">
          Your account is not linked to a shop. Ask an administrator to assign your branch in{' '}
          <strong>Users and Branches</strong>, then refresh this page.
        </p>
      </div>
    </div>
  );
}
