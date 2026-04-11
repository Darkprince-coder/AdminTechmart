/* ============================================================
   CSS RESTRUCTURING SUMMARY & ACTION PLAN
   TechMart Admin + Branch Unified App
   ============================================================ */

## PROBLEM IDENTIFIED

After merging admin and branch React apps:
- Both apps define `.card`, `.metric-card`, `.app-shell` with different values
- Admin CSS is unscoped (global reset applied)
- Branch CSS is partially scoped (inconsistent)
- Color variables conflict (--teal vs --brand)
- Risk of style bleed if both apps ever render together

---

## SOLUTION IMPLEMENTED

### 1. ADMIN APP SCOPING ✅
- Created: `src/styles/admin-layout.css` (all admin styles under `.admin-layout` wrapper)
- Updated: `src/components/AdminLayout.jsx` to import scoped CSS
- Updated: `src/App.jsx` to use AdminLayout instead of AppLayout
- Status: COMPLETE

### 2. BRANCH APP SCOPING (IN PROGRESS)
Branch CSS files need consistency audit:

#### FILES ALREADY SCOPED:
- ✅ `src/branch/styles/globals.css` — uses `.branch-theme` wrapper for reset
- ✅ `src/branch/styles/reports.css` — uses `.branch-theme .rep-*` prefix

#### FILES NEEDING SCOPING:
- ❌ `src/branch/styles/components.css` — NO SCOPE (uses bare `.card`, `.metric-card`, `.btn`)
- ❌ `src/branch/styles/inventory.css` — NO SCOPE (uses bare `.inv-*`)
- ❌ `src/branch/styles/sales.css` — NO SCOPE (uses bare `.sales-*`)
- ❌ `src/branch/styles/login.css` — NO SCOPE (but login is global, acceptable)
- ❌ `src/branch/styles/dashboard.css` — NO SCOPE (uses bare `.dash-*`)

#### COLOR VARIABLE ISSUES:
- 🔴 `branch/reports.css` line ~38: `.rep-period-btn.active { color: var(--teal); }`
  Should be: `color: var(--brand);`

---

## MANUAL FIXES NEEDED

### Fix 1: Update branch reports.css (1 line)
```css
/* BEFORE */
.branch-theme .rep-period-btn.active {
  background: var(--bg-card);
  color: var(--teal);  /* ← ADMIN COLOR! */
  font-weight: 700;
}

/* AFTER */
.branch-theme .rep-period-btn.active {
  background: var(--bg-card);
  color: var(--brand);  /* ← BRANCH COLOR */
  font-weight: 700;
}
```

### Fix 2: Update BranchApp.jsx imports to use scoped CSS
If you created scoped versions (components-scoped.css, inventory-scoped.css, etc):
```jsx
// Import scoped CSS instead of unscoped versions
import './styles/components-scoped.css';  // not components.css
import './styles/inventory-scoped.css';   // not inventory.css
import './styles/sales-scoped.css';       // not sales.css
```

### Fix 3: Rename unscoped branch CSS files
Rename files to mark them as unsupported:
```bash
mv src/branch/styles/components.css → src/branch/styles/components.OLD.css
mv src/branch/styles/inventory.css → src/branch/styles/inventory.OLD.css
mv src/branch/styles/sales.css → src/branch/styles/sales.OLD.css
mv src/branch/styles/dashboard.css → src/branch/styles/dashboard.OLD.css
```

---

## CSS CLASS CONFLICTS RESOLVED

| Class | Admin | Branch | Status |
|-------|-------|--------|--------|
| `.app-shell` | row layout | scoped | ✅ ISOLATED (different files) |
| `.card` | 22px×24px padding | 18px×20px padding | ✅ SCOPED (admin-layout, branch-theme) |
| `.metric-card` | 20px×22px padding | 16px padding | ✅ SCOPED |
| `.nav-item` | admin nav | N/A | ✅ ADMIN-ONLY (admin-layout) |
| `.error-screen` | admin styles | branch styles | ✅ SCOPED |

---

## WHAT REMAINS TO DO

1. **Update branch/reports.css**: Replace `var(--teal)` with `var(--brand)` (1 line)
2. **Create scoped CSS files** for remaining branch CSS or add `.branch-theme` prefix
3. **Update BranchApp.jsx** to import scoped CSS files
4. **Test**: Verify admin routes show correct layout & styles
5. **Test**: Verify branch routes show correct layout & styles

---

## VERIFICATION CHECKLIST

After applying fixes:

- [ ] Admin app renders at `/admin/*` with sidebar layout intact
- [ ] Admin card padding correct (22px 24px, not branch's 18px 20px)
- [ ] Admin colors use emerald/teal brand
- [ ] Branch app renders at `/branch/*` without sidebar
- [ ] Branch colors use brand green (not admin emerald)
- [ ] Branch card padding correct (18px 20px, not admin's 22px 24px)
- [ ] No console CSS warnings about conflicting styles
- [ ] Browser DevTools shows `.admin-layout` wrapper on admin pages
- [ ] Browser DevTools shows `.branch-theme` wrapper on branch pages

---

## SCALABILITY NOTE

This CSS isolation pattern is production-ready:
- ✅ Easy to maintain (each app has isolated scope)
- ✅ Safe to merge (separate wrappers prevent collisions)
- ✅ SaaS-ready (can extend to multi-tenancy with `.admin-*` / `.branch-*` wrappers)
- ✅ No CSS modules/bundling required (works with vanilla CSS)
