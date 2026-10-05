// Assumed gross annual return used by the cost calculator (7 %).
const GROSS_ANNUAL_RETURN = 0.07;

// Defaults shown in the calculator.
// The current cost is pre-filled with FI's median fee for actively managed funds.
const DEFAULT_AMOUNT = 75000;
const DEFAULT_CURRENT_COST_PERCENT = 1.3;

// ============================================================================
// EXAMPLE DATA – replace with real data about institutes later.
// Institute names, costs and reasons below are made up.
// ============================================================================
const EXAMPLE_DATA = {
  // One row per need: what the person has today, what we suggest, and the yearly difference.
  // type "interest": better interest on a sum; "fee": lower fee on a sum;
  // "courtage": lower cost per trade, for a number of trades per year.
  setup: [
    {
      type: 'interest', need: 'Buffert', amount: 50000,
      today: { name: 'Lönekonto', rate: 0 },
      suggestion: { name: 'Sparkonto hos Institut A', rate: 2 },
    },
    {
      type: 'fee', need: 'Långsiktigt sparande', amount: 100000,
      today: { name: 'Aktiv fond', fee: 1.3 },
      suggestion: { name: 'Indexfond hos Institut B', fee: 0.25 },
    },
    {
      type: 'courtage', need: 'Aktiv handel', trades: 20, tradeSize: 10000,
      today: { courtage: 99 },
      suggestion: { name: 'Institut C', courtage: 25 },
    },
  ],

  // Yearly cost of the example setup, in % of the amount saved.
  bestSetup: {
    feePercent: 0.15,           // fund and account fees
    courtagePercent: 0.05,      // trading costs
    extraInterestPercent: 0.1,  // better interest than a typical bank, counts in your favour
  },
};
// ============================== END EXAMPLE DATA =============================

// Total yearly cost of the example setup: fees plus courtage minus extra interest.
const BEST_SETUP_COST_PERCENT = Math.round(
  (EXAMPLE_DATA.bestSetup.feePercent + EXAMPLE_DATA.bestSetup.courtagePercent - EXAMPLE_DATA.bestSetup.extraInterestPercent) * 100
) / 100;

// ============================================================================
// EXAMPLE DATA – rough prices (kr) for "what the difference could buy".
// Sorted from cheapest to most expensive. The ladder starts low on purpose, so a
// typical saver (50 000–100 000 kr) still reaches several steps.
// ============================================================================
const GAP_COMPARISONS = [
  { label: 'en bra middag för två', price: 1500 },
  { label: 'ett gymkort i ett år', price: 4000 },
  { label: 'en weekendresa', price: 10000 },
  { label: 'en golden retriever', price: 20000 },
  { label: 'en elcykel', price: 25000 },
  { label: 'en solsemester för familjen', price: 45000 },
  { label: 'en begagnad Volvo', price: 150000 },
  { label: 'en ny Volvo', price: 600000 },
];
// ============================== END EXAMPLE DATA =============================

const NBSP = ' ';
const MINUS = '−';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attributes, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes || {}).forEach(([name, value]) => node.setAttribute(name, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- Formatting (Swedish style: 125 000 kr, 0,22 %) ----------

function formatKronor(value) {
  const rounded = Math.round(Math.abs(value));
  const sign = value < 0 && rounded !== 0 ? MINUS : '';
  return sign + rounded.toLocaleString('sv-SE') + NBSP + 'kr';
}

function formatPercent(value, decimals) {
  const sign = value < 0 ? MINUS : '';
  const number = Math.abs(value).toLocaleString('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return sign + number + NBSP + '%';
}

// Accepts "200 000", "1,5" and "1.5". Returns NaN for anything else.
function parseNumber(text) {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  return cleaned === '' ? NaN : Number(cleaned);
}

// ---------- Cost calculator ----------

const calcForm = document.getElementById('calc-form');
const amountInput = document.getElementById('calc-amount');
const yearsInput = document.getElementById('calc-years');
const feeInput = document.getElementById('calc-fee');
const calcCurrent = document.getElementById('calc-current');
const calcExample = document.getElementById('calc-example');
const calcDiff = document.getElementById('calc-diff');
const calcMessage = document.getElementById('calc-message');

// Value after `years` when the fee is charged on the whole balance each year.
function endValue(amount, years, feePercent) {
  const yearlyGrowth = (1 + GROSS_ANNUAL_RETURN) * (1 - feePercent / 100);
  return amount * Math.pow(yearlyGrowth, years);
}

function isValid(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

// ---------- Cost chart ----------

const chartFigure = document.getElementById('calc-chart-figure');
const chartBox = document.getElementById('calc-chart');
const milestoneList = document.getElementById('calc-milestones');
const legendCurrentFee = document.getElementById('legend-current-fee');
const legendExampleFee = document.getElementById('legend-example-fee');
const WIDE_CHART = 560; // below this width only numbered markers are drawn
let lastChartInput = null;

// Rounds up to the next 1, 2, 4, 5, 6, 8 or 10 times a power of ten.
function niceMax(value) {
  const base = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / base;
  // Fine steps whose half is a round number, so the lines fill the chart height.
  const step = [1, 2, 4, 5, 6, 8, 10].find((candidate) => f <= candidate);
  return step * base;
}

// 800 000 -> "800 tkr", 1 200 000 -> "1,2 mnkr"
function formatCompact(value) {
  if (value >= 1e6) return (value / 1e6).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + NBSP + 'mnkr';
  if (value >= 1e3) return Math.round(value / 1e3).toLocaleString('sv-SE') + NBSP + 'tkr';
  return Math.round(value).toLocaleString('sv-SE');
}

function clearChart() {
  lastChartInput = null;
  chartFigure.hidden = true;
  chartBox.replaceChildren();
  milestoneList.replaceChildren();
}

function renderChart(amount, years, fee, difference) {
  lastChartInput = [amount, years, fee, difference];

  const exampleFee = BEST_SETUP_COST_PERCENT;
  const finalExample = endValue(amount, years, exampleFee);
  if (!(finalExample > 0)) {
    clearChart();
    return;
  }

  // One point per year, plus the exact end.
  const times = [];
  for (let t = 0; t < years; t += 1) times.push(t);
  times.push(years);
  const current = times.map((t) => endValue(amount, t, fee));
  const example = times.map((t) => endValue(amount, t, exampleFee));

  // The figure must be visible before it is measured.
  chartFigure.hidden = false;
  const width = Math.max(chartBox.clientWidth, 280);
  const wide = width >= WIDE_CHART;
  const height = wide ? 340 : 260;
  const margin = { top: 16, right: 16, bottom: 32, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMax = niceMax(Math.max(finalExample, endValue(amount, years, fee)));
  const x = (t) => margin.left + (t / years) * plotWidth;
  const y = (v) => margin.top + plotHeight * (1 - v / yMax);

  const svg = svgEl('svg', {
    width: width,
    height: height,
    viewBox: '0 0 ' + width + ' ' + height,
    role: 'img',
    'aria-label': 'Diagram över slutvärdet de kommande ' + years + ' åren hos ditt nuvarande institut och med ditt bästa upplägg. ' +
      (difference > 0 ? 'Skillnaden efter ' + years + ' år är ' + formatKronor(difference) + '.' : ''),
  });

  // Horizontal grid and value labels.
  [0, 0.5, 1].forEach((share) => {
    const gy = y(yMax * share);
    svg.append(
      svgEl('line', { class: 'chart-grid', x1: margin.left, x2: width - margin.right, y1: gy, y2: gy }),
      svgEl('text', { class: 'chart-axis-text', x: margin.left - 8, y: gy, 'text-anchor': 'end', 'dominant-baseline': 'central' }, formatCompact(yMax * share)),
    );
  });

  // Year labels, at most about six.
  const step = Math.max(1, Math.ceil(years / 5));
  const labelYears = [];
  for (let t = 0; t <= years; t += step) labelYears.push(t);
  if (years - labelYears[labelYears.length - 1] >= step / 2) labelYears.push(years);
  labelYears.forEach((t) => {
    svg.append(svgEl('text', {
      class: 'chart-axis-text',
      x: x(t),
      y: height - margin.bottom + 18,
      'text-anchor': t === 0 ? 'start' : t === years ? 'end' : 'middle',
    }, t === 0 ? '0' : t + ' år'));
  });

  // The gap between the two lines, then the lines themselves.
  const gapPoints = times.map((t, i) => x(t) + ',' + y(example[i]))
    .concat(times.map((t, i) => x(times[times.length - 1 - i]) + ',' + y(current[times.length - 1 - i])));
  svg.append(
    svgEl('polygon', { class: 'chart-gap', points: gapPoints.join(' ') }),
    svgEl('polyline', { class: 'chart-line-current', points: times.map((t, i) => x(t) + ',' + y(current[i])).join(' ') }),
    svgEl('polyline', { class: 'chart-line-example', points: times.map((t, i) => x(t) + ',' + y(example[i])).join(' ') }),
  );

  // Markers where the gap first becomes large enough to buy something.
  const gap = example.map((value, i) => value - current[i]);
  const milestones = [];
  GAP_COMPARISONS.forEach((item) => {
    const i = gap.findIndex((value) => value >= item.price);
    if (i < 1) return;
    const share = (item.price - gap[i - 1]) / (gap[i] - gap[i - 1]);
    const t = times[i - 1] + share * (times[i] - times[i - 1]);
    const value = example[i - 1] + share * (example[i] - example[i - 1]);
    milestones.push({ item, t, value });
  });

  // Drop markers that would sit on top of the previous one.
  let lastMarkerX = -Infinity;
  for (let i = 0; i < milestones.length; i += 1) {
    const markerX = x(milestones[i].t);
    if (markerX - lastMarkerX < 28) {
      milestones.splice(i, 1);
      i -= 1;
    } else {
      lastMarkerX = markerX;
    }
  }

  const placedLabelY = [];
  milestones.forEach((milestone, index) => {
    const cx = x(milestone.t);
    const cy = y(milestone.value);
    const group = svgEl('g', { class: 'chart-marker' });
    group.append(
      svgEl('circle', { cx: cx, cy: cy, r: 10 }),
      svgEl('text', { class: 'num', x: cx, y: cy }, String(index + 1)),
    );

    if (wide) {
      // The label sits up and to the left of the marker, where the line is not.
      const textWidth = milestone.item.label.length * 7.6;
      let labelY = cy - 16;
      while (placedLabelY.some((other) => Math.abs(other - labelY) < 18)) labelY -= 18;
      if (cx - 14 - textWidth > margin.left && labelY > margin.top) {
        placedLabelY.push(labelY);
        group.append(svgEl('text', { class: 'chart-label', x: cx - 14, y: labelY, 'text-anchor': 'end', 'dominant-baseline': 'central' }, milestone.item.label));
      }
    }
    svg.append(group);
  });

  chartBox.replaceChildren(svg);
  legendCurrentFee.textContent = formatPercent(fee, 2);
  legendExampleFee.textContent = formatPercent(exampleFee, 2);

  // The same information as text, for small screens and screen readers.
  const rows = milestones.map((milestone, index) => {
    const number = document.createElement('span');
    number.className = 'milestone-number';
    number.textContent = String(index + 1);
    const text = document.createElement('span');
    text.append('Efter ' + Math.ceil(milestone.t) + ' år hade skillnaden räckt till ');
    const strong = document.createElement('strong');
    strong.textContent = milestone.item.label;
    text.append(strong, '.');
    const row = document.createElement('li');
    row.append(number, text);
    return row;
  });
  if (!rows.length && difference > 0) {
    const row = document.createElement('li');
    row.textContent = 'Med de här siffrorna räcker skillnaden inte till något av våra exempel än.';
    rows.push(row);
  }
  milestoneList.replaceChildren(...rows);
  chartFigure.hidden = false;
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (lastChartInput) renderChart(...lastChartInput);
  }, 120);
});

function updateCalculator() {
  const amount = parseNumber(amountInput.value);
  const years = parseNumber(yearsInput.value);
  const fee = parseNumber(feeInput.value);

  const amountOk = isValid(amount, 0, 1e9);
  const yearsOk = isValid(years, 1, 60);
  const feeOk = isValid(fee, 0, 10);

  amountInput.setAttribute('aria-invalid', String(!amountOk));
  yearsInput.setAttribute('aria-invalid', String(!yearsOk));
  feeInput.setAttribute('aria-invalid', String(!feeOk));

  calcDiff.classList.remove('is-positive');

  if (!amountOk || !yearsOk || !feeOk) {
    calcCurrent.textContent = '–';
    calcExample.textContent = '–';
    calcDiff.textContent = '–';
    calcMessage.textContent = 'Fyll i belopp, antal år (1–60) och kostnad (0–10 %) med siffror.';
    clearChart();
    return;
  }

  const withCurrentFee = endValue(amount, years, fee);
  const withExampleFee = endValue(amount, years, BEST_SETUP_COST_PERCENT);
  const difference = Math.round(withExampleFee) - Math.round(withCurrentFee);

  calcCurrent.textContent = formatKronor(withCurrentFee);
  calcExample.textContent = formatKronor(withExampleFee);

  if (difference > 0) {
    calcDiff.textContent = '+' + formatKronor(difference);
    calcDiff.classList.add('is-positive');
    calcMessage.textContent = 'Så mycket mer kan du ha kvar med ett bättre upplägg.';
  } else {
    calcDiff.textContent = formatKronor(difference);
    calcMessage.textContent = 'Ditt nuvarande institut kostar redan lika lite som vårt exempel, eller mindre. Då finns inget att tjäna på att byta för kostnadens skull.';
  }

  renderChart(amount, years, fee, difference);
}

document.getElementById('calc-example-fee').textContent = formatPercent(BEST_SETUP_COST_PERCENT, 2);
document.getElementById('calc-return').textContent = formatPercent(GROSS_ANNUAL_RETURN * 100, 0);

// Pre-fill the calculator.
amountInput.value = DEFAULT_AMOUNT.toLocaleString('sv-SE');
feeInput.value = DEFAULT_CURRENT_COST_PERCENT.toLocaleString('sv-SE', { minimumFractionDigits: 2 });

// Explain what the example setup consists of.
const bestSetup = EXAMPLE_DATA.bestSetup;
document.getElementById('calc-best-setup').textContent =
  'Ditt bästa upplägg i exemplet: avgifter ' + formatPercent(bestSetup.feePercent, 2) +
  ', courtage ' + formatPercent(bestSetup.courtagePercent, 2) +
  ' och ' + formatPercent(bestSetup.extraInterestPercent, 2) + ' mer i ränta. ' +
  'Totalt ' + formatPercent(BEST_SETUP_COST_PERCENT, 2) + ' per år.';

calcForm.addEventListener('input', updateCalculator);
calcForm.addEventListener('submit', (event) => event.preventDefault());

updateCalculator();

// ---------- Example result ----------

// 2 -> "2 %", 1.3 -> "1,30 %", 0.25 -> "0,25 %"
function formatRate(value) {
  return formatPercent(value, Number.isInteger(value) ? 0 : 2);
}

// What the suggested setup saves per year compared with today, in whole kronor.
function yearlyGain(row) {
  let gain;
  if (row.type === 'interest') gain = (row.amount * (row.suggestion.rate - row.today.rate)) / 100;
  else if (row.type === 'fee') gain = (row.amount * (row.today.fee - row.suggestion.fee)) / 100;
  else gain = row.trades * (row.today.courtage - row.suggestion.courtage);
  return Math.round(gain);
}

function needLabel(row) {
  if (row.type === 'courtage') return row.need + ', ' + row.trades + ' affärer à ' + formatKronor(row.tradeSize);
  return row.need + ', ' + formatKronor(row.amount);
}

function todayLabel(row) {
  if (row.type === 'interest') return row.today.name + ', ' + formatRate(row.today.rate) + ' ränta';
  if (row.type === 'fee') return row.today.name + ', ' + formatRate(row.today.fee) + ' avgift';
  return formatKronor(row.today.courtage) + ' courtage per affär';
}

function suggestionLabel(row) {
  if (row.type === 'interest') return row.suggestion.name + ', ' + formatRate(row.suggestion.rate) + ' ränta';
  if (row.type === 'fee') return row.suggestion.name + ', ' + formatRate(row.suggestion.fee) + ' avgift';
  return formatKronor(row.suggestion.courtage) + ' courtage hos ' + row.suggestion.name;
}

function labelledCell(className, label, value) {
  const cell = document.createElement('span');
  cell.className = className;
  const labelEl = document.createElement('span');
  labelEl.className = 'setup-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'setup-value';
  valueEl.textContent = value;
  cell.append(labelEl, valueEl);
  return cell;
}

const setupList = document.getElementById('setup-list');
let totalGain = 0;
const setupRows = EXAMPLE_DATA.setup.map((item) => {
  const gain = yearlyGain(item);
  totalGain += gain;

  const row = document.createElement('li');
  row.className = 'setup-row';

  const need = document.createElement('span');
  need.className = 'setup-need';
  need.textContent = needLabel(item);

  const gainEl = document.createElement('span');
  gainEl.className = 'setup-gain is-positive';
  gainEl.textContent = '+' + formatKronor(gain) + '/år';

  row.append(
    need,
    labelledCell('setup-old', 'Idag', todayLabel(item)),
    labelledCell('setup-new', 'Upplägg', suggestionLabel(item)),
    gainEl,
  );
  return row;
});
setupList.replaceChildren(...setupRows);

// The total is the sum of the rows above.
document.getElementById('example-gain').textContent = formatKronor(totalGain);

// ---------- Placeholder links ----------

// Pages that do not exist yet (privacy policy, cookies, method).
document.querySelectorAll('[data-placeholder]').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});
