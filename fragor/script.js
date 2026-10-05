// Questionnaire flow. Questions, rules and fund data live in data.js.
// Answers are kept in memory only: nothing is stored or sent anywhere.

const NBSP = ' ';
const MINUS = '−';
const START = -1;
const RESULT = QUESTIONS.length;

const app = document.getElementById('app');
const state = { step: START, answers: {} };

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
    equity,
    limitedBy,
    funds: held,
    annualFeePercent: weighted('annualFeePercent'),
    maxDrawdownPercent: weighted('maxDrawdownPercent'),
  };
}

// ---------- Screens ----------

function renderStart() {
  return el('section', { class: 'screen' },
    el('h1', { tabindex: '-1' }, 'Hitta en portfölj som passar dig'),
    el('p', { class: 'lead' }, 'Svara på ' + QUESTIONS.length + ' frågor om när du behöver pengarna och hur du tänker kring risk, så visar vi en fondportfölj som passar. Det tar ungefär 1 minut.'),
    el('button', { type: 'button', class: 'button', onclick: () => goTo(0) }, 'Starta'),
    el('p', { class: 'small-print' }, 'Dina svar sparas inte och skickas ingenstans.'),
  );
}

function isAnswered(question) {
  return question.groups.every((group) => state.answers[group.id] !== undefined);
}

function renderQuestion(index) {
  const question = QUESTIONS[index];
  const autoAdvance = question.groups.length === 1;
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
      const button = el('button', {
        type: 'button',
        class: 'option',
        'aria-pressed': String(state.answers[group.id] === option.value),
      }, option.label);

      button.addEventListener('click', () => {
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
  progress.firstChild.style.width = ((index + 1) / QUESTIONS.length) * 100 + '%';

  return el('section', { class: 'screen' },
    el('div', { class: 'question-top' },
      el('button', { type: 'button', class: 'back', onclick: () => goTo(index - 1) }, '‹ Tillbaka'),
      el('p', { class: 'progress-text' }, 'Fråga ' + (index + 1) + ' av ' + QUESTIONS.length),
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

function renderResult() {
  const result = computeResult();
  const horizon = findOption('horizon');
  const drawdownKronor = (Math.abs(result.maxDrawdownPercent) / 100) * DRAWDOWN_EXAMPLE_AMOUNT;

  const bar = el('div', { class: 'split-bar', 'aria-hidden': 'true' }, el('span', {}));
  bar.firstChild.style.width = result.equity + '%';

  const fundRows = result.funds.map((fund) => el('li', {},
    el('span', {}, fund.name),
    el('span', { class: 'fund-weight' }, formatPercent(fund.weight, 0)),
  ));

  const restart = () => {
    state.answers = {};
    goTo(START);
  };

  return el('section', { class: 'screen' },
    el('button', { type: 'button', class: 'back', onclick: () => goTo(RESULT - 1) }, '‹ Tillbaka'),
    el('div', { class: 'result-head' },
      el('h1', { tabindex: '-1' }, 'Din portfölj'),
      el('span', { class: 'tag' }, 'Exempeldata'),
    ),
    el('p', { class: 'result-summary' }, 'Du behöver pengarna ' + horizon.label.toLowerCase()),
    renderTimeline(horizon),

    el('div', { class: 'card' },
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
    ),

    el('h2', {}, 'Varför den här fördelningen'),
    el('p', {}, REASONS[result.limitedBy]),

    el('h2', {}, 'Nästa steg'),
    el('p', {}, PLATFORM_NOTES[state.answers.platform]),
    el('p', {}, NEXT_STEPS[state.answers.effort]),

    el('div', { class: 'result-actions' },
      el('button', { type: 'button', class: 'button button-secondary', onclick: restart }, 'Gör om'),
      el('a', { href: '../index.html' }, 'Till startsidan'),
    ),

    el('p', { class: 'small-print' }, 'Det här är en prototyp med exempeldata. Resultatet är inte personlig rådgivning.'),
  );
}

// ---------- Navigation ----------

function render(moveFocus) {
  let screen;
  if (state.step === START) screen = renderStart();
  else if (state.step === RESULT) screen = renderResult();
  else screen = renderQuestion(state.step);

  app.replaceChildren(screen);

  if (moveFocus) {
    window.scrollTo(0, 0);
    screen.querySelector('h1').focus();
  }
}

function goTo(step) {
  state.step = Math.max(START, Math.min(RESULT, step));
  render(true);
}

render(false);
