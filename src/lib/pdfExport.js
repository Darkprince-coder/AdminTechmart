/**
 * TechMart admin — branded PDF exports (navy header, emerald accents, slate tables).
 * Uses jsPDF + jspdf-autotable (matches dashboard / reports UI).
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtKES, fmtDateShort, fmtTime } from './utils';

const BRAND = 'TechMart Network';

const C = {
  navy:        [15,  23,  42],
  emerald:     [5,   150, 105],
  emeraldDark: [5,   95,  74],
  amber:       [180, 100, 20],
  amberLight:  [255, 243, 205],
  amberDark:   [120, 60,  0],
  red:         [185, 28,  28],
  redLight:    [254, 226, 226],
  white:       [255, 255, 255],
  slate700:    [51,  65,  85],
  slate500:    [100, 116, 139],
  slate400:    [148, 163, 184],
  surface:     [248, 250, 252],
  border:      [226, 232, 240],
};

function slug(s) {
  return String(s || 'x')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 36) || 'export';
}

function drawHeader(doc, { title, subtitle, pill, pillColor }) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFillColor(...(pillColor || C.emerald));
  doc.rect(0, 22, pageW, 1.25, 'F');

  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  if (subtitle) {
    const maxW = pageW - (pill ? 56 : 26);
    doc.text(doc.splitTextToSize(subtitle, maxW), 14, 17.5);
  }

  if (pill) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.white);
    const pad = 5;
    const tw = doc.getTextWidth(pill) + pad * 2;
    doc.setFillColor(...(pillColor ? pillColor.map(v => Math.max(v - 30, 0)) : C.emeraldDark));
    doc.rect(pageW - tw - 12, 5.8, tw, 7, 'F');
    doc.text(pill, pageW - 12 - pad, 10.5, { align: 'right' });
  }

  return 30;
}

function addFooters(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const n = doc.internal.getNumberOfPages();
  const ts = new Date().toLocaleString('en-KE');
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(14, pageH - 13.5, pageW - 14, pageH - 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate400);
    doc.text(`${ts}  ·  Page ${i} of ${n}`, 14, pageH - 8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.emerald);
    doc.text(BRAND, pageW - 14, pageH - 8.5, { align: 'right' });
  }
}

function section(doc, y, label, color) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...(color || C.emerald));
  doc.text(label, 14, y);
  doc.setDrawColor(...(color || C.emerald));
  doc.setLineWidth(0.45);
  const w = doc.getTextWidth(label);
  doc.line(14, y + 1.2, 14 + w + 3, y + 1.2);
  doc.setTextColor(...C.slate700);
  return y + 7;
}

const baseTable = {
  styles: {
    fontSize: 8.5,
    cellPadding: 3.2,
    textColor: C.slate700,
    lineColor: C.border,
    lineWidth: 0.1,
  },
  headStyles: {
    fillColor: C.emerald,
    textColor: C.white,
    fontStyle: 'bold',
    fontSize: 8.5,
  },
  alternateRowStyles: { fillColor: C.surface },
  margin: { left: 14, right: 14 },
  theme: 'plain',
};

function safeFilename(parts) {
  return ['techmart', ...parts.map(slug)].join('-') + '.pdf';
}

/**
 * Full business report for the current filters.
 */
export function downloadReportSummaryPdf({
  shopLabel,
  periodLabel,
  rangeDescription,
  metrics,
  categoryRows,
  topProductRows,
  branchRows,
  lowStockRows,
  showBranchColumn,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const sub = [rangeDescription, `Scope: ${shopLabel}`].filter(Boolean).join(' · ');
  let y = drawHeader(doc, { title: 'Business report', subtitle: sub, pill: periodLabel });

  y = section(doc, y + 2, 'Period snapshot');
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [['Revenue', 'Profit', 'Margin', 'Units sold', 'Transactions']],
    body: [[
      fmtKES(metrics.revenue),
      fmtKES(metrics.profit),
      metrics.marginPct == null ? '—' : `${metrics.marginPct}%`,
      String(metrics.units),
      String(metrics.txns),
    ]],
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'right' },
      1: { fontStyle: 'bold', textColor: C.emerald, halign: 'right' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    headStyles: { ...baseTable.headStyles, halign: 'center' },
  });
  y = doc.lastAutoTable.finalY + 10;

  if (categoryRows.length) {
    y = section(doc, y, 'Revenue by category');
    autoTable(doc, {
      ...baseTable,
      startY: y,
      head: [['Category', 'Revenue', 'Profit', 'Units']],
      body: categoryRows.map(r => [r.name, fmtKES(r.rev), fmtKES(r.profit), String(r.units)]),
      columnStyles: {
        0: { cellWidth: 62 },
        1: { halign: 'right' },
        2: { halign: 'right', textColor: C.emerald },
        3: { halign: 'center' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (topProductRows.length) {
    y = section(doc, y, 'Top products');
    autoTable(doc, {
      ...baseTable,
      startY: y,
      head: [['#', 'Product', 'Revenue', 'Profit', 'Margin', 'Units']],
      body: topProductRows.map((r, i) => [
        String(i + 1), r.name, fmtKES(r.rev), fmtKES(r.profit), `${r.marginPct}%`, String(r.units),
      ]),
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 54 },
        2: { halign: 'right' },
        3: { halign: 'right', textColor: C.emerald },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (branchRows && branchRows.length) {
    y = section(doc, y, 'Branch comparison (same period)');
    autoTable(doc, {
      ...baseTable,
      startY: y,
      head: [['#', 'Branch', 'Revenue', 'Profit', 'Margin', 'Units', 'Txns', 'Stock']],
      body: branchRows.map((r, i) => [
        String(i + 1), r.name, fmtKES(r.rev), fmtKES(r.profit),
        r.marginPct == null ? '—' : `${r.marginPct}%`,
        String(r.units), String(r.txns), String(r.stock),
      ]),
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 36 },
        2: { halign: 'right' },
        3: { halign: 'right', textColor: C.emerald },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  y = section(doc, y, 'Low stock & reorder snapshot');
  if (!lowStockRows.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text('All tracked products are above their alert threshold.', 14, y + 4);
  } else {
    const head = showBranchColumn
      ? [['Product', 'Category', 'Branch', 'Stock', 'Alert at', 'Status']]
      : [['Product', 'Category', 'Stock', 'Alert at', 'Status']];
    const body = lowStockRows.map(r =>
      showBranchColumn
        ? [r.name, r.category || '—', r.branch || '—', String(r.qty), String(r.alert), r.status]
        : [r.name, r.category || '—', String(r.qty), String(r.alert), r.status],
    );
    autoTable(doc, {
      ...baseTable, startY: y, head, body,
      columnStyles: showBranchColumn
        ? { 0: { cellWidth: 48 }, 3: { halign: 'center' }, 4: { halign: 'center' } }
        : { 0: { cellWidth: 58 }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    });
  }

  addFooters(doc);
  doc.save(safeFilename(['report', periodLabel, shopLabel]));
}

/**
 * Line-by-line sales register for the selected period & branch scope (landscape).
 */
export function downloadSalesRegisterPdf({ shopLabel, periodLabel, rangeDescription, rows }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const sub = [rangeDescription, `Scope: ${shopLabel}`, `${rows.length} line${rows.length === 1 ? '' : 's'}`]
    .filter(Boolean).join(' · ');
  let y = drawHeader(doc, { title: 'Sales register', subtitle: sub, pill: periodLabel });

  y = section(doc, y + 2, 'Transactions');
  if (!rows.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text('No sales in this period for the selected scope.', 14, y + 4);
  } else {
    autoTable(doc, {
      ...baseTable,
      startY: y,
      head: [['Date', 'Time', 'Branch', 'Product', 'Customer', 'Qty', 'Unit price', 'Total', 'Profit']],
      body: rows.map(s => [
        fmtDateShort(s.created_at),
        fmtTime(s.created_at),
        (s.branch || '—').slice(0, 28),
        (s.product_name || '—').slice(0, 40),
        (s.customer_name || 'Walk-in').slice(0, 24),
        String(s.quantity ?? ''),
        fmtKES(s.unit_price),
        fmtKES(s.total_amount),
        fmtKES(s.profit),
      ]),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 16 },
        2: { cellWidth: 30 },
        3: { cellWidth: 52 },
        4: { cellWidth: 28 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' },
        8: { halign: 'right', textColor: C.emerald, fontStyle: 'bold' },
      },
    });
  }

  addFooters(doc);
  doc.save(safeFilename(['sales', periodLabel, shopLabel]));
}

/**
 * Low-stock / out-of-stock list for supplier ordering (reference sell & cost).
 */
export function downloadLowStockReorderPdf({ shopLabel, rangeNote, rows, showBranchColumn }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const sub = [rangeNote || 'Current stock levels', `Scope: ${shopLabel}`, 'Reorder reference']
    .filter(Boolean).join(' · ');
  let y = drawHeader(doc, { title: 'Supplier reorder sheet', subtitle: sub, pill: 'Low stock' });

  y = section(doc, y + 2, 'Items at or below alert');
  if (!rows.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text('No low or out-of-stock items for this scope.', 14, y + 4);
  } else {
    const head = showBranchColumn
      ? [['Product', 'Category', 'Branch', 'Stock', 'Alert', 'Buy', 'Sell', 'Status']]
      : [['Product', 'Category', 'Stock', 'Alert', 'Buy', 'Sell', 'Status']];
    const body = rows.map(r =>
      showBranchColumn
        ? [r.name, r.category || '—', r.branch || '—', String(r.qty), String(r.alert), fmtKES(r.buy), fmtKES(r.sell), r.status]
        : [r.name, r.category || '—', String(r.qty), String(r.alert), fmtKES(r.buy), fmtKES(r.sell), r.status],
    );
    autoTable(doc, {
      ...baseTable, startY: y, head, body,
      columnStyles: showBranchColumn
        ? { 0: { cellWidth: 44 }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right', fontSize: 8 }, 6: { halign: 'right', fontSize: 8 } }
        : { 0: { cellWidth: 52 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right', fontSize: 8 }, 5: { halign: 'right', fontSize: 8 } },
    });
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  const noteY = (doc.lastAutoTable?.finalY || y + 16) + 8;
  const footLines = doc.splitTextToSize(
    'Buy / sell prices are internal reference for purchasing negotiations. Quantities are live at export time.',
    doc.internal.pageSize.getWidth() - 28,
  );
  doc.text(footLines, 14, noteY);

  addFooters(doc);
  doc.save(safeFilename(['reorder', 'low-stock', shopLabel]));
}

/**
 * Archive PDF generated before bulk-deleting sales records.
 * Landscape A4. Includes a clear deletion notice, full summary metrics,
 * and a complete transaction-by-transaction table.
 *
 * @param {object} opts
 * @param {string}   opts.shopLabel         e.g. "All branches" or branch name
 * @param {string}   opts.periodLabel        e.g. "This month"
 * @param {string}   opts.rangeDescription   Human-readable date range
 * @param {string}   opts.deletedAt          ISO timestamp of when deletion occurred
 * @param {object}   opts.metrics            { revenue, profit, marginPct, units, txns }
 * @param {Array}    opts.rows               Sales rows — each has created_at, branch,
 *                                           product_name, customer_name, quantity,
 *                                           unit_price, total_amount, profit
 * @param {boolean}  opts.showBranchColumn
 */
export function downloadSalesArchivePdf({
  shopLabel,
  periodLabel,
  rangeDescription,
  deletedAt,
  metrics,
  rows,
  showBranchColumn,
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const sub = [
    rangeDescription,
    `Scope: ${shopLabel}`,
    `${rows.length} record${rows.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  // ── Header (amber pill signals "archive / destructive") ──────────────────
  let y = drawHeader(doc, {
    title:     'Sales archive — deleted records',
    subtitle:  sub,
    pill:      'ARCHIVE',
    pillColor: C.amber,
  });

  // ── Amber warning banner ─────────────────────────────────────────────────
  const deletedStr = deletedAt
    ? new Date(deletedAt).toLocaleString('en-KE', {
        dateStyle: 'full',
        timeStyle: 'medium',
      })
    : new Date().toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'medium' });

  const bannerH = 14;
  doc.setFillColor(...C.amberLight);
  doc.setDrawColor(...C.amber);
  doc.setLineWidth(0.3);
  doc.rect(14, y, pageW - 28, bannerH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.amberDark);
  doc.text('PERMANENT DELETION NOTICE', 20, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `These ${rows.length} sales record${rows.length === 1 ? ' has' : 's have'} been permanently removed from the TechMart database on ${deletedStr}.`,
    20,
    y + 10.5,
  );

  y += bannerH + 8;

  // ── Summary metrics ──────────────────────────────────────────────────────
  y = section(doc, y, 'Archived period summary', C.amber);
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [['Revenue', 'Profit', 'Margin', 'Units sold', 'Transactions', 'Period', 'Scope']],
    body: [[
      fmtKES(metrics.revenue),
      fmtKES(metrics.profit),
      metrics.marginPct == null ? '—' : `${metrics.marginPct}%`,
      String(metrics.units),
      String(metrics.txns),
      periodLabel,
      shopLabel,
    ]],
    headStyles: { ...baseTable.headStyles, fillColor: C.amber },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'right' },
      1: { fontStyle: 'bold', textColor: C.amber,   halign: 'right' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontSize: 8 },
      6: { halign: 'center', fontSize: 8 },
    },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Full transaction table ───────────────────────────────────────────────
  y = section(doc, y, 'Complete transaction records', C.amber);
  if (!rows.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.slate500);
    doc.text('No records in this archive.', 14, y + 4);
  } else {
    const head = showBranchColumn
      ? [['Date', 'Time', 'Branch', 'Product', 'Customer', 'Qty', 'Unit price', 'Total', 'Profit']]
      : [['Date', 'Time', 'Product', 'Customer', 'Qty', 'Unit price', 'Total', 'Profit']];

    const body = rows.map(s => {
      const base = [
        fmtDateShort(s.created_at),
        fmtTime(s.created_at),
        ...(showBranchColumn ? [(s.branch || s.shops?.name || '—').slice(0, 24)] : []),
        (s.product_name  || '—').slice(0, 40),
        (s.customer_name || 'Walk-in').slice(0, 22),
        String(s.quantity ?? ''),
        fmtKES(s.unit_price),
        fmtKES(s.total_amount),
        fmtKES(s.profit),
      ];
      return base;
    });

    const colStyles = showBranchColumn
      ? {
          0: { cellWidth: 22 },
          1: { cellWidth: 15 },
          2: { cellWidth: 28 },
          3: { cellWidth: 46 },
          4: { cellWidth: 26 },
          5: { halign: 'center', cellWidth: 11 },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right', textColor: C.emerald, fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 22 },
          1: { cellWidth: 15 },
          2: { cellWidth: 56 },
          3: { cellWidth: 30 },
          4: { halign: 'center', cellWidth: 11 },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' },
          7: { halign: 'right', textColor: C.emerald, fontStyle: 'bold' },
        };

    autoTable(doc, {
      ...baseTable,
      startY: y,
      head,
      body,
      headStyles: { ...baseTable.headStyles, fillColor: C.amber },
      columnStyles: colStyles,
      // Tint alternate rows amber instead of grey to reinforce "archive" context
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });
  }

  // ── Bottom legal note (above standard footer) ────────────────────────────
  const noteY = (doc.lastAutoTable?.finalY ?? y + 10) + 8;
  if (noteY < pageH - 22) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.slate400);
    const note = doc.splitTextToSize(
      `This document is a permanent record of ${rows.length} sales transaction${rows.length === 1 ? '' : 's'} ` +
      `that were deleted from the TechMart database. Retain this PDF for your accounting and audit records. ` +
      `Deleted on: ${deletedStr}.`,
      pageW - 28,
    );
    doc.text(note, 14, noteY);
  }

  addFooters(doc);

  const ts = new Date().toISOString().slice(0, 10);
  doc.save(safeFilename(['sales-archive', ts, shopLabel]));
}