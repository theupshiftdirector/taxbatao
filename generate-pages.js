#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const BASE = DIST;

// ===================== TAX CONFIG =====================
const TAX_CONFIG = {
    '2025-26': {
        newRegime: {
            standardDeduction: 75000,
            slabs: [
                { from: 0, to: 400000, rate: 0 },
                { from: 400000, to: 800000, rate: 5 },
                { from: 800000, to: 1200000, rate: 10 },
                { from: 1200000, to: 1600000, rate: 15 },
                { from: 1600000, to: 2000000, rate: 20 },
                { from: 2000000, to: 2400000, rate: 25 },
                { from: 2400000, to: Infinity, rate: 30 }
            ],
            rebateLimit: 1200000,
            rebateMaxTax: 60000
        },
        oldRegime: {
            standardDeduction: 50000,
            slabs: [
                { from: 0, to: 250000, rate: 0 },
                { from: 250000, to: 500000, rate: 5 },
                { from: 500000, to: 1000000, rate: 20 },
                { from: 1000000, to: Infinity, rate: 30 }
            ],
            rebateLimit: 500000,
            rebateMaxTax: 12500
        }
    }
};
const CESS_RATE = 0.04;

// ===================== INCOME LEVELS =====================
const INCOME_LEVELS = [
    { amount: 500000, label: '5 Lakh', slug: '5-lakh' },
    { amount: 600000, label: '6 Lakh', slug: '6-lakh' },
    { amount: 700000, label: '7 Lakh', slug: '7-lakh' },
    { amount: 800000, label: '8 Lakh', slug: '8-lakh' },
    { amount: 900000, label: '9 Lakh', slug: '9-lakh' },
    { amount: 1000000, label: '10 Lakh', slug: '10-lakh' },
    { amount: 1200000, label: '12 Lakh', slug: '12-lakh' },
    { amount: 1275000, label: '12.75 Lakh', slug: '12-75-lakh' },
    { amount: 1500000, label: '15 Lakh', slug: '15-lakh' },
    { amount: 1800000, label: '18 Lakh', slug: '18-lakh' },
    { amount: 2000000, label: '20 Lakh', slug: '20-lakh' },
    { amount: 2500000, label: '25 Lakh', slug: '25-lakh' },
    { amount: 3000000, label: '30 Lakh', slug: '30-lakh' },
    { amount: 4000000, label: '40 Lakh', slug: '40-lakh' },
    { amount: 5000000, label: '50 Lakh', slug: '50-lakh' },
    { amount: 7500000, label: '75 Lakh', slug: '75-lakh' },
    { amount: 10000000, label: '1 Crore', slug: '1-crore' },
    { amount: 15000000, label: '1.5 Crore', slug: '1-5-crore' },
    { amount: 20000000, label: '2 Crore', slug: '2-crore' },
];

// ===================== TOPIC PAGES =====================
const TOPIC_PAGES = [
    {
        slug: 'income-tax-slabs',
        title: 'Income Tax Slabs FY 2025-26 | Old & New Regime Rates',
        desc: 'Complete income tax slab rates for FY 2025-26 (AY 2026-27). New regime slabs after Budget 2025, old regime rates, standard deduction, and Section 87A rebate details.',
        content: generateSlabsContent
    },
    {
        slug: 'old-vs-new-regime',
        title: 'Old vs New Tax Regime FY 2025-26 | Which Saves More Tax?',
        desc: 'Detailed comparison of old vs new income tax regime for FY 2025-26. Find which regime is better based on your deductions, salary, and tax-saving investments.',
        content: generateRegimeComparisonContent
    },
    {
        slug: 'section-80c-deductions',
        title: 'Section 80C Deductions Guide | Tax Saving Investments FY 2025-26',
        desc: 'Complete guide to Section 80C tax deductions up to Rs 1.5 lakh. PPF, ELSS, LIC, EPF, NSC, tax-saving FD, SCSS, and more investment options explained.',
        content: generate80CContent
    },
    {
        slug: 'section-80d-health-insurance',
        title: 'Section 80D Deduction | Health Insurance Tax Benefit FY 2025-26',
        desc: 'Section 80D deduction guide for health insurance premium. Deduction limits for self, family, parents, and senior citizens. Preventive health check-up deduction.',
        content: generate80DContent
    },
    {
        slug: 'hra-exemption-rules',
        title: 'HRA Exemption Rules & Calculation | Section 10(13A) Guide',
        desc: 'Complete guide to HRA exemption calculation under Section 10(13A). Metro vs non-metro rules, HRA formula, documentation requirements, and tax-saving tips.',
        content: generateHRAContent
    },
    {
        slug: 'tax-saving-tips',
        title: 'Top Tax Saving Tips for Salaried Employees FY 2025-26',
        desc: 'Best tax saving strategies for salaried individuals in India. Maximize deductions under 80C, 80D, HRA, NPS, and home loan. Choose the right tax regime.',
        content: generateTaxTipsContent
    }
];

// ===================== UTILITY FUNCTIONS =====================
function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }

// Recursively copies a directory and its contents
function copyDirRecursive(src, dest) {
  mkdirp(dest);
  fs.readdirSync(src, { withFileTypes: true }).forEach(function(entry) {
    var srcPath = path.join(src, entry.name);
    var destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function formatINR(n) { return new Intl.NumberFormat('en-IN').format(Math.round(n)); }

function formatINRShort(n) {
    n = Math.round(n);
    if (n >= 10000000) return '\u20B9' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return '\u20B9' + (n / 100000).toFixed(2) + ' L';
    return '\u20B9' + formatINR(n);
}

// ===================== TAX CALCULATION =====================
function calculateSlabTax(taxableIncome, slabs) {
    var tax = 0;
    var breakdown = [];
    for (var i = 0; i < slabs.length; i++) {
        var slab = slabs[i];
        if (taxableIncome <= slab.from) break;
        var upper = slab.to === Infinity ? taxableIncome : Math.min(taxableIncome, slab.to);
        var taxableInSlab = upper - slab.from;
        var taxInSlab = Math.round(taxableInSlab * slab.rate / 100);
        tax += taxInSlab;
        breakdown.push({ from: slab.from, to: upper, rate: slab.rate, taxable: taxableInSlab, tax: taxInSlab });
    }
    return { tax: tax, breakdown: breakdown };
}

function calculateNewRegimeTax(grossIncome) {
    var config = TAX_CONFIG['2025-26'].newRegime;
    var sd = config.standardDeduction;
    var taxableIncome = Math.max(0, grossIncome - sd);
    var result = calculateSlabTax(taxableIncome, config.slabs);
    var rebate = 0;
    if (taxableIncome <= config.rebateLimit) rebate = Math.min(result.tax, config.rebateMaxTax);
    var marginalRelief = 0;
    var threshold = config.rebateLimit + sd;
    if (grossIncome > threshold && rebate === 0) {
        var excess = grossIncome - threshold;
        if (result.tax > excess) marginalRelief = result.tax - excess;
    }
    var taxAfterRebate = result.tax - rebate - marginalRelief;
    var cess = Math.round(taxAfterRebate * CESS_RATE);
    return { taxableIncome, slabTax: result.tax, rebate, marginalRelief, taxAfterRebate, cess, totalTax: taxAfterRebate + cess, breakdown: result.breakdown };
}

function calculateOldRegimeTax(grossIncome) {
    var config = TAX_CONFIG['2025-26'].oldRegime;
    var sd = config.standardDeduction;
    var taxableIncome = Math.max(0, grossIncome - sd);
    var result = calculateSlabTax(taxableIncome, config.slabs);
    var rebate = 0;
    if (taxableIncome <= config.rebateLimit) rebate = Math.min(result.tax, config.rebateMaxTax);
    var taxAfterRebate = result.tax - rebate;
    var cess = Math.round(taxAfterRebate * CESS_RATE);
    return { taxableIncome, slabTax: result.tax, rebate, taxAfterRebate, cess, totalTax: taxAfterRebate + cess, breakdown: result.breakdown };
}

// ===================== HTML GENERATION =====================
function getCSS() {
    return `:root{--bg:#0a0a0b;--card:#141416;--card-hover:#1a1a1e;--border:#2a2a2e;--text:#e8e8ec;--text-muted:#8a8a94;--accent:#3b82f6;--accent-dim:#3b82f620;--green:#22c55e;--red:#ef4444;--input-bg:#1a1a1e;--blue:#38bdf8;--orange:#f97316}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}.header{border-bottom:1px solid var(--border);padding:20px 0;position:sticky;top:0;background:var(--bg);z-index:100;backdrop-filter:blur(20px)}.header-inner{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}.logo{font-family:'Playfair Display',serif;font-size:24px;color:var(--text);text-decoration:none}.logo span{color:var(--accent)}.badge{background:var(--accent-dim);color:var(--accent);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600}.breadcrumb{max-width:1200px;margin:0 auto;padding:16px 24px 0;font-size:13px;color:var(--text-muted)}.breadcrumb a{color:var(--accent);text-decoration:none}.hero{text-align:center;padding:40px 24px 32px;max-width:800px;margin:0 auto}.hero h1{font-family:'Playfair Display',serif;font-size:36px;line-height:1.15;margin-bottom:16px}.hero h1 .hl{color:var(--accent)}.hero p{color:var(--text-muted);font-size:17px;max-width:600px;margin:0 auto 24px}.content{max-width:800px;margin:0 auto;padding:0 24px 40px}.content h2{font-family:'Playfair Display',serif;font-size:24px;margin:32px 0 16px}.content h3{font-size:16px;margin:24px 0 12px;color:var(--accent)}.content p{color:var(--text-muted);margin-bottom:16px;font-size:15px}.content ul,.content ol{color:var(--text-muted);padding-left:20px;margin-bottom:16px;font-size:15px}.content li{margin-bottom:6px}.content table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px}.content table th{background:var(--card);padding:10px 14px;text-align:left;border:1px solid var(--border);font-weight:600;font-size:13px}.content table td{padding:10px 14px;border:1px solid var(--border)}.content table tr:nth-child(even) td{background:var(--card)}.content strong{color:var(--text)}.result-box{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.result-item{text-align:center;padding:12px}.result-item .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:4px}.result-item .value{font-size:18px;font-weight:700}.result-item.winner .value{color:var(--green)}.cta-box{background:var(--accent-dim);border:1px solid #3b82f640;border-radius:12px;padding:20px;text-align:center;margin:24px 0}.cta-box a{color:var(--accent);font-weight:600;text-decoration:none;font-size:16px}.faq-section{max-width:800px;margin:0 auto;padding:20px 24px 60px}.faq-section h2{font-family:'Playfair Display',serif;font-size:24px;margin-bottom:16px}.faq-item{border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:12px;background:var(--card)}.faq-item h3{font-size:15px;margin-bottom:8px}.faq-item p{font-size:14px;color:var(--text-muted);margin:0}.links-section{max-width:800px;margin:0 auto;padding:20px 24px 40px}.links-section h2{font-family:'Playfair Display',serif;font-size:22px;margin-bottom:16px}.links-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}.links-grid a{display:block;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);text-decoration:none;font-size:14px;transition:border-color .2s}.links-grid a:hover{border-color:var(--accent)}.links-grid a .link-sub{display:block;font-size:12px;color:var(--text-muted);margin-top:2px}.footer{text-align:center;padding:40px 24px;border-top:1px solid var(--border);color:var(--text-muted);font-size:13px}.footer a{color:var(--accent);text-decoration:none}@media(max-width:900px){.hero h1{font-size:28px}.result-box{grid-template-columns:1fr}}@media(max-width:480px){.links-grid{grid-template-columns:1fr}}`;
}

function getHead(title, desc, canonical) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="https://taxbatao.com${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://taxbatao.com${canonical}">
<meta property="og:site_name" content="Tax Batao">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8235932614579966" crossorigin="anonymous"><\/script>
<script>(adsbygoogle = window.adsbygoogle || []).push({google_ad_client: "ca-pub-8235932614579966", enable_page_level_ads: true});<\/script>
<style>${getCSS()}</style>
</head>`;
}

function getBreadcrumb(items) {
    var html = '<div class="breadcrumb"><a href="/">Tax Batao</a>';
    items.forEach(function(item) {
        if (item.url) html += ' &rsaquo; <a href="' + item.url + '">' + item.name + '</a>';
        else html += ' &rsaquo; ' + item.name;
    });
    html += '</div>';

    // JSON-LD
    var jsonld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Tax Batao", "item": "https://taxbatao.com" }
        ]
    };
    var pos = 2;
    items.forEach(function(item) {
        var entry = { "@type": "ListItem", "position": pos++, "name": item.name };
        if (item.url) entry.item = "https://taxbatao.com" + item.url;
        jsonld.itemListElement.push(entry);
    });
    html += '\n<script type="application/ld+json">' + JSON.stringify(jsonld) + '<\/script>';
    return html;
}

function getHeader() {
    return `<header class="header"><div class="header-inner"><a href="/" class="logo">Tax <span>Batao</span></a><div class="badge">FY 2025-26</div></div></header>`;
}

function getIncomeLinks() {
    var html = '<div class="links-section"><h2>Income Tax by Salary</h2><div class="links-grid">';
    INCOME_LEVELS.forEach(function(l) {
        html += '<a href="/income-tax-on-' + l.slug + '-salary">Tax on \u20B9' + l.label + ' Salary<span class="link-sub">FY 2025-26 Old vs New</span></a>';
    });
    html += '</div></div>';
    return html;
}

function getTopicLinks() {
    var html = '<div class="links-section"><h2>Tax Guides</h2><div class="links-grid">';
    TOPIC_PAGES.forEach(function(t) {
        html += '<a href="/' + t.slug + '">' + t.title.split('|')[0].trim() + '<span class="link-sub">Detailed guide</span></a>';
    });
    html += '<a href="/hra-calculator">HRA Calculator<span class="link-sub">Calculate HRA exemption</span></a>';
    html += '</div></div>';
    return html;
}

function getFooter() {
    return `<footer class="footer"><p>Built by TUD Innovations Pvt Ltd. Tax calculations based on standard income tax rules for FY 2025-26.</p><p style="margin-top:8px"><a href="/privacy">Privacy Policy</a></p></footer>`;
}

function getAdBlock() {
    return `<div style="max-width:800px;margin:0 auto;padding:20px 24px;text-align:center"><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8235932614579966" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});<\/script></div>`;
}

function formatSlabRange(from, to) {
    if (to === Infinity || to >= 100000000) return '\u20B9' + formatINR(from) + '+';
    return '\u20B9' + formatINR(from) + ' - \u20B9' + formatINR(to);
}

function renderSlabTable(result) {
    var html = '<table><tr><th>Income Slab</th><th>Rate</th><th>Tax</th></tr>';
    result.breakdown.forEach(function(s) {
        html += '<tr><td>' + formatSlabRange(s.from, s.to) + '</td><td>' + s.rate + '%</td><td>\u20B9' + formatINR(s.tax) + '</td></tr>';
    });
    html += '<tr><td><strong>Tax on Income</strong></td><td></td><td><strong>\u20B9' + formatINR(result.slabTax) + '</strong></td></tr>';
    if (result.rebate > 0) html += '<tr><td>Less: Sec 87A Rebate</td><td></td><td style="color:#22c55e">-\u20B9' + formatINR(result.rebate) + '</td></tr>';
    if (result.marginalRelief > 0) html += '<tr><td>Less: Marginal Relief</td><td></td><td style="color:#22c55e">-\u20B9' + formatINR(result.marginalRelief) + '</td></tr>';
    html += '<tr><td>Add: 4% Cess</td><td></td><td>+\u20B9' + formatINR(result.cess) + '</td></tr>';
    html += '<tr><td><strong>Total Tax Payable</strong></td><td></td><td><strong>\u20B9' + formatINR(result.totalTax) + '</strong></td></tr>';
    html += '</table>';
    return html;
}

// ===================== INCOME PAGE GENERATION =====================
function generateIncomePage(level) {
    var newTax = calculateNewRegimeTax(level.amount);
    var oldTax = calculateOldRegimeTax(level.amount);
    var winner = newTax.totalTax <= oldTax.totalTax ? 'New Regime' : 'Old Regime';
    var savings = Math.abs(newTax.totalTax - oldTax.totalTax);
    var bestTax = Math.min(newTax.totalTax, oldTax.totalTax);
    var effectiveRate = level.amount > 0 ? (bestTax / level.amount * 100).toFixed(1) : '0';

    var slug = 'income-tax-on-' + level.slug + '-salary';
    var title = 'Income Tax on \u20B9' + level.label + ' Salary FY 2025-26 | Old vs New Regime - Tax Batao';
    var desc = 'Calculate income tax on Rs ' + level.label + ' salary for FY 2025-26. New regime tax: Rs ' + formatINR(newTax.totalTax) + '. Old regime tax: Rs ' + formatINR(oldTax.totalTax) + '. ' + winner + ' saves Rs ' + formatINR(savings) + '.';
    var canonical = '/' + slug;

    var faqItems = [
        { q: 'How much tax on \u20B9' + level.label + ' salary under new regime?', a: 'Under the new tax regime for FY 2025-26, the total income tax on a salary of Rs ' + level.label + ' is Rs ' + formatINR(newTax.totalTax) + ' (including 4% cess). The taxable income after Rs 75,000 standard deduction is Rs ' + formatINR(newTax.taxableIncome) + '.' },
        { q: 'How much tax on \u20B9' + level.label + ' salary under old regime?', a: 'Under the old tax regime for FY 2025-26, the income tax on Rs ' + level.label + ' salary is Rs ' + formatINR(oldTax.totalTax) + ' (with only standard deduction of Rs 50,000, no other deductions). With additional deductions like 80C, 80D, and HRA, the tax can be significantly lower.' },
        { q: 'Which regime is better for \u20B9' + level.label + ' salary?', a: 'For a salary of Rs ' + level.label + ' with only standard deduction, the ' + winner + ' is better, saving Rs ' + formatINR(savings) + '. However, if you have significant deductions (80C, 80D, HRA, home loan), the old regime might save more. Use our calculator to compare with your actual deductions.' },
        { q: 'What is the effective tax rate on \u20B9' + level.label + '?', a: 'The effective tax rate on Rs ' + level.label + ' salary is ' + effectiveRate + '% under the best regime. This means for every Rs 100 earned, you pay Rs ' + effectiveRate + ' as income tax.' }
    ];

    var faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqItems.map(function(f) {
            return { "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } };
        })
    };

    var html = getHead(title, desc, canonical);
    html += '\n<script type="application/ld+json">' + JSON.stringify(faqJsonLd) + '<\/script>';
    html += '\n<body>';
    html += getHeader();
    html += getBreadcrumb([{ name: 'Tax on \u20B9' + level.label + ' Salary' }]);

    html += '<div class="hero"><h1>Income Tax on <span class="hl">\u20B9' + level.label + '</span> Salary</h1>';
    html += '<p>FY 2025-26 (AY 2026-27) tax calculation under both Old and New regime with complete slab-wise breakdown.</p></div>';

    html += getAdBlock();

    // Result summary
    html += '<div class="content">';
    html += '<div class="result-box">';
    html += '<div class="result-item' + (newTax.totalTax <= oldTax.totalTax ? ' winner' : '') + '"><div class="label">New Regime Tax</div><div class="value">\u20B9' + formatINR(newTax.totalTax) + '</div></div>';
    html += '<div class="result-item' + (oldTax.totalTax < newTax.totalTax ? ' winner' : '') + '"><div class="label">Old Regime Tax</div><div class="value">\u20B9' + formatINR(oldTax.totalTax) + '</div></div>';
    html += '<div class="result-item"><div class="label">You Save</div><div class="value" style="color:var(--green)">\u20B9' + formatINR(savings) + '</div></div>';
    html += '<div class="result-item"><div class="label">Better Regime</div><div class="value" style="color:var(--accent)">' + winner + '</div></div>';
    html += '</div>';

    html += '<div class="cta-box"><a href="/?income=' + level.amount + '">Calculate with Your Deductions &rarr;</a></div>';

    // New regime breakdown
    html += '<h2>New Regime Tax Breakdown</h2>';
    html += '<p>Under the new regime, only the standard deduction of \u20B975,000 is allowed. No other deductions like 80C, 80D, or HRA are available.</p>';
    html += renderSlabTable(newTax);

    // Old regime breakdown
    html += '<h2>Old Regime Tax Breakdown</h2>';
    html += '<p>Under the old regime with only the standard deduction of \u20B950,000 (no other deductions claimed). With additional deductions, the old regime tax could be significantly lower.</p>';
    html += renderSlabTable(oldTax);

    // Analysis
    html += '<h2>Analysis: ' + winner + ' is Better</h2>';
    if (newTax.totalTax <= oldTax.totalTax) {
        html += '<p>For a gross salary of \u20B9' + level.label + ' with only standard deduction, the <strong>new regime saves \u20B9' + formatINR(savings) + '</strong> compared to the old regime. The new regime benefits from wider tax slabs and a higher standard deduction of \u20B975,000.</p>';
        if (level.amount <= 1275000) {
            html += '<p>At this income level, the new regime provides <strong>zero tax</strong> thanks to the Section 87A rebate, which eliminates tax for taxable income up to \u20B912 lakh.</p>';
        }
    } else {
        html += '<p>For a gross salary of \u20B9' + level.label + ' with only standard deduction, the <strong>old regime saves \u20B9' + formatINR(savings) + '</strong>. However, keep in mind this calculation does not include any additional deductions. The old regime becomes even more beneficial with 80C, 80D, HRA, and other deductions.</p>';
    }
    html += '<p>The effective tax rate under the best regime is <strong>' + effectiveRate + '%</strong>, meaning your annual take-home (before other deductions) would be approximately <strong>\u20B9' + formatINR(level.amount - bestTax) + '</strong> or <strong>\u20B9' + formatINR(Math.round((level.amount - bestTax) / 12)) + '/month</strong>.</p>';

    html += '</div>';

    // FAQ
    html += '<div class="faq-section"><h2>Frequently Asked Questions</h2>';
    faqItems.forEach(function(f) {
        html += '<div class="faq-item"><h3>' + f.q + '</h3><p>' + f.a + '</p></div>';
    });
    html += '</div>';

    html += getAdBlock();
    html += getIncomeLinks();
    html += getTopicLinks();
    html += getFooter();
    html += '</body></html>';

    var dir = path.join(BASE, slug);
    mkdirp(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
}

// ===================== TOPIC PAGE CONTENT =====================
function generateSlabsContent() {
    var html = '<h2>New Tax Regime Slabs (Default) - FY 2025-26</h2>';
    html += '<p>The Union Budget 2025 revised the new regime slabs, offering more tax relief for middle-income taxpayers.</p>';
    html += '<table><tr><th>Income Slab</th><th>Tax Rate</th></tr>';
    html += '<tr><td>Up to \u20B94,00,000</td><td>Nil</td></tr>';
    html += '<tr><td>\u20B94,00,001 - \u20B98,00,000</td><td>5%</td></tr>';
    html += '<tr><td>\u20B98,00,001 - \u20B912,00,000</td><td>10%</td></tr>';
    html += '<tr><td>\u20B912,00,001 - \u20B916,00,000</td><td>15%</td></tr>';
    html += '<tr><td>\u20B916,00,001 - \u20B920,00,000</td><td>20%</td></tr>';
    html += '<tr><td>\u20B920,00,001 - \u20B924,00,000</td><td>25%</td></tr>';
    html += '<tr><td>Above \u20B924,00,000</td><td>30%</td></tr></table>';
    html += '<p><strong>Standard Deduction:</strong> \u20B975,000 | <strong>Section 87A Rebate:</strong> Full rebate for taxable income up to \u20B912 lakh (effectively zero tax up to \u20B912.75 lakh gross income)</p>';

    html += '<h2>Old Tax Regime Slabs - FY 2025-26</h2>';
    html += '<table><tr><th>Income Slab</th><th>Tax Rate</th></tr>';
    html += '<tr><td>Up to \u20B92,50,000</td><td>Nil</td></tr>';
    html += '<tr><td>\u20B92,50,001 - \u20B95,00,000</td><td>5%</td></tr>';
    html += '<tr><td>\u20B95,00,001 - \u20B910,00,000</td><td>20%</td></tr>';
    html += '<tr><td>Above \u20B910,00,000</td><td>30%</td></tr></table>';
    html += '<p><strong>Standard Deduction:</strong> \u20B950,000 | <strong>Section 87A Rebate:</strong> Up to \u20B912,500 for taxable income up to \u20B95 lakh</p>';

    html += '<h2>Key Differences</h2>';
    html += '<ul><li>New regime has more slabs (7 vs 4) with lower rates</li>';
    html += '<li>New regime standard deduction: \u20B975,000 vs \u20B950,000 in old</li>';
    html += '<li>Old regime allows deductions (80C, 80D, HRA, etc.) which the new does not</li>';
    html += '<li>New regime is the default - you must explicitly opt for old regime</li></ul>';

    html += '<h2>4% Health & Education Cess</h2>';
    html += '<p>A 4% cess is levied on the total tax amount (after rebate) under both regimes. This cess funds health and education initiatives.</p>';
    return html;
}

function generateRegimeComparisonContent() {
    var html = '<h2>Quick Comparison Table</h2>';
    html += '<table><tr><th>Feature</th><th>New Regime</th><th>Old Regime</th></tr>';
    html += '<tr><td>Tax Slabs</td><td>7 slabs (0% to 30%)</td><td>4 slabs (0% to 30%)</td></tr>';
    html += '<tr><td>Standard Deduction</td><td>\u20B975,000</td><td>\u20B950,000</td></tr>';
    html += '<tr><td>Section 80C</td><td>Not allowed</td><td>Up to \u20B91.5 lakh</td></tr>';
    html += '<tr><td>Section 80D</td><td>Not allowed</td><td>Up to \u20B91 lakh</td></tr>';
    html += '<tr><td>HRA Exemption</td><td>Not allowed</td><td>Allowed</td></tr>';
    html += '<tr><td>Home Loan Interest</td><td>Not allowed</td><td>Up to \u20B92 lakh</td></tr>';
    html += '<tr><td>NPS 80CCD(1B)</td><td>Not allowed</td><td>Up to \u20B950,000</td></tr>';
    html += '<tr><td>87A Rebate</td><td>Up to \u20B912L taxable</td><td>Up to \u20B95L taxable</td></tr>';
    html += '<tr><td>Default Regime</td><td>Yes (default)</td><td>Must opt-in</td></tr></table>';

    html += '<h2>When is New Regime Better?</h2>';
    html += '<ul><li>You have minimal or no tax-saving investments</li>';
    html += '<li>You don\'t get HRA or live in your own house</li>';
    html += '<li>Your total deductions are less than \u20B93-4 lakh</li>';
    html += '<li>Your salary is up to \u20B912.75 lakh (zero tax under new regime)</li>';
    html += '<li>You want simplicity without tracking investments</li></ul>';

    html += '<h2>When is Old Regime Better?</h2>';
    html += '<ul><li>You have HRA exemption of \u20B92+ lakh per year</li>';
    html += '<li>You fully utilize 80C (\u20B91.5 lakh) and 80D</li>';
    html += '<li>You have a home loan with interest deduction (\u20B92 lakh)</li>';
    html += '<li>You contribute to NPS for the extra \u20B950,000 deduction</li>';
    html += '<li>Your total deductions exceed \u20B94-5 lakh</li></ul>';

    html += '<h2>Tax Comparison at Different Income Levels</h2>';
    html += '<table><tr><th>Gross Salary</th><th>New Regime Tax</th><th>Old Regime Tax*</th><th>Better Option</th></tr>';
    [500000, 700000, 1000000, 1200000, 1275000, 1500000, 2000000, 2500000].forEach(function(amt) {
        var n = calculateNewRegimeTax(amt);
        var o = calculateOldRegimeTax(amt);
        var label = amt >= 10000000 ? (amt / 10000000) + ' Cr' : amt >= 100000 ? (amt / 100000) + 'L' : formatINR(amt);
        var better = n.totalTax <= o.totalTax ? 'New' : 'Old';
        html += '<tr><td>\u20B9' + label + '</td><td>\u20B9' + formatINR(n.totalTax) + '</td><td>\u20B9' + formatINR(o.totalTax) + '</td><td>' + better + '</td></tr>';
    });
    html += '</table>';
    html += '<p><em>*Old regime tax shown with standard deduction only. With additional deductions, old regime tax would be lower.</em></p>';
    return html;
}

function generate80CContent() {
    var html = '<h2>What is Section 80C?</h2>';
    html += '<p>Section 80C of the Income Tax Act allows a deduction of up to <strong>\u20B91,50,000</strong> per financial year from your taxable income. This is the most popular tax-saving section and covers a wide range of investments and expenses.</p>';
    html += '<p><strong>Note:</strong> Section 80C deductions are available only under the old tax regime.</p>';

    html += '<h2>80C Investment Options</h2>';
    html += '<table><tr><th>Investment</th><th>Lock-in Period</th><th>Returns</th><th>Risk</th></tr>';
    html += '<tr><td>PPF (Public Provident Fund)</td><td>15 years</td><td>~7.1% (tax-free)</td><td>Zero (Govt backed)</td></tr>';
    html += '<tr><td>ELSS (Tax Saving Mutual Funds)</td><td>3 years</td><td>12-15% (market-linked)</td><td>Moderate-High</td></tr>';
    html += '<tr><td>EPF (Employee Provident Fund)</td><td>Till retirement</td><td>~8.25%</td><td>Zero (Govt backed)</td></tr>';
    html += '<tr><td>NSC (National Savings Certificate)</td><td>5 years</td><td>~7.7%</td><td>Zero (Govt backed)</td></tr>';
    html += '<tr><td>SCSS (Senior Citizens Savings Scheme)</td><td>5 years</td><td>~8.2%</td><td>Zero (Govt backed)</td></tr>';
    html += '<tr><td>Tax Saving FD</td><td>5 years</td><td>6.5-7.5%</td><td>Zero (Bank)</td></tr>';
    html += '<tr><td>LIC Premium</td><td>Policy term</td><td>4-6%</td><td>Zero</td></tr>';
    html += '<tr><td>Sukanya Samriddhi (SSY)</td><td>21 years</td><td>~8.2% (tax-free)</td><td>Zero (Govt backed)</td></tr>';
    html += '<tr><td>Home Loan Principal</td><td>Loan term</td><td>N/A</td><td>N/A</td></tr>';
    html += '<tr><td>Children\'s Tuition Fees</td><td>N/A</td><td>N/A</td><td>N/A</td></tr></table>';

    html += '<h2>Tax Savings Under 80C</h2>';
    html += '<p>If you invest the full \u20B91.5 lakh under 80C and are in the 30% tax bracket, you save <strong>\u20B946,800</strong> in taxes (\u20B91,50,000 x 30% + 4% cess).</p>';
    html += '<ul><li>30% bracket: Save \u20B946,800</li><li>20% bracket: Save \u20B931,200</li><li>5% bracket: Save \u20B97,800</li></ul>';
    return html;
}

function generate80DContent() {
    var html = '<h2>What is Section 80D?</h2>';
    html += '<p>Section 80D allows a deduction for health insurance premiums paid for yourself, your family, and your parents. This is available only under the old tax regime.</p>';

    html += '<h2>Deduction Limits</h2>';
    html += '<table><tr><th>Category</th><th>Below 60 years</th><th>60 years or above</th></tr>';
    html += '<tr><td>Self, Spouse & Children</td><td>\u20B925,000</td><td>\u20B950,000</td></tr>';
    html += '<tr><td>Parents</td><td>\u20B925,000</td><td>\u20B950,000</td></tr>';
    html += '<tr><td><strong>Maximum Total</strong></td><td><strong>\u20B950,000</strong></td><td><strong>\u20B91,00,000</strong></td></tr></table>';

    html += '<h2>What\'s Covered Under 80D?</h2>';
    html += '<ul><li>Health insurance premium for self, spouse, and dependent children</li>';
    html += '<li>Health insurance premium for parents (separate limit)</li>';
    html += '<li>Preventive health check-up: Up to \u20B95,000 (within the overall limit)</li>';
    html += '<li>Medical expenditure for senior citizens without insurance: Up to \u20B950,000</li></ul>';

    html += '<h2>Maximum Deduction Scenarios</h2>';
    html += '<ul><li><strong>\u20B925,000</strong>: Self/family insurance only (all below 60)</li>';
    html += '<li><strong>\u20B950,000</strong>: Self + parents insurance (all below 60)</li>';
    html += '<li><strong>\u20B975,000</strong>: Self below 60 + parents above 60</li>';
    html += '<li><strong>\u20B91,00,000</strong>: All above 60 (self + parents)</li></ul>';
    return html;
}

function generateHRAContent() {
    var html = '<h2>What is HRA Exemption?</h2>';
    html += '<p>House Rent Allowance (HRA) is a component of salary that can be partially or fully exempt from tax under Section 10(13A). The exemption is available only under the <strong>old tax regime</strong>.</p>';

    html += '<h2>HRA Calculation Formula</h2>';
    html += '<p>HRA exemption is the <strong>minimum</strong> of these three:</p>';
    html += '<ul><li><strong>(A) Actual HRA received</strong> from your employer</li>';
    html += '<li><strong>(B) 50% of (Basic + DA)</strong> for metro cities (Delhi, Mumbai, Kolkata, Chennai) or <strong>40%</strong> for non-metro</li>';
    html += '<li><strong>(C) Rent paid minus 10% of (Basic + DA)</strong></li></ul>';

    html += '<h2>HRA Calculation Example</h2>';
    html += '<p>For a person with Basic Salary of \u20B96 lakh, HRA of \u20B92.4 lakh, Rent of \u20B93 lakh in a metro city:</p>';
    html += '<table><tr><th>Component</th><th>Calculation</th><th>Amount</th></tr>';
    html += '<tr><td>(A) Actual HRA</td><td>As received</td><td>\u20B92,40,000</td></tr>';
    html += '<tr><td>(B) 50% of Basic</td><td>50% x \u20B96,00,000</td><td>\u20B93,00,000</td></tr>';
    html += '<tr><td>(C) Rent - 10% of Basic</td><td>\u20B93,00,000 - \u20B960,000</td><td>\u20B92,40,000</td></tr>';
    html += '<tr><td><strong>Exempt HRA</strong></td><td><strong>Minimum of A, B, C</strong></td><td><strong>\u20B92,40,000</strong></td></tr></table>';

    html += '<h2>Key Rules for HRA</h2>';
    html += '<ul><li>HRA exemption is <strong>not available under the new tax regime</strong></li>';
    html += '<li>You must actually pay rent - self-occupied house owners cannot claim</li>';
    html += '<li>Rent paid to parents is allowed with a valid rent agreement</li>';
    html += '<li>Landlord\'s PAN is mandatory if annual rent exceeds \u20B91 lakh</li>';
    html += '<li>DA is included only if it forms part of retirement benefits</li></ul>';

    html += '<div class="cta-box"><a href="/hra-calculator">Try Our HRA Calculator &rarr;</a></div>';
    return html;
}

function generateTaxTipsContent() {
    var html = '<h2>1. Choose the Right Tax Regime</h2>';
    html += '<p>This is the most impactful decision. If your total deductions (80C + 80D + HRA + home loan + NPS) exceed \u20B93.75-4 lakh, the old regime is likely better. Otherwise, the new regime with its lower slabs may save more. Use our <a href="/" style="color:var(--accent)">tax calculator</a> to compare.</p>';

    html += '<h2>2. Maximize Section 80C (\u20B91.5 lakh)</h2>';
    html += '<ul><li>Check your EPF contribution first - it counts toward 80C</li>';
    html += '<li>Invest in ELSS for the shortest lock-in (3 years) with best returns potential</li>';
    html += '<li>PPF offers guaranteed, tax-free returns for conservative investors</li>';
    html += '<li>Don\'t forget home loan principal repayment counts under 80C</li></ul>';

    html += '<h2>3. Get Health Insurance for 80D</h2>';
    html += '<p>Buy health insurance for yourself and parents. Get up to \u20B91 lakh deduction while also getting essential health coverage. The premium is much less than the tax saved.</p>';

    html += '<h2>4. Claim Full HRA Exemption</h2>';
    html += '<ul><li>If you live in rented accommodation, ensure you claim HRA</li>';
    html += '<li>You can pay rent to parents and claim HRA (with proper documentation)</li>';
    html += '<li>Get rent receipts and landlord PAN if rent exceeds \u20B91 lakh/year</li></ul>';

    html += '<h2>5. Invest in NPS for Extra \u20B950,000</h2>';
    html += '<p>Section 80CCD(1B) gives an <strong>additional \u20B950,000 deduction</strong> over and above the 80C limit. This is one of the easiest ways to reduce tax if you\'re already maxing out 80C.</p>';

    html += '<h2>6. Home Loan Interest Deduction</h2>';
    html += '<p>If you have a home loan, claim up to \u20B92 lakh interest deduction under Section 24b. Combined with principal repayment under 80C, a home loan can save significant tax.</p>';

    html += '<h2>7. Time Your Tax-Saving Investments</h2>';
    html += '<ul><li>Start SIP in ELSS at the beginning of the financial year</li>';
    html += '<li>Don\'t rush investments in March - plan through the year</li>';
    html += '<li>Set up auto-debit for PPF, NPS, and health insurance</li></ul>';

    html += '<h2>Summary of Maximum Deductions (Old Regime)</h2>';
    html += '<table><tr><th>Section</th><th>Deduction</th><th>Max Amount</th></tr>';
    html += '<tr><td>Standard Deduction</td><td>Flat deduction from salary</td><td>\u20B950,000</td></tr>';
    html += '<tr><td>80C</td><td>PPF, ELSS, EPF, LIC, etc.</td><td>\u20B91,50,000</td></tr>';
    html += '<tr><td>80D</td><td>Health insurance</td><td>\u20B91,00,000</td></tr>';
    html += '<tr><td>80CCD(1B)</td><td>NPS additional</td><td>\u20B950,000</td></tr>';
    html += '<tr><td>24b</td><td>Home loan interest</td><td>\u20B92,00,000</td></tr>';
    html += '<tr><td>10(13A)</td><td>HRA exemption</td><td>As per formula</td></tr>';
    html += '<tr><td colspan="2"><strong>Total (excl. HRA)</strong></td><td><strong>\u20B95,50,000+</strong></td></tr></table>';
    return html;
}

// ===================== TOPIC PAGE GENERATION =====================
function generateTopicPage(topic) {
    var canonical = '/' + topic.slug;
    var html = getHead(topic.title, topic.desc, canonical);
    html += '\n<body>';
    html += getHeader();
    html += getBreadcrumb([{ name: topic.title.split('|')[0].trim() }]);
    html += '<div class="hero"><h1>' + topic.title.split('|')[0].trim().replace(/FY 2025-26/g, '<span class="hl">FY 2025-26</span>') + '</h1>';
    html += '<p>' + topic.desc.substring(0, 150) + '</p></div>';
    html += getAdBlock();
    html += '<div class="content">' + topic.content() + '</div>';
    html += getAdBlock();
    html += getIncomeLinks();
    html += getTopicLinks();
    html += getFooter();
    html += '</body></html>';

    var dir = path.join(BASE, topic.slug);
    mkdirp(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
}

// ===================== SITEMAP =====================
function generateSitemap() {
    var today = new Date().toISOString().split('T')[0];
    var urls = [];
    urls.push({ loc: '/', priority: '1.0', freq: 'weekly' });
    urls.push({ loc: '/hra-calculator', priority: '0.9', freq: 'monthly' });
    urls.push({ loc: '/privacy', priority: '0.3', freq: 'yearly' });

    INCOME_LEVELS.forEach(function(l) {
        urls.push({ loc: '/income-tax-on-' + l.slug + '-salary', priority: '0.7', freq: 'monthly' });
    });
    TOPIC_PAGES.forEach(function(t) {
        urls.push({ loc: '/' + t.slug, priority: '0.8', freq: 'monthly' });
    });

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    urls.forEach(function(u) {
        xml += '<url><loc>https://taxbatao.com' + u.loc + '</loc><lastmod>' + today + '</lastmod><changefreq>' + u.freq + '</changefreq><priority>' + u.priority + '</priority></url>\n';
    });
    xml += '</urlset>';
    fs.writeFileSync(path.join(BASE, 'sitemap.xml'), xml);
}

// ===================== MAIN BUILD =====================
console.log('Generating Tax Batao pages...\n');

// Create dist directory
mkdirp(DIST);

// Copy static files to dist
const STATIC_FILES = ['index.html', 'about.html', 'privacy.html', 'ads.txt', 'robots.txt', '855619084ca64ac9afe95c0b2b58894d.txt'];
STATIC_FILES.forEach(function(f) {
    var src = path.join(__dirname, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(DIST, f));
    }
});
// Copy static subdirectories (hra-calculator, hra-exemption-rules)
['hra-calculator', 'hra-exemption-rules'].forEach(function(dir) {
    var src = path.join(__dirname, dir);
    if (fs.existsSync(src)) {
        var destDir = path.join(DIST, dir);
        mkdirp(destDir);
        fs.readdirSync(src).forEach(function(f) {
            fs.copyFileSync(path.join(src, f), path.join(destDir, f));
        });
    }
});
console.log('  Copied static files to dist/');

// Copy blog directory
var blogSrcDir = path.join(__dirname, 'blog');
if (fs.existsSync(blogSrcDir)) {
    copyDirRecursive(blogSrcDir, path.join(DIST, 'blog'));
    var blogPosts = fs.readdirSync(blogSrcDir).filter(function(f) {
        return f !== 'index.html' && fs.existsSync(path.join(blogSrcDir, f, 'index.html'));
    });
    console.log('  Copied blog/ directory (' + blogPosts.length + ' posts)');
}

// Income level pages
INCOME_LEVELS.forEach(generateIncomePage);
console.log('  Generated ' + INCOME_LEVELS.length + ' income level pages');

// Topic pages
TOPIC_PAGES.forEach(generateTopicPage);
console.log('  Generated ' + TOPIC_PAGES.length + ' topic pages');

// Sitemap
generateSitemap();
console.log('  Generated sitemap.xml');

console.log('\nDone! Total: ' + (INCOME_LEVELS.length + TOPIC_PAGES.length) + ' pages + sitemap');
console.log('Output: ' + DIST);
