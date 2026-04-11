# TechMart Network — MVP Admin Panel

A multi-branch electronics shop management system built with React + Supabase.

---

## 🚀 Setup Instructions

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In your project, go to **SQL Editor → New Query**
3. Paste the entire contents of `supabase_schema.sql` and click **Run**
4. Go to **Settings → API** and copy:
   - **Project URL** (e.g. `https://xyzabc.supabase.co`)
   - **anon public key** (long JWT string)

### 2. Create Admin User

1. In Supabase, go to **Authentication → Users → Add user**
2. Enter your admin email and password
3. Click **Create user**

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the admin credentials you created.

---

## 📁 Project Structure

```
src/
├── components/
│   └── AppLayout.jsx       # Sidebar + topbar shell
├── context/
│   ├── AuthContext.jsx     # Supabase auth session
│   ├── ShopContext.jsx     # Active shop / branch selector
│   └── ToastContext.jsx    # Global toast notifications
├── lib/
│   ├── supabase.js         # Supabase client
│   └── utils.js            # Helpers (fmtKES, stockStatus, etc.)
├── pages/
│   ├── LoginPage.jsx       # Auth screen
│   ├── OverviewPage.jsx    # Dashboard / network overview
│   ├── InventoryPage.jsx   # Products, add/edit/delete, quick sell
│   ├── SalesPage.jsx       # Record sales, sales history
│   ├── TransferPage.jsx    # Move stock between branches
│   └── ReportsPage.jsx     # Analytics, category breakdown
└── styles/
    ├── globals.css         # CSS variables, base reset
    ├── components.css      # Shared component styles
    ├── layout.css          # App shell, sidebar, topbar
    ├── login.css           # Login page
    ├── overview.css        # Dashboard
    ├── inventory.css       # Inventory page
    ├── sales.css           # Sales page
    ├── transfer.css        # Transfer page
    └── reports.css         # Reports page
```

---

## 🏗 Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| MVP   | Admin panel, 1 shop wired | ✅ This build |
| Phase 2 | Add remaining shops, shop managers | Pending client approval |
| Phase 3 | Real-time updates, notifications | Future |

---

## 📱 Responsive

- Mobile-first (fits smartphones)
- Tablet-ready
- Desktop-ready (fluid up to 1200px)
