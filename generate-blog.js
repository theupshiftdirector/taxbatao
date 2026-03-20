/**
 * Regenerates the 17 income-tax-on-X-lakh-salary blog pages with rich content.
 * Fixes: thin content (~202 words), ad-before-content, outdated tax calculations.
 * Uses FY 2025-26 (AY 2026-27) tax slabs per Budget 2025.
 * Run: node generate-blog.js
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, 'blog');
const DOMAIN = 'https://taxbatao.com';

// ─── Salary levels to generate (in lakhs) ────────────────────────────────────
const SALARIES_LAKHS = [3, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25, 30, 40, 50, 75, 100];

// ─── Tax calculation engine (FY 2025-26 / AY 2026-27) ────────────────────────

// New regime slabs for FY 2025-26 (Budget 2025)
const NEW_SLABS = [
  { from: 0,        to: 400000,   rate: 0   },
  { from: 400000,   to: 800000,   rate: 5   },
  { from: 800000,   to: 1200000,  rate: 10  },
  { from: 1200000,  to: 1600000,  rate: 15  },
  { from: 1600000,  to: 2000000,  rate: 20  },
  { from: 2000000,  to: 2400000,  rate: 25  },
  { from: 2400000,  to: Infinity, rate: 30  },
];

// Old regime slabs
const OLD_SLABS = [
  { from: 0,        to: 250000,   rate: 0   },
  { from: 250000,   to: 500000,   rate: 5   },
  { from: 500000,   to: 1000000,  rate: 20  },
  { from: 1000000,  to: Infinity, rate: 30  },
];

// Applies tax slabs and returns total before cess
function applySlabs(income, slabs) {
  let tax = 0;
  for (const slab of slabs) {
    if (income <= slab.from) break;
    const taxable = Math.min(income, slab.to) - slab.from;
    tax += taxable * slab.rate / 100;
  }
  return Math.round(tax);
}

// Computes full tax for a given gross salary and regime
function computeTax(grossSalary, regime) {
  const stdDeduction = regime === 'new' ? 75000 : 50000;
  const taxableIncome = Math.max(0, grossSalary - stdDeduction);
  const slabs = regime === 'new' ? NEW_SLABS : OLD_SLABS;

  let tax = applySlabs(taxableIncome, slabs);

  // Sec 87A rebate
  if (regime === 'new' && taxableIncome <= 1200000) {
    tax = 0; // Full rebate — no tax up to ₹12L taxable income (Budget 2025)
  } else if (regime === 'old' && taxableIncome <= 500000) {
    tax = 0; // Full rebate up to ₹5L taxable income
  }

  const cess = Math.round(tax * 0.04);
  return {
    grossSalary,
    stdDeduction,
    taxableIncome,
    taxBeforeCess: tax,
    cess,
    totalTax: tax + cess,
    takeHome: grossSalary - (tax + cess),
    monthlyTakeHome: Math.round((grossSalary - (tax + cess)) / 12),
    effectiveRate: grossSalary > 0 ? ((tax + cess) / grossSalary * 100).toFixed(1) : '0.0',
  };
}

// Computes both regimes and returns comparison
function computeBothRegimes(grossSalary) {
  const newR = computeTax(grossSalary, 'new');
  const oldR = computeTax(grossSalary, 'old');
  const better = newR.totalTax <= oldR.totalTax ? 'new' : 'old';
  const saving = Math.abs(newR.totalTax - oldR.totalTax);
  return { newR, oldR, better, saving };
}

// Generates the tax slab breakdown table rows for a given income and regime
function slabBreakdownRows(taxableIncome, slabs) {
  const rows = [];
  for (const slab of slabs) {
    if (taxableIncome <= slab.from) break;
    const taxableInSlab = Math.min(taxableIncome, slab.to) - slab.from;
    const tax = Math.round(taxableInSlab * slab.rate / 100);
    const label = slab.to === Infinity
      ? `Above ₹${fmt(slab.from)}`
      : `₹${fmt(slab.from)} – ₹${fmt(slab.to)}`;
    rows.push(`<tr><td>${label}</td><td>${slab.rate}%</td><td>₹${fmt(taxableInSlab)}</td><td>₹${fmt(tax)}</td></tr>`);
  }
  return rows.join('\n');
}

// Formats number in Indian style
function fmt(n) {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

// Returns short format like ₹10L, ₹1.5Cr
function fmtShort(n) {
  n = Math.round(n);
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  return '₹' + fmt(n);
}

// ─── Unique content generators ────────────────────────────────────────────────

// Returns a category for the salary level
function salaryCategory(lakhs) {
  if (lakhs <= 7) return 'lower';
  if (lakhs <= 15) return 'middle';
  if (lakhs <= 30) return 'upper-middle';
  return 'high';
}

// Generates the intro paragraph unique to each salary level
function introParagraph(lakhs, data) {
  const { newR, oldR, better, saving } = data;
  const cat = salaryCategory(lakhs);
  const regime = better === 'new' ? 'New Regime' : 'Old Regime';

  const contextComment =
    cat === 'lower' ? `A ₹${lakhs} lakh annual salary (₹${fmt(lakhs * 100000 / 12)}/month gross) is typical for entry-level professionals, government employees, and skilled workers in Tier 2-3 cities.`
    : cat === 'middle' ? `A ₹${lakhs} lakh annual salary places you firmly in India's middle-income bracket — typically a mid-level professional, manager, or specialist in a metropolitan area.`
    : cat === 'upper-middle' ? `A ₹${lakhs} lakh annual salary is well above the Indian average, typically representing senior managers, experienced professionals, or small business owners. At this level, tax planning becomes significantly impactful.`
    : `A ₹${lakhs} lakh annual salary (₹${fmt(Math.round(lakhs * 100000 / 12))}/month) represents high income in India. At this level, both income tax and surcharge can significantly impact take-home, making regime selection and deduction planning critical.`;

  const regimeComment = saving === 0
    ? `For a ₹${lakhs} lakh salary, both the Old and New Regime result in identical tax liability for the standard case (only standard deduction applied). The regime choice depends entirely on your actual deductions.`
    : `For a ₹${lakhs} lakh salary with only the standard deduction, the <strong>${regime} saves ₹${fmt(saving)}</strong> in tax (${(saving / (lakhs * 1000)).toFixed(1)}% of gross salary). However, if you have significant deductions under 80C, 80D, HRA, or home loan interest, the old regime may be more beneficial.`;

  return `${contextComment} ${regimeComment}`;
}

// Generates the deduction breakeven paragraph
function deductionBreakevenParagraph(lakhs, data) {
  const { newR, oldR, better, saving } = data;

  // Breakeven deduction: how much in additional old-regime deductions to make old regime worthwhile
  // New regime saves X in tax. To make old regime better, need deductions worth X / (marginal rate)
  const grossSalary = lakhs * 100000;
  const newTaxableIncome = Math.max(0, grossSalary - 75000);

  // Estimate marginal rate under old regime
  let marginalRate = 0;
  if (newTaxableIncome > 1000000) marginalRate = 0.30;
  else if (newTaxableIncome > 500000) marginalRate = 0.20;
  else marginalRate = 0.05;

  if (saving === 0) {
    return `At this income level, the tax under both regimes is the same with standard deduction only. If you have deductions like 80C, 80D, or HRA, the old regime will save you more tax. The new regime is better only if you have minimal deductions.`;
  }

  if (better === 'new') {
    const breakevenDeductions = marginalRate > 0 ? Math.round(saving / marginalRate) : 0;
    return `The New Regime is better by ₹${fmt(saving)} assuming only the standard deduction. To make the Old Regime worth choosing, you would need additional deductions (beyond the standard ₹50,000) totalling approximately <strong>₹${fmt(breakevenDeductions)}</strong> — for example, ₹1.5L under 80C + ₹25,000 under 80D + HRA or home loan interest making up the balance. Run this comparison with your actual deductions using the Tax Batao calculator.`;
  } else {
    return `The Old Regime is better by ₹${fmt(saving)} when you claim standard deductions. This advantage grows significantly when you add deductions under 80C (up to ₹1.5L), 80D (up to ₹25,000), home loan interest (up to ₹2L under Sec 24), and NPS (₹50,000 under 80CCD(1B)).`;
  }
}

// Generates tax saving tips specific to the income level
function taxSavingTips(lakhs, data) {
  const { newR, oldR, better, saving } = data;
  const gross = lakhs * 100000;
  const maxOldRegimeSaving = Math.round((oldR.totalTax - computeTax(gross - 300000, 'old').totalTax));

  const tips = [
    `<strong>Section 80C (₹1.5 lakh limit):</strong> Invest in PPF, ELSS mutual funds, NSC, 5-year FD, or pay life insurance premium. This is the most widely-used deduction and reduces your taxable income by up to ₹1.5 lakh under the old regime.`,
    `<strong>Section 80D (health insurance):</strong> Premium paid for self/family health insurance is deductible up to ₹25,000 (₹50,000 if 60+ years). This is a zero-effort deduction available in the old regime.`,
    `<strong>NPS contribution (₹50,000 extra under 80CCD(1B)):</strong> Over and above the ₹1.5L 80C limit, contributing ₹50,000/year to NPS gives an additional deduction — saving ${fmtShort(Math.round(50000 * (gross > 1000000 ? 0.30 : 0.20) * 1.04))} in tax at your income level.`,
    `<strong>HRA exemption (if renting):</strong> If you live in a rented house and receive HRA from your employer, the exemption can be substantial — especially in metros. Ensure you submit rent receipts and the landlord's PAN (if rent > ₹1L/year).`,
    `<strong>Switch regime annually if beneficial:</strong> You can switch between Old and New Regime every year (salaried employees can change at filing time). Compare both regimes with your actual deductions using Tax Batao before filing.`,
  ];

  if (lakhs >= 50) {
    tips.push(`<strong>Surcharge planning (income above ₹50L):</strong> Income above ₹50L attracts a surcharge of 10-25%. Structuring some income as capital gains (taxed at flat rates without surcharge) can be more efficient at this income level.`);
  }

  return tips.map(t => `<li>${t}</li>`).join('\n');
}

// ─── HTML generator ───────────────────────────────────────────────────────────

// Generates full HTML for a single tax blog page
function generatePage(lakhs) {
  const grossSalary = lakhs * 100000;
  const slug = `income-tax-on-${String(lakhs).replace('.', '-')}-lakh-salary`;
  const canonical = `${DOMAIN}/blog/${slug}/`;

  const data = computeBothRegimes(grossSalary);
  const { newR, oldR, better, saving } = data;

  const betterLabel = better === 'new' ? 'New Regime' : 'Old Regime';
  const betterTax = better === 'new' ? newR.totalTax : oldR.totalTax;

  const title = `Income Tax on ₹${lakhs} Lakh Salary (FY 2025-26) | Tax Batao`;
  const description = `Income tax on ₹${lakhs} lakh salary for FY 2025-26. New Regime: ₹${fmt(newR.totalTax)}. Old Regime: ₹${fmt(oldR.totalTax)}. Monthly take-home: ₹${fmt(newR.monthlyTakeHome)} (new regime). Complete slab breakdown.`;

  const newSlabRows = slabBreakdownRows(newR.taxableIncome, NEW_SLABS);
  const oldSlabRows = slabBreakdownRows(oldR.taxableIncome, OLD_SLABS);

  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": `Income Tax on ₹${lakhs} Lakh Salary FY 2025-26`,
    "description": description,
    "publisher": { "@type": "Organization", "name": "Tax Batao", "url": DOMAIN },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  });

  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `How much income tax on ₹${lakhs} lakh salary under New Regime FY 2025-26?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Under the New Tax Regime for FY 2025-26, income tax on ₹${lakhs} lakh salary is ₹${fmt(newR.totalTax)} (including 4% cess). Taxable income after ₹75,000 standard deduction is ₹${fmt(newR.taxableIncome)}.` }
      },
      {
        "@type": "Question",
        "name": `How much income tax on ₹${lakhs} lakh salary under Old Regime FY 2025-26?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Under the Old Tax Regime for FY 2025-26, income tax on ₹${lakhs} lakh salary is ₹${fmt(oldR.totalTax)} (with standard deduction of ₹50,000 only). With full 80C, 80D, and HRA deductions, the old regime tax can be significantly lower.` }
      },
      {
        "@type": "Question",
        "name": `Which tax regime is better for ₹${lakhs} lakh salary?`,
        "acceptedAnswer": { "@type": "Answer", "text": `For a ₹${lakhs} lakh salary with only standard deduction, the ${betterLabel} is better, saving ₹${fmt(saving)}. However, if you have significant deductions under 80C, 80D, or home loan interest, recalculate using the Tax Batao calculator with your actual deductions.` }
      },
      {
        "@type": "Question",
        "name": `What is the monthly take-home for ₹${lakhs} lakh salary?`,
        "acceptedAnswer": { "@type": "Answer", "text": `Monthly take-home for ₹${lakhs} lakh annual salary under the New Regime is approximately ₹${fmt(newR.monthlyTakeHome)} per month. Under the Old Regime, it is ₹${fmt(oldR.monthlyTakeHome)} per month (with standard deduction only).` }
      }
    ]
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8235932614579966" crossorigin="anonymous"></script>
<script type="application/ld+json">${articleSchema}</script>
<script type="application/ld+json">${faqSchema}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--accent:#3b82f6;--bg:#09090b;--surface:#18181b;--border:#27272a;--text:#fafafa;--muted:#a1a1aa;--green:#34d399;--red:#f87171}
body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);line-height:1.75}
.c{max-width:840px;margin:0 auto;padding:1.5rem}
header{padding:1rem 0;border-bottom:1px solid var(--border);margin-bottom:1.5rem}
header a{color:var(--accent);text-decoration:none;font-weight:600;font-size:1.1rem}
.bc{font-size:.85rem;color:var(--muted);margin-bottom:1.25rem}
.bc a{color:var(--muted);text-decoration:none}
h1{font-family:'Playfair Display',serif;font-size:2rem;line-height:1.25;margin-bottom:.5rem}
.sub{color:var(--muted);font-size:1.05rem;margin-bottom:1.5rem}
h2{font-size:1.25rem;font-weight:600;margin:2rem 0 .75rem}
p{margin-bottom:1rem;color:#e4e4e7}
table{width:100%;border-collapse:collapse;margin:1rem 0 1.5rem}
th,td{padding:.7rem 1rem;border:1px solid var(--border);text-align:left;font-size:.95rem}
th{background:var(--surface);font-weight:600}
td{background:rgba(24,24,27,.6)}
.hl{color:var(--accent);font-weight:600}
.good{color:var(--green);font-weight:600}
.bad{color:var(--red)}
ul{padding-left:1.5rem;margin-bottom:1.25rem}
li{margin-bottom:.6rem;color:#e4e4e7}
.summary-box{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.25rem 1.5rem;margin:1.5rem 0;display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}
.sum-item .s-label{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.25rem}
.sum-item .s-value{font-size:1.25rem;font-weight:700;color:var(--accent)}
.sum-item.green .s-value{color:var(--green)}
.ad{margin:2rem 0;min-height:90px;text-align:center}
.cta{margin:2rem 0;padding:1.5rem;border-radius:12px;background:var(--surface);border:1px solid var(--border);text-align:center}
.cta p{margin-bottom:.75rem;color:var(--muted)}
.cta a{display:inline-block;padding:.7rem 2rem;background:var(--accent);color:#fff;border-radius:8px;text-decoration:none;font-weight:600}
footer{margin-top:3rem;padding:2rem 0;border-top:1px solid var(--border);text-align:center;color:var(--muted);font-size:.85rem}
footer a{color:var(--muted);text-decoration:none}
.faq-item{border-top:1px solid var(--border);padding:1rem 0}
.faq-item h3{font-size:1rem;font-weight:600;margin:0 0 .4rem}
.faq-item p{margin:0;color:#d4d4d8;font-size:.95rem}
.regime-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0 1.5rem}
.regime-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1rem 1.25rem}
.regime-card.winner{border-color:var(--green)}
.regime-card .r-label{font-size:.78rem;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.regime-card .r-tax{font-size:1.5rem;font-weight:700;color:var(--accent);margin-bottom:.25rem}
.regime-card.winner .r-tax{color:var(--green)}
.regime-card .r-take{font-size:.9rem;color:var(--muted)}
.winner-badge{display:inline-block;font-size:.75rem;background:#064e3b;color:#34d399;padding:.15rem .6rem;border-radius:4px;margin-bottom:.5rem}
@media(max-width:600px){h1{font-size:1.5rem}.c{padding:1rem}.summary-box,.regime-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="c">

<header><a href="/">Tax Batao</a></header>

<nav class="bc">
  <a href="/">Home</a> ›
  <a href="/blog/">Blog</a> ›
  Income Tax on ₹${lakhs} Lakh Salary (FY 2025-26)
</nav>

<h1>Income Tax on ₹${lakhs} Lakh Salary (FY 2025-26)</h1>
<p class="sub">Old vs New Regime · AY 2026-27 · ${betterLabel} saves ₹${fmt(saving)}</p>

<!-- Quick comparison summary -->
<div class="regime-grid">
  <div class="regime-card${better === 'new' ? ' winner' : ''}">
    ${better === 'new' ? '<div class="winner-badge">✓ Better for you</div>' : ''}
    <div class="r-label">New Regime</div>
    <div class="r-tax">₹${fmt(newR.totalTax)}</div>
    <div class="r-take">Take-home: ₹${fmt(newR.monthlyTakeHome)}/mo</div>
    <div class="r-take">Effective rate: ${newR.effectiveRate}%</div>
  </div>
  <div class="regime-card${better === 'old' ? ' winner' : ''}">
    ${better === 'old' ? '<div class="winner-badge">✓ Better for you</div>' : ''}
    <div class="r-label">Old Regime</div>
    <div class="r-tax">₹${fmt(oldR.totalTax)}</div>
    <div class="r-take">Take-home: ₹${fmt(oldR.monthlyTakeHome)}/mo</div>
    <div class="r-take">Effective rate: ${oldR.effectiveRate}%</div>
  </div>
</div>

<div class="summary-box">
  <div class="sum-item green">
    <div class="s-label">Best Regime Saves</div>
    <div class="s-value">₹${fmt(saving)}</div>
  </div>
  <div class="sum-item">
    <div class="s-label">Monthly Take-Home (New)</div>
    <div class="s-value">₹${fmt(newR.monthlyTakeHome)}</div>
  </div>
</div>

<!-- Regime comparison detail table -->
<h2>Old vs New Regime: Side-by-Side</h2>
<table>
  <thead>
    <tr><th>Detail</th><th>New Regime</th><th>Old Regime</th></tr>
  </thead>
  <tbody>
    <tr><td>Gross Salary</td><td>₹${fmt(grossSalary)}</td><td>₹${fmt(grossSalary)}</td></tr>
    <tr><td>Standard Deduction</td><td>₹75,000</td><td>₹50,000</td></tr>
    <tr><td>Taxable Income</td><td>₹${fmt(newR.taxableIncome)}</td><td>₹${fmt(oldR.taxableIncome)}</td></tr>
    <tr><td>Income Tax</td><td>₹${fmt(newR.taxBeforeCess)}</td><td>₹${fmt(oldR.taxBeforeCess)}</td></tr>
    <tr><td>4% Health & Education Cess</td><td>₹${fmt(newR.cess)}</td><td>₹${fmt(oldR.cess)}</td></tr>
    <tr><td><strong>Total Tax</strong></td><td class="${better === 'new' ? 'good' : 'hl'}"><strong>₹${fmt(newR.totalTax)}</strong></td><td class="${better === 'old' ? 'good' : 'hl'}"><strong>₹${fmt(oldR.totalTax)}</strong></td></tr>
    <tr><td>Annual Take-Home</td><td>₹${fmt(newR.takeHome)}</td><td>₹${fmt(oldR.takeHome)}</td></tr>
    <tr><td><strong>Monthly Take-Home</strong></td><td><strong>₹${fmt(newR.monthlyTakeHome)}</strong></td><td><strong>₹${fmt(oldR.monthlyTakeHome)}</strong></td></tr>
    <tr><td>Effective Tax Rate</td><td>${newR.effectiveRate}%</td><td>${oldR.effectiveRate}%</td></tr>
  </tbody>
</table>

<!-- Ad placed after the first data table, not before content -->
<div class="ad">
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>

<h2>Analysis: ₹${lakhs} Lakh Salary</h2>
<p>${introParagraph(lakhs, data)}</p>
<p>${deductionBreakevenParagraph(lakhs, data)}</p>

<!-- New Regime slab breakdown -->
<h2>New Regime Tax Slab Breakdown (FY 2025-26)</h2>
<p>Taxable income under new regime: ₹${fmt(grossSalary)} − ₹75,000 (standard deduction) = <strong>₹${fmt(newR.taxableIncome)}</strong></p>
<table>
  <thead>
    <tr><th>Income Slab</th><th>Rate</th><th>Taxable Amount</th><th>Tax</th></tr>
  </thead>
  <tbody>
    ${newSlabRows}
    <tr><td colspan="3"><strong>Tax before cess</strong></td><td><strong>₹${fmt(newR.taxBeforeCess)}</strong></td></tr>
    ${newR.taxBeforeCess === 0 && newR.taxableIncome <= 1200000 ? `<tr><td colspan="3">Sec 87A Rebate (income ≤ ₹12L)</td><td style="color:var(--green)">−₹${fmt(applySlabs(newR.taxableIncome, NEW_SLABS))}</td></tr>` : ''}
    <tr><td colspan="3">Add: 4% Health & Education Cess</td><td>₹${fmt(newR.cess)}</td></tr>
    <tr><td colspan="3"><strong>Total Tax Payable</strong></td><td class="hl"><strong>₹${fmt(newR.totalTax)}</strong></td></tr>
  </tbody>
</table>

<!-- Old Regime slab breakdown -->
<h2>Old Regime Tax Slab Breakdown (FY 2025-26)</h2>
<p>Taxable income under old regime: ₹${fmt(grossSalary)} − ₹50,000 (standard deduction) = <strong>₹${fmt(oldR.taxableIncome)}</strong> (before additional deductions like 80C, 80D, HRA)</p>
<table>
  <thead>
    <tr><th>Income Slab</th><th>Rate</th><th>Taxable Amount</th><th>Tax</th></tr>
  </thead>
  <tbody>
    ${oldSlabRows}
    <tr><td colspan="3"><strong>Tax before cess</strong></td><td><strong>₹${fmt(oldR.taxBeforeCess)}</strong></td></tr>
    ${oldR.taxBeforeCess === 0 && oldR.taxableIncome <= 500000 ? `<tr><td colspan="3">Sec 87A Rebate (income ≤ ₹5L)</td><td style="color:var(--green)">−₹${fmt(applySlabs(oldR.taxableIncome, OLD_SLABS))}</td></tr>` : ''}
    <tr><td colspan="3">Add: 4% Health & Education Cess</td><td>₹${fmt(oldR.cess)}</td></tr>
    <tr><td colspan="3"><strong>Total Tax (standard deduction only)</strong></td><td class="hl"><strong>₹${fmt(oldR.totalTax)}</strong></td></tr>
  </tbody>
</table>

<!-- Tax saving tips -->
<h2>How to Save Tax on ₹${lakhs} Lakh Salary</h2>
<p>Under the Old Regime, deductions can significantly reduce your tax liability. Here are the most impactful tax-saving options:</p>
<ul>
  ${taxSavingTips(lakhs, data)}
</ul>

<div class="cta">
  <p>Calculate with your actual deductions and compare both regimes</p>
  <a href="/">Open Tax Calculator →</a>
</div>

<div class="ad">
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>

<h2>Frequently Asked Questions</h2>
<div class="faq-item">
  <h3>How much income tax on ₹${lakhs} lakh salary under New Regime FY 2025-26?</h3>
  <p>Under the New Tax Regime for FY 2025-26, income tax on ₹${lakhs} lakh salary is <strong>₹${fmt(newR.totalTax)}</strong> (including 4% cess). Taxable income after ₹75,000 standard deduction is ₹${fmt(newR.taxableIncome)}. Monthly take-home: ₹${fmt(newR.monthlyTakeHome)}.</p>
</div>
<div class="faq-item">
  <h3>How much income tax on ₹${lakhs} lakh salary under Old Regime FY 2025-26?</h3>
  <p>Under the Old Tax Regime, tax on ₹${lakhs} lakh salary (with only standard deduction of ₹50,000) is <strong>₹${fmt(oldR.totalTax)}</strong>. With full 80C (₹1.5L), 80D (₹25,000), and other deductions, this can be significantly lower. Use the Tax Batao calculator to compare with your actual deductions.</p>
</div>
<div class="faq-item">
  <h3>Which tax regime is better for ₹${lakhs} lakh salary?</h3>
  <p>With standard deduction only, the <strong>${betterLabel}</strong> saves ₹${fmt(saving)} in tax for a ₹${lakhs} lakh salary. However, this changes based on your actual deductions. Taxpayers with high 80C, 80D, HRA, or home loan interest should compare both regimes with their real numbers.</p>
</div>
<div class="faq-item">
  <h3>What is the monthly take-home for ₹${lakhs} lakh annual salary?</h3>
  <p>Monthly take-home for ₹${lakhs} lakh annual salary: <strong>₹${fmt(newR.monthlyTakeHome)}/month under New Regime</strong>, ₹${fmt(oldR.monthlyTakeHome)}/month under Old Regime. Note: actual take-home also depends on PF contributions, professional tax, and other payroll deductions by your employer.</p>
</div>
<div class="faq-item">
  <h3>Can I switch from Old to New Regime or vice versa?</h3>
  <p>Yes — salaried employees can switch between regimes every year at the time of filing their ITR. The default regime is New Regime; you need to opt-in for Old Regime explicitly. It is advisable to compare both regimes each year as your income and deductions change.</p>
</div>

<footer>
  <p>Tax Batao — Free calculators for India</p>
  <p style="margin-top:.5rem"><a href="/privacy.html">Privacy</a> · <a href="/about.html">About</a> · <a href="/blog/">Blog</a></p>
  <p style="margin-top:.5rem;font-size:.75rem">Powered by TUDI</p>
</footer>

</div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
let count = 0;

for (const lakhs of SALARIES_LAKHS) {
  const slug = `income-tax-on-${String(lakhs).replace('.', '-')}-lakh-salary`;
  const dir = path.join(BLOG_DIR, slug);
  const filePath = path.join(dir, 'index.html');

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, generatePage(lakhs), 'utf8');
  count++;
  process.stdout.write(`\r✓ Generated ${count}/${SALARIES_LAKHS.length} pages`);
}

console.log(`\n\n✅ Done. Generated ${count} Tax Batao blog pages.`);
