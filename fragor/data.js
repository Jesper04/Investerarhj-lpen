// ============================================================================
// Questions, rules and fund data for the questionnaire.
// Change the questions and the matching rules here; script.js only renders them.
// ============================================================================

// Each question has one or more answer groups. A question with a single group
// moves on as soon as an option is chosen; with several groups it shows "Nästa".
// `maxEquity` is the highest share of equity funds (%) that answer allows.
// The result uses the lowest `maxEquity` among all answers.
// `years` is the latest the money is needed, used for the timeline on the result screen.
const QUESTIONS = [
  {
    title: 'När behöver du pengarna?',
    groups: [
      {
        id: 'horizon',
        options: [
          { value: '0-2', label: 'Inom 2 år', maxEquity: 0, years: 2 },
          { value: '2-5', label: '2–5 år', maxEquity: 40, years: 5 },
          { value: '5-10', label: '5–10 år', maxEquity: 70, years: 10 },
          { value: '10+', label: 'Om mer än 10 år', maxEquity: 100, years: 10, orMore: true },
        ],
      },
    ],
  },
  {
    title: 'Tänk dig att 100 000 kr av ditt sparande blir 70 000 kr på ett år. Vad gör du?',
    groups: [
      {
        id: 'reaction',
        options: [
          { value: 'sell-all', label: 'Säljer allt', maxEquity: 20 },
          { value: 'sell-some', label: 'Säljer en del', maxEquity: 40 },
          { value: 'wait', label: 'Väntar och låter pengarna stå', maxEquity: 80 },
          { value: 'buy', label: 'Köper mer', maxEquity: 100 },
        ],
      },
    ],
  },
  {
    title: 'Vad händer om pengarna är värda mindre den dag du behöver dem?',
    groups: [
      {
        id: 'capacity',
        options: [
          { value: 'none', label: 'Då går min plan inte ihop', maxEquity: 20 },
          { value: 'some', label: 'Jag kan vänta ett par år', maxEquity: 70 },
          { value: 'high', label: 'Det klarar jag utan problem', maxEquity: 100 },
        ],
      },
    ],
  },
  {
    title: 'Vill du ha allt ditt kapital på ett ställe, eller kan du använda flera plattformar?',
    groups: [
      {
        id: 'platform',
        options: [
          { value: 'one', label: 'Allt på en bank eller plattform' },
          { value: 'several', label: 'Jag kan använda flera' },
        ],
      },
    ],
  },
  {
    title: 'Hur mycket vill du sköta själv?',
    groups: [
      {
        id: 'effort',
        options: [
          { value: 'self', label: 'Jag köper och sköter fonderna själv' },
          { value: 'hands-off', label: 'Så lite som möjligt' },
        ],
      },
    ],
  },
];

// Shown under "Varför den här fördelningen", keyed by the answer group that set
// the limit. `none` is used when nothing limits the share of equity funds.
const REASONS = {
  horizon: 'Tiden tills du behöver pengarna sätter gränsen. Med kort tid hinner aktiefonder inte alltid återhämta sig efter ett fall, så en större del ligger i räntefonder.',
  capacity: 'Du har svarat att pengarna behöver finnas där när du ska använda dem. Därför är andelen aktiefonder lägre än vad tiden ensam hade tillåtit.',
  reaction: 'Du har svarat att du skulle sälja vid ett stort fall. En lugnare fördelning gör det lättare att hålla fast vid planen.',
  none: 'Du har lång tid på dig och tål att värdet svänger. Då kan hela sparandet ligga i aktiefonder, som historiskt har gett mest över tid.',
};

// Shown under "Nästa steg", keyed by the answer to the last question.
const NEXT_STEPS = {
  self: 'Köp fonderna hos din egen bank eller plattform och lägg upp ett månadssparande med samma fördelning. Se över fördelningen en gång om året.',
  'hands-off': 'Vill du slippa sköta det själv kan en fondrobot eller en färdig blandfond med ungefär samma fördelning göra jobbet åt dig. Det kostar lite mer, men kräver nästan ingenting av dig.',
};

// Shown under "Nästa steg", keyed by the answer to the platform question.
const PLATFORM_NOTES = {
  one: 'Du vill ha allt på ett ställe, så vi väljer fonder som du kan få hos en och samma bank eller plattform. Det blir enklare att hålla koll på, men kan kosta något mer än att välja de billigaste fonderna var för sig.',
  several: 'Du kan använda flera plattformar, så vi kan välja den billigaste fonden för varje del av portföljen, även om de finns hos olika aktörer. Det kan ge lägre avgifter, men du får fler ställen att hålla ordning på.',
};

// ============================================================================
// EXAMPLE DATA – replace with real fund data later.
// Fund names, fees and drawdowns below are made up.
// ============================================================================
const EXAMPLE_FUNDS = {
  // Share of the equity part that goes to each equity fund (must add up to 1).
  equity: [
    { name: 'Global indexfond', share: 0.8, annualFeePercent: 0.2, maxDrawdownPercent: -50 },
    { name: 'Svensk indexfond', share: 0.2, annualFeePercent: 0.15, maxDrawdownPercent: -55 },
  ],
  // Everything that is not equity goes here.
  fixedIncome: { name: 'Kort räntefond', annualFeePercent: 0.15, maxDrawdownPercent: -3 },
};

// Amount used to show the largest historical drawdown in kronor.
const DRAWDOWN_EXAMPLE_AMOUNT = 100000;
// ============================== END EXAMPLE DATA =============================
