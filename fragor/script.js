// Questionnaire flow. Questions, rules and fund data live in data.js.
// Answers are kept in memory only: nothing is stored or sent anywhere.

const NBSP = ' ';
const MINUS = '−';
const START = -1;
const RESULT = Infinity; // reached when step advances past the last visible question

const app = document.getElementById('app');
const state = { step: START, answers: {} };

// Questions with a `showIf` are hidden unless the predicate matches current
// answers (e.g. the stock-trading follow-ups only show if instruments
// includes aktier/etf). Recomputed on every render since answers change.
function visibleQuestions() {
  return QUESTIONS.filter((question) => !question.showIf || question.showIf(state.answers));
}

// ---------- Formatting (Swedish style: 125 000 kr, 0,22 %) ----------

function formatKronor(value) {
  return Math.round(value).toLocaleString('sv-SE') + NBSP + 'kr';
}

function formatPercent(value, decimals) {
  const sign = value < 0 ? MINUS : '';
  const number = Math.abs(value).toLocaleString('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return sign + number + NBSP + '%';
}

// annualFeePercent is either a plain number or a { min, max } range.
function formatAnnualFee(value) {
  if (typeof value === 'number') return formatPercent(value, 2);
  return formatPercent(value.min, 2) + '–' + formatPercent(value.max, 2);
}

// ---------- Small DOM helper ----------

function el(tag, attributes, ...children) {
  const node = document.createElement(tag);
  Object.entries(attributes || {}).forEach(([name, value]) => {
    if (name === 'class') node.className = value;
    else if (name === 'onclick') node.addEventListener('click', value);
    else node.setAttribute(name, value);
  });
  node.append(...children.filter((child) => child !== null));
  return node;
}

// ---------- Matching ----------

function findOption(groupId) {
  for (const question of QUESTIONS) {
    for (const group of question.groups) {
      if (group.id === groupId) {
        return group.options.find((option) => option.value === state.answers[groupId]);
      }
    }
  }
  return undefined;
}

// Same lookup as findOption, but for multiSelect groups where the answer is
// an array of values instead of a single one.
function findSelectedOptions(groupId) {
  for (const question of QUESTIONS) {
    for (const group of question.groups) {
      if (group.id === groupId) {
        const values = Array.isArray(state.answers[groupId]) ? state.answers[groupId] : [];
        return group.options.filter((option) => values.includes(option.value));
      }
    }
  }
  return [];
}

// ---------- Stock/ETF trading cost estimate ----------
// Rough estimate - Standard/Access-tier only - used to rank institutes by
// courtage + växling cost for someone who trades individual stocks/ETFs,
// the one dimension findBestProduct() never looks at (it only compares
// fund/savings equityPercent + fee). Ignores tier-switching (Levler Plus,
// Avanza Start under 50 000 kr total capital) and assumes every trade is the
// same size - a starting point, not a quote.
function estimateTieredCourtageKr(classes, orderSizeKr) {
  if (orderSizeKr < classes.mini.maxOrderKr) {
    return Math.max(classes.mini.minCourtageKr, orderSizeKr * (classes.mini.courtagePercent / 100));
  }
  if (orderSizeKr < classes.small.maxOrderKr) {
    return Math.max(classes.small.minCourtageKr, orderSizeKr * (classes.small.courtagePercent / 100));
  }
  if (orderSizeKr < classes.medium.maxOrderKr) {
    return Math.max(classes.medium.minCourtageKr, orderSizeKr * (classes.medium.courtagePercent / 100));
  }
  return classes.fastPris.fixedCourtageKr;
}

function estimateTradingCostPerYear(institute, tradesPerYear, orderSizeKr, foreignSharePercent) {
  const trading = institute.trading;
  let courtageKr;
  let fxFeePercent;
  if (trading.stockCourtageClasses) {
    courtageKr = estimateTieredCourtageKr(trading.stockCourtageClasses, orderSizeKr);
    fxFeePercent = trading.fxFeePercent;
  } else if (trading.tiers) {
    const tier = trading.tiers.access;
    courtageKr = Math.max(1, orderSizeKr * (tier.stockCourtagePercent / 100));
    fxFeePercent = tier.fxFeePercent;
  } else {
    return null;
  }
  const fxKr = orderSizeKr * (foreignSharePercent / 100) * (fxFeePercent / 100);
  return Math.round((courtageKr + fxKr) * tradesPerYear);
}

// null if the user never indicated they trade stocks/ETFs, or hasn't
// answered the follow-up questions yet.
function computeTradingEstimate() {
  const instruments = Array.isArray(state.answers.instruments) ? state.answers.instruments : [];
  if (!instruments.some((v) => v === 'aktier' || v === 'etf')) return null;

  const frequency = findOption('tradeFrequency');
  const orderSize = findOption('orderSize');
  const foreignShare = findOption('foreignShare');
  if (!frequency || !orderSize || !foreignShare) return null;

  const results = Object.values(INSTITUTES)
    .map((institute) => {
      const costKr = estimateTradingCostPerYear(institute, frequency.tradesPerYear, orderSize.orderSizeKr, foreignShare.foreignSharePercent);
      return costKr === null ? null : { institute, costKr, verified: institute.trading.verified };
    })
    .filter((result) => result !== null)
    .sort((a, b) => a.costKr - b.costKr);
  if (results.length === 0) return null;

  return {
    tradesPerYear: frequency.tradesPerYear,
    orderSizeKr: orderSize.orderSizeKr,
    foreignSharePercent: foreignShare.foreignSharePercent,
    results,
  };
}

// True unless the user explicitly picked instruments that exclude "Fonder" -
// e.g. only "Enskilda aktier"/"ETF:er". If they don't want a fund package,
// fundPackages shouldn't be a candidate at all, even if one would otherwise
// "fit" their risk tolerance.
function wantsFundPackages() {
  const instruments = Array.isArray(state.answers.instruments) ? state.answers.instruments : [];
  if (instruments.length === 0) return true; // not answered yet - don't exclude anything
  return instruments.includes('fonder');
}

// Highest-equity verified product across ALL institutes (a savings account
// counts as a 0%-equity product) that still respects maxEquity. Unverified
// packages (equityPercent: null, e.g. Försiktig today) are skipped so
// unconfirmed numbers never reach a real result, and institutes with no
// fundPackages (e.g. Montrose) just contribute their savings account.
// Ties go to the cheaper product, then (for savings accounts) the higher
// interest rate - a 0%-fee tie wouldn't otherwise separate two savings
// accounts with different interest rates.
function findBestProduct(maxEquity, includeFundPackages) {
  const candidates = [];
  Object.values(INSTITUTES).forEach((institute) => {
    const products = includeFundPackages ? [institute.savingsAccount, ...institute.fundPackages] : [institute.savingsAccount];
    products.forEach((product) => {
      if (product.verified && typeof product.equityPercent === 'number' && product.equityPercent <= maxEquity) {
        candidates.push({ institute, product });
      }
    });
  });
  if (candidates.length === 0) return null;

  const feeValue = (product) => (typeof product.annualFeePercent === 'number' ? product.annualFeePercent : product.annualFeePercent.min);
  return candidates.reduce((best, candidate) => {
    const product = candidate.product;
    if (product.equityPercent > best.product.equityPercent) return candidate;
    if (product.equityPercent < best.product.equityPercent) return best;
    if (feeValue(product) < feeValue(best.product)) return candidate;
    if (feeValue(product) > feeValue(best.product)) return best;
    if ((product.interestPercent || 0) > (best.product.interestPercent || 0)) return candidate;
    return best;
  });
}

// The share of equity funds is the lowest limit set by any answer.
function computeResult() {
  let equity = 100;
  let limitedBy = 'none';

  // Checked in this order, so the first group wins when two limits are equal.
  ['horizon', 'capacity', 'reaction'].forEach((groupId) => {
    const option = findOption(groupId);
    if (option && typeof option.maxEquity === 'number' && option.maxEquity < equity) {
      equity = option.maxEquity;
      limitedBy = groupId;
    }
  });

  const tradingEstimate = computeTradingEstimate();
  const includeFundPackages = wantsFundPackages();

  // "Jag vill handla aktier/ETF:er men inte fonder" - då är frågan inte
  // "vilket fondpaket passar din risknivå", det är "vilket institut är
  // billigast för hur JAG tänker handla". Fondpaket/sparkonto-matchningen
  // är inte relevant som huvudsvar här, så hoppa över den och låt
  // courtage-jämförelsen vara huvudresultatet istället.
  if (tradingEstimate && !includeFundPackages) {
    const cheapest = tradingEstimate.results[0];
    return {
      source: 'trading',
      equity,
      limitedBy,
      institute: cheapest.institute,
      tradingEstimate,
    };
  }

  const match = findBestProduct(equity, includeFundPackages);
  if (match) {
    return {
      source: 'matched',
      equity: match.product.equityPercent,
      limitedBy,
      institute: match.institute,
      product: match.product,
      tradingEstimate,
    };
  }

  const funds = [];
  let allocated = 0;
  EXAMPLE_FUNDS.equity.forEach((fund, index) => {
    const isLast = index === EXAMPLE_FUNDS.equity.length - 1;
    const weight = isLast ? equity - allocated : Math.round(equity * fund.share);
    allocated += weight;
    funds.push({ ...fund, weight });
  });
  funds.push({ ...EXAMPLE_FUNDS.fixedIncome, weight: 100 - equity });

  const held = funds.filter((fund) => fund.weight > 0);
  const weighted = (key) => held.reduce((sum, fund) => sum + (fund.weight / 100) * fund[key], 0);

  return {
    source: 'example',
    equity,
    limitedBy,
    funds: held,
    annualFeePercent: weighted('annualFeePercent'),
    maxDrawdownPercent: weighted('maxDrawdownPercent'),
    tradingEstimate,
  };
}

// ---------- Screens ----------

function renderStart() {
  return el('section', { class: 'screen' },
    el('h1', { tabindex: '-1' }, 'Hitta en portfölj som passar dig'),
    el('p', { class: 'lead' }, 'Svara på frågorna om när du behöver pengarna, hur du tänker kring risk och vad du vill spara i, så visar vi ett förslag. Det tar några minuter.'),
    el('button', { type: 'button', class: 'button', onclick: () => goTo(0) }, 'Starta'),
    el('p', { class: 'small-print' }, 'Dina svar sparas inte och skickas ingenstans.'),
  );
}

// multiSelect groups are answered once at least one option is picked;
// single-select groups need exactly the one value they already track.
function isGroupAnswered(group) {
  const value = state.answers[group.id];
  return group.multiSelect ? Array.isArray(value) && value.length > 0 : value !== undefined;
}

function isAnswered(question) {
  return question.groups.every(isGroupAnswered);
}

function toggleMultiSelectValue(group, value) {
  const current = Array.isArray(state.answers[group.id]) ? state.answers[group.id] : [];
  const option = group.options.find((candidate) => candidate.value === value);
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (option.exclusive) return [value];
  return [...current.filter((v) => !group.options.find((o) => o.value === v)?.exclusive), value];
}

function renderQuestion(visible, index) {
  const question = visible[index];
  const hasMultiSelect = question.groups.some((group) => group.multiSelect);
  const autoAdvance = question.groups.length === 1 && !hasMultiSelect;
  const titleId = 'question-title';

  const nextButton = autoAdvance ? null : el('button', {
    type: 'button',
    class: 'button',
    onclick: () => goTo(index + 1),
  }, 'Nästa');

  const updateNext = () => {
    if (nextButton) nextButton.disabled = !isAnswered(question);
  };

  const groups = question.groups.map((group) => {
    const labelId = 'label-' + group.id;
    const buttons = group.options.map((option) => {
      const isSelected = () => (group.multiSelect
        ? (Array.isArray(state.answers[group.id]) && state.answers[group.id].includes(option.value))
        : state.answers[group.id] === option.value);

      const button = el('button', {
        type: 'button',
        class: 'option',
        'aria-pressed': String(isSelected()),
      }, option.label);

      button.addEventListener('click', () => {
        if (group.multiSelect) {
          const next = toggleMultiSelectValue(group, option.value);
          state.answers[group.id] = next;
          buttons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(next.includes(group.options[i].value))));
          updateNext();
          return;
        }

        state.answers[group.id] = option.value;
        if (autoAdvance) {
          goTo(index + 1);
          return;
        }
        buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        updateNext();
        // Answering the last part of a question moves on, so no extra tap is needed.
        const isLastGroup = group === question.groups[question.groups.length - 1];
        if (isLastGroup && isAnswered(question)) goTo(index + 1);
      });
      return button;
    });

    return el('div', {
      class: 'option-group',
      role: 'group',
      'aria-labelledby': group.label ? labelId : titleId,
    },
      group.label ? el('p', { class: 'group-label', id: labelId }, group.label) : null,
      el('div', { class: 'options' + (group.columns === 2 ? ' options-two' : '') }, ...buttons),
    );
  });

  updateNext();

  const progress = el('div', { class: 'progress-bar', 'aria-hidden': 'true' }, el('span', {}));
  progress.firstChild.style.width = ((index + 1) / visible.length) * 100 + '%';

  return el('section', { class: 'screen' },
    el('div', { class: 'question-top' },
      el('button', { type: 'button', class: 'back', onclick: () => goTo(index - 1) }, '‹ Tillbaka'),
      el('p', { class: 'progress-text' }, 'Fråga ' + (index + 1) + ' av ' + visible.length),
    ),
    progress,
    el('h1', { class: 'question-title', id: titleId, tabindex: '-1' }, question.title),
    ...groups,
    nextButton,
  );
}

// Horizontal timeline from today to the year the money is needed.
function renderTimeline(horizon) {
  const endYear = new Date().getFullYear() + horizon.years;
  const endLabel = horizon.orMore ? endYear + ' eller senare' : 'Senast ' + endYear;
  return el('div', { class: 'timeline', role: 'img', 'aria-label': 'Tidslinje: från idag till ' + endLabel.toLowerCase() },
    el('span', { class: 'timeline-label' }, 'Idag'),
    el('span', { class: 'timeline-line', 'aria-hidden': 'true' }),
    el('span', { class: 'timeline-label' }, endLabel),
  );
}

function renderExampleCard(result, bar) {
  const drawdownKronor = (Math.abs(result.maxDrawdownPercent) / 100) * DRAWDOWN_EXAMPLE_AMOUNT;

  const fundRows = result.funds.map((fund) => el('li', {},
    el('span', {}, fund.name),
    el('span', { class: 'fund-weight' }, formatPercent(fund.weight, 0)),
  ));

  return el('div', { class: 'card' },
    el('p', { class: 'split-text' },
      formatPercent(result.equity, 0) + ' aktiefonder, ' + formatPercent(100 - result.equity, 0) + ' räntefonder'),
    bar,
    el('ul', { class: 'fund-list' }, ...fundRows),
    el('dl', { class: 'spec-list' },
      el('div', { class: 'spec' },
        el('dt', {}, 'Total årlig avgift'),
        el('dd', {}, formatPercent(result.annualFeePercent, 2)),
      ),
      el('div', { class: 'spec' },
        el('dt', {}, 'Största historiska nedgång'),
        el('dd', {}, formatPercent(result.maxDrawdownPercent, 0)),
      ),
    ),
    el('p', { class: 'small-print' },
      'På ' + formatKronor(DRAWDOWN_EXAMPLE_AMOUNT) + ' motsvarar den nedgången ungefär ' + formatKronor(drawdownKronor) + '.'),
  );
}

// No historical drawdown figure here: that would need real return data we
// haven't sourced for Levler's products, so the spec is left out rather than
// shown next to a number that isn't real. Institutet är huvudsvaret här, så
// det leder kortet - aktieandelen är en detalj i slutet, inte huvudvisualen.
function renderProductCard(result, bar) {
  const product = result.product;
  const institute = result.institute;

  const exposureText = product.productType === 'savings'
    ? 'Exponering: ' + formatPercent(result.equity, 0) + ' aktiefonder, ' + formatPercent(100 - result.equity, 0) + ' sparkonto.'
    : 'Exponering: ' + formatPercent(result.equity, 0) + ' aktiefonder, ' + formatPercent(100 - result.equity, 0) + ' räntefonder.';

  const details = product.productType === 'savings'
    ? [
      el('h2', {}, institute.name),
      el('p', {}, product.name + ' - inget fondsparande vid den här risknivån, pengarna står på ett räntebärande sparkonto istället.'),
      el('dl', { class: 'spec-list' },
        el('div', { class: 'spec' },
          el('dt', {}, 'Ränta'),
          el('dd', {}, formatPercent(product.interestPercent, 2) + ' (' + product.interestType + ')'),
        ),
        el('div', { class: 'spec' },
          el('dt', {}, 'Kontoavgift'),
          el('dd', {}, formatKronor(product.feeKr)),
        ),
      ),
      el('p', { class: 'small-print' },
        'Täcks av insättningsgarantin upp till ' + formatKronor(product.depositInsuranceKr) + '.'),
    ]
    : [
      el('h2', {}, institute.name),
      el('p', {}, product.name + (product.composition ? ' - ' + (typeof product.composition === 'string' ? product.composition
        : product.composition.map((fund) => fund.name + ' (' + fund.weightPercent + '%)').join(', ')) : '')),
      el('dl', { class: 'spec-list' },
        el('div', { class: 'spec' },
          el('dt', {}, 'Årlig avgift efter rabatt'),
          el('dd', {}, formatAnnualFee(product.annualFeePercent)),
        ),
        el('div', { class: 'spec' },
          el('dt', {}, 'Courtage vid fondköp'),
          el('dd', {}, formatKronor(institute.trading.fundCourtageKr)),
        ),
      ),
    ];

  return el('div', { class: 'card' },
    ...details,
    el('p', { class: 'split-text' }, exposureText),
    bar,
    el('p', { class: 'small-print' },
      'Källa: ', el('a', { href: product.source || institute.source, target: '_blank', rel: 'noopener' }, institute.name)),
  );
}

// Ranked list of institutes by estimated yearly courtage + växling cost for
// the stock/ETF trading the user described. Only shown when relevant - see
// computeTradingEstimate().
function renderTradingEstimateCard(estimate) {
  const rows = estimate.results.map((result, index) => el('li', {},
    el('span', {}, result.institute.name
      + (index === 0 ? ' (billigast)' : '')
      + (!result.verified ? ' – ej primärkälls-verifierat' : '')),
    el('span', { class: 'fund-weight' }, formatKronor(result.costKr) + '/år'),
  ));

  return el('div', { class: 'card' },
    el('h2', {}, 'Uppskattad courtage-kostnad för din aktiehandel'),
    el('p', { class: 'small-print' },
      'Baserat på ' + estimate.tradesPerYear + ' affärer/år à ca ' + formatKronor(estimate.orderSizeKr)
      + ', varav ' + estimate.foreignSharePercent + ' % utländska aktier. Grov uppskattning på institutens'
      + ' lägsta kundnivå (Levler Standard, Montrose Access) - tar inte hänsyn till Levler Plus eller'
      + ' Avanzas avgiftsfria nivå under 50 000 kr totalt sparande.'),
    el('ul', { class: 'fund-list' }, ...rows),
  );
}

function renderResult() {
  const result = computeResult();
  const horizon = findOption('horizon');
  const isTrading = result.source === 'trading';
  const isMatched = result.source === 'matched';
  const lastQuestionIndex = visibleQuestions().length - 1;

  const bar = el('div', { class: 'split-bar', 'aria-hidden': 'true' }, el('span', {}));
  bar.firstChild.style.width = result.equity + '%';

  const restart = () => {
    state.answers = {};
    goTo(START);
  };

  // When the user wants to trade stocks/ETFs themselves rather than buy a
  // fund package, the courtage comparison IS the main answer, not a bonus
  // card under a fund/savings match that doesn't apply to them.
  const mainCard = isTrading ? renderTradingEstimateCard(result.tradingEstimate)
    : isMatched ? renderProductCard(result, bar)
    : renderExampleCard(result, bar);
  const extraTradingCard = (!isTrading && result.tradingEstimate) ? renderTradingEstimateCard(result.tradingEstimate) : null;

  return el('section', { class: 'screen' },
    el('button', { type: 'button', class: 'back', onclick: () => goTo(lastQuestionIndex) }, '‹ Tillbaka'),
    el('div', { class: 'result-head' },
      el('h1', { tabindex: '-1' }, 'Din portfölj'),
      el('span', { class: 'tag' }, (isTrading || isMatched) ? result.institute.name : 'Exempeldata'),
    ),
    el('p', { class: 'result-summary' }, 'Du behöver pengarna ' + horizon.label.toLowerCase()),
    renderTimeline(horizon),

    mainCard,
    extraTradingCard,

    el('h2', {}, 'Varför den här fördelningen'),
    el('p', {}, REASONS[result.limitedBy]),

    el('h2', {}, 'Nästa steg'),
    el('p', {}, PLATFORM_NOTES[state.answers.platform]),
    isTrading ? null : el('p', {}, NEXT_STEPS[state.answers.effort]),

    el('div', { class: 'result-actions' },
      el('button', { type: 'button', class: 'button button-secondary', onclick: restart }, 'Gör om'),
      el('a', { href: '../index.html' }, 'Till startsidan'),
    ),

    el('p', { class: 'small-print' }, isTrading
      ? 'Courtage-uppskattningen baseras på institutens egna prislistor/tredjepartsjämförelser. Resultatet är inte personlig rådgivning.'
      : isMatched
        ? 'Produkt och avgifter är hämtade direkt från institutets egna sidor/app. Resultatet är inte personlig rådgivning.'
        : 'Det här är en prototyp med exempeldata. Resultatet är inte personlig rådgivning.'),
  );
}

// ---------- Navigation ----------

function render(moveFocus) {
  const visible = visibleQuestions();
  let screen;
  if (state.step === START) screen = renderStart();
  else if (state.step >= visible.length) {
    state.step = RESULT;
    screen = renderResult();
  } else {
    screen = renderQuestion(visible, state.step);
  }

  app.replaceChildren(screen);

  if (moveFocus) {
    window.scrollTo(0, 0);
    screen.querySelector('h1').focus();
  }
}

function goTo(step) {
  const visible = visibleQuestions();
  state.step = Math.max(START, Math.min(visible.length, step));
  render(true);
}

render(false);
