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
  {
    title: 'Vad vill du spara i?',
    groups: [
      {
        id: 'instruments',
        multiSelect: true,
        columns: 2,
        options: [
          { value: 'sparkonto', label: 'Sparkonto' },
          { value: 'fonder', label: 'Fonder' },
          { value: 'etf', label: 'ETF:er' },
          { value: 'aktier', label: 'Enskilda aktier' },
          { value: 'rantefonder', label: 'Räntefonder' },
          { value: 'vet-inte', label: 'Vet inte', exclusive: true },
        ],
      },
    ],
  },
  // De tre frågorna nedan visas bara om "ETF:er" eller "Enskilda aktier" är
  // ikryssat ovan - det är den enda kombinationen av svar där courtage och
  // växlingsavgift faktiskt spelar roll för resultatet.
  {
    title: 'Hur ofta handlar du?',
    showIf: (answers) => (answers.instruments || []).some((v) => v === 'aktier' || v === 'etf'),
    groups: [
      {
        id: 'tradeFrequency',
        options: [
          { value: 'few', label: 'Några gånger per år', tradesPerYear: 4 },
          { value: 'monthly', label: 'Varje månad', tradesPerYear: 12 },
          { value: 'weekly', label: 'Varje vecka eller oftare', tradesPerYear: 52 },
        ],
      },
    ],
  },
  {
    title: 'Ungefär hur stora är dina köp?',
    showIf: (answers) => (answers.instruments || []).some((v) => v === 'aktier' || v === 'etf'),
    groups: [
      {
        id: 'orderSize',
        // orderSizeKr är mittpunkten i intervallet, använd i beräkningen.
        options: [
          { value: 'small', label: 'Under 5 000 kr', orderSizeKr: 2500 },
          { value: 'medium', label: '5 000–20 000 kr', orderSizeKr: 12500 },
          { value: 'large', label: '20 000–100 000 kr', orderSizeKr: 60000 },
          { value: 'xlarge', label: 'Över 100 000 kr', orderSizeKr: 150000 },
        ],
      },
    ],
  },
  {
    title: 'Hur stor del vill du ha i utländska aktier?',
    showIf: (answers) => (answers.instruments || []).some((v) => v === 'aktier' || v === 'etf'),
    groups: [
      {
        id: 'foreignShare',
        options: [
          { value: 'none', label: 'Ingen', foreignSharePercent: 0 },
          { value: 'some', label: 'Lite', foreignSharePercent: 25 },
          { value: 'half', label: 'Ungefär hälften', foreignSharePercent: 50 },
          { value: 'most', label: 'Mest', foreignSharePercent: 75 },
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

// ============================================================================
// INSTITUTES – real data sourced from each institute's public pages.
// This is the mapping the calculator filters/sorts against: given an
// answer's `maxEquity`, pick the product (savingsAccount or a fundPackage -
// both carry `equityPercent`/`annualFeePercent` so they sort the same way)
// with the highest equityPercent that is still <= maxEquity.
// Each entry carries its own `source` URL and `verified` flag so stale or
// unconfirmed numbers are easy to find before they're relied on.
// ============================================================================
const INSTITUTES = {
  levler: {
    id: 'levler',
    name: 'Levler',
    url: 'https://levler.se/',
    verifiedAt: '2026-10-25',

    // Fält som matchar fundPackages (id, equityPercent, annualFeePercent, osv.)
    // så sparkontot kan sorteras in bland fondpaketen som ett eget alternativ
    // i stället för att bara vara ett separat textfält. 0% aktieandel gör att
    // det blir det naturliga valet för de mest konservativa svaren
    // (maxEquity 0-40), tills Försiktig-paketets equityPercent är bekräftat.
    savingsAccount: {
      id: 'sparkonto',
      name: 'Sparkonto',
      productType: 'savings',
      equityPercent: 0,
      fixedIncomePercent: 100,
      annualFeePercent: 0,
      interestPercent: 2.05,
      interestType: 'rörlig',
      feeKr: 0,
      depositInsuranceKr: 1150000,
      verified: true,
      source: 'https://levler.se/sparkonto/',
    },

    // Fondcourtage är samma oavsett plan. Aktiecourtage gäller Standard-planen
    // och har fyra courtageklasser (väljs per konto, kan bytas när som helst)
    // - samma modell som Montrose, vilket gör dem direkt jämförbara. Källa:
    // Levlers egen prislista, bekräftad direkt (inte tredjepart).
    trading: {
      fundCourtageKr: 0,
      stockCourtageClasses: {
        mini: { maxOrderKr: 16111, minCourtageKr: 1, courtagePercent: 0.18 },
        small: { minOrderKr: 16111, maxOrderKr: 47272, minCourtageKr: 29, courtagePercent: 0.11 },
        medium: { minOrderKr: 47272, maxOrderKr: 148000, minCourtageKr: 52, courtagePercent: 0.05 },
        fastPris: { minOrderKr: 148000, fixedCourtageKr: 74 },
      },
      fxFeePercent: 0.19,
      ownEtfs: {
        commissionFree: true,
        commissionFreeUntil: '2026-12-31',
        countNote: 'Källor är oense om antalet (13 enligt en tredjepartsjämförelse, 15 enligt en annan sökträff) - inte bekräftat direkt på levler.se.',
      },
      verified: true,
      source: 'https://levler.se/om-oss/prislista/',
    },

    // De två kontoplanerna: Standard (courtage per affär/klass ovan, ingen
    // depåavgift) och Plus (courtagefri aktie-/ETF-/ETP-/kryptohandel, men
    // årlig depåavgift). Fondrabatten på 25% gäller oavsett plan.
    plans: {
      standard: {
        depotFeePercent: 0,
        stockTradingFree: false,
        verified: true,
        source: 'https://levler.se/om-oss/prislista/',
      },
      plus: {
        depotFeePercent: 0.35,
        stockTradingFree: true,
        note: 'Courtagefritt gäller aktier, ETF:er, ETP:er och krypto. Fondrabatten (25%) är densamma som på Standard.',
        verified: true,
        source: 'https://levler.se/om-oss/prislista/',
      },
    },

    // Vilken plan som faktiskt passar kunden, utifrån vad planerna kostar.
    // Fondcourtaget är 0 kr på BÅDA planerna, så Plus ger ingen fördel alls
    // för en kund som bara sparar i fonder - depåavgiften är då en ren
    // extrakostnad. Plus blir bara värt det om kunden handlar enskilda aktier
    // så mycket att den sparade courtage-kostnaden överstiger depåavgiften,
    // dvs. ungefär när årlig aktiehandelsvolym > (0,35 / 0,18) ≈ 1,9 gånger
    // portföljvärdet. Appen frågar idag inte om aktiehandel, så Standard är
    // rätt rekommendation för alla befintliga frågor/svar i QUESTIONS.
    planRecommendation: {
      default: 'standard',
      reason: 'Fondcourtage är 0 kr oavsett plan, så Plus-avgiften (0,35%/år) saknar motprestation för en ren fondsparare.',
      switchToPlusWhen: 'Kunden handlar enskilda aktier aktivt och den uppskattade årliga handelsvolymen överstiger ca 1,9x portföljvärdet.',
      verified: true,
      source: 'Beräknat från trading.fundCourtageKr och plans ovan, kräver ingen extern källa.',
    },

    // Rabatt på förvaltningsavgiften, gäller alla 2000+ fonder på plattformen.
    fundFeeDiscountPercent: 25,

    // Jämförbart med Montroses `features` - Levler saknar värdepapperskredit
    // och valutakonto.
    features: {
      marginLending: false,
      currencyAccount: false,
      verified: true,
      source: 'https://levler.se/om-oss/prislista/',
    },

    // Ordnade i stigande riskordning (Levlers egen namngivning), inte strikt
    // efter equityPercent eftersom Försiktig/Lagom inte är bekräftade än.
    // `annualFeePercent` är vad kunden betalar per år EFTER 25%-rabatten.
    fundPackages: [
      {
        id: 'forsiktig',
        name: 'Försiktig',
        productType: 'fondpaket',
        equityPercent: null,
        fixedIncomePercent: null,
        annualFeePercent: 0.77,
        minMonthlyKr: 700,
        horizonLabel: 'Kort sikt',
        verified: false,
        note: 'Motstridiga källor för aktieandel (50/50 enligt en jämförelsesajt, 30/50 enligt en delvis läsning av Levlers egen artikel), och minMonthlyKr är osäkert av samma skäl - samma webbkälla gav fel minibelopp för Lagom (700 kr istället för verifierat 500 kr). Verifiera mot fondpaketets sida i appen, samma sätt Lagom bekräftades.',
      },
      {
        id: 'lagom',
        name: 'Lagom',
        productType: 'fondpaket',
        equityPercent: 70,
        fixedIncomePercent: 30,
        managementFeePercent: 0.84,
        feeAfterDiscountPercent: 0.63,
        otherFeesPercent: 0.18,
        annualFeePercent: 0.81,
        minMonthlyKr: 500,
        horizonLabel: 'Medellång sikt',
        rebalance: 'Innehaven ses över kvartalsvis. Vid uppdatering får kunden ett mejl och måste aktivt välja de nya innehaven, annars ligger sparandet kvar i de tidigare fonderna.',
        composition: [
          { name: 'Carnegie Sverigefond A', weightPercent: 20, annualFeePercent: 1.05 },
          { name: 'DNB Teknologi S', weightPercent: 20, annualFeePercent: 0.90 },
          { name: 'Acadian Global Equity UCITS A EUR', weightPercent: 30, annualFeePercent: 0.57 },
          { name: 'Swedbank Robur Obligation B', weightPercent: 30, annualFeePercent: 0.23 },
        ],
        verified: true,
        verifiedAt: '2026-10-25',
        source: 'Levler-appen (inloggad), fondpaketets detaljsida.',
      },
      {
        id: 'offensiv-index',
        name: 'Offensiv Index',
        productType: 'fondpaket',
        equityPercent: 100,
        fixedIncomePercent: 0,
        annualFeePercent: { min: 0.07, max: 0.15 },
        minMonthlyKr: 700,
        horizonLabel: 'Lång sikt',
        verified: true,
        composition: 'Fem indexfonder: tillväxtmarknader, Sverige, global, USA, Europa',
        note: 'equityPercent och avgiftsintervallet är tillförlitliga, men minMonthlyKr är INTE bekräftat i appen (samma källa gav fel minibelopp för Lagom, 700 istället för verifierat 500). Kolla i appen innan minMonthlyKr används.',
        source: 'https://isk-guiden.se/maklare/levler/',
      },
      {
        id: 'offensiv-aktiv',
        name: 'Offensiv Aktiv',
        productType: 'fondpaket',
        equityPercent: 100,
        fixedIncomePercent: 0,
        annualFeePercent: { min: 0.45, max: 0.65 },
        minMonthlyKr: 500,
        horizonLabel: 'Lång sikt',
        verified: true,
        composition: 'Fem aktivt förvaltade fonder',
        note: 'Samma status som Offensiv Index: equityPercent/avgift tillförlitliga, minMonthlyKr inte bekräftat i appen.',
        source: 'https://isk-guiden.se/maklare/levler/',
      },
    ],

    source: 'https://levler.se/lar-dig-mer/levler/levlers-uppdaterade-fondpaket/',
  },

  montrose: {
    id: 'montrose',
    name: 'Montrose',
    url: 'https://www.montrose.io/',
    verifiedAt: '2026-10-25',
    // robots.txt gick inte att läsa av (tomt svar, inte en explicit "Allow: /"
    // som Levler) - okänt om det beror på att filen saknas eller blockerar.
    // Allmänna sidor (prislista, sparkonto) är publika marknadssidor, så
    // samma resonemang som för Levler gäller ändå.

    savingsAccount: {
      id: 'sparkonto',
      name: 'Sparkonto',
      productType: 'savings',
      equityPercent: 0,
      fixedIncomePercent: 100,
      annualFeePercent: 0,
      interestPercent: 1.35,
      interestType: 'rörlig',
      feeKr: 0,
      depositInsuranceKr: 1150000,
      custodian: 'DNB Carnegie',
      verified: true,
      source: 'https://www.montrose.io/sparkonto',
    },

    // Officiell prislista (PDF), gäller från 2026-06-22. Tre förmånsnivåer
    // (Access/Premium/Platinum) sänker courtage och växlingsavgift med mer
    // kapital. Minsta courtage varierar per marknad (1/19/39/99 SEK), max
    // courtage 99 SEK gäller bara Sverige/Danmark/Finland/Norge.
    trading: {
      tiers: {
        access: { stockCourtagePercent: 0.15, fxFeePercent: 0.12 },
        premium: { stockCourtagePercent: 0.10, fxFeePercent: 0.10 },
        platinum: { stockCourtagePercent: 0.05, fxFeePercent: 0.05 },
      },
      stockCourtageMinKrByMarket: {
        'Sverige/Danmark/Finland/Norge/USA': 1,
        'UK/Tyskland/Frankrike/Schweiz': 19,
        'Kanada/Spanien/Nederländerna/Portugal/Belgien/Italien/Irland/Österrike': 39,
        Polen: 99,
      },
      stockCourtageMaxKr: 99,
      fundCourtageKr: 0,
      verified: true,
      verifiedAt: '2026-06-22',
      source: 'https://cdn.prod.website-files.com/665d843245a09dc69c336e03/6a3918e2c7ceaf29c1ce7f29_Montrose%20prislista%20-%2020260622.pdf',
    },

    // Ingen rabattmodell som Levlers 25% - istället återbetalas HELA
    // fondprovisionen till kunden som återbäring, krediterad kvartalsvis med
    // ett kvartals eftersläpning.
    funds: {
      platformFeePercent: 0.10,
      platformFeePercentLowFeeFunds: 0.05, // fonder med förvaltningsavgift <= 0,2%
      platformFeePercentMontroseGlobal: 0,
      fxFeePercent: 0.30, // tillfälligt högre än aktiehandel t.o.m. H2 2026
      kickbackPolicy: 'Hela fondprovisionen återbetalas till kunden, krediterad kvartalsvis med ett kvartals eftersläpning.',
      verified: true,
      verifiedAt: '2026-06-22',
      source: 'https://cdn.prod.website-files.com/665d843245a09dc69c336e03/6a3918e2c7ceaf29c1ce7f29_Montrose%20prislista%20-%2020260622.pdf',
    },

    // Produkter Levler saknar helt. Inte en del av matchningslogiken (ingen
    // equityPercent/avgift att sortera på), men relevant för en investerare
    // som vill belåna innehav eller handla i flera valutor. Kreditgivare är
    // DNB Carnegie Investment Bank AB.
    features: {
      marginLending: true,
      currencyAccount: true,
      kfWithDirectWithholdingTaxRefund: true,
      verified: true,
      verifiedAt: '2026-06-22',
      source: 'https://cdn.prod.website-files.com/665d843245a09dc69c336e03/6a3918e2c7ceaf29c1ce7f29_Montrose%20prislista%20-%2020260622.pdf',
    },

    // Montrose har INGA färdiga riskbaserade fondpaket (ingen robo-advisor) -
    // du sätter ihop portföljen själv av aktier/fonder/ETF:er. Tom lista här
    // (snarare än gissade paket) så matchningslogiken inte hittar på ett
    // paket som inte finns. Sparkontot (0% aktier) är därför den enda
    // produkten Montrose kan bidra med i den nuvarande matchningen.
    fundPackages: [],
    noPackagesNote: 'Bekräftat frånvaro av portföljprodukt via isk-guiden.se/maklare/montrose/ och montrose.io - plattformen är gjord för att kunden själv väljer innehav.',

    source: 'https://isk-guiden.se/maklare/montrose/',
  },

  avanza: {
    id: 'avanza',
    name: 'Avanza',
    url: 'https://www.avanza.se/',
    verifiedAt: '2026-10-25',
    // robots.txt: "User-agent: *" + två sitemaps, inga Disallow-rader -
    // samma öppna läge som Levler/Montrose.

    // Tredjepartskällor oense (1,30% / 1,49-1,50% / 1,75% förekommer
    // beroende på hur gammal sidan som indexerats är - räntan har sjunkit
    // kraftigt under året). 1,30% är det flest oberoende, nyligen daterade
    // sökträffar pekar mot, men avanza.se/sparkonto.html är JS-renderad och
    // gick inte att läsa av direkt, så det här är INTE primärkälls-verifierat
    // på samma sätt som Levler/Montrose sparkonto.
    savingsAccount: {
      id: 'sparkonto',
      name: 'Sparkonto',
      productType: 'savings',
      equityPercent: 0,
      fixedIncomePercent: 100,
      annualFeePercent: 0,
      interestPercent: 1.30,
      interestType: 'rörlig',
      feeKr: 0,
      depositInsuranceKr: 1150000,
      verified: false,
      note: 'Räntan rör sig mycket just nu och kunde inte läsas av direkt på avanza.se - dubbelkolla innan den används i en jämförelse.',
      source: 'https://omprivatekonomi.se/artiklar/avanza-sparkonto-ranta-fullstandig-guide-for-2026',
    },

    // Courtageklasser kryssverifierade via två oberoende sökningar (samma
    // siffror i båda), men INTE hämtat direkt från en primärkälla -
    // avanza.se:s prissidor är JS-renderade och gick inte att läsa av.
    // "Start" är courtagefritt så länge totalt sparande hos Avanza är under
    // 50 000 kr.
    trading: {
      fundCourtageKr: 0,
      stockCourtageClasses: {
        start: { capitalLimitKr: 50000, courtagePercent: 0, courtageKr: 0 },
        mini: { maxOrderKr: 15600, minCourtageKr: 1, courtagePercent: 0.25 },
        small: { minOrderKr: 15600, maxOrderKr: 46000, minCourtageKr: 39, courtagePercent: 0.15 },
        medium: { minOrderKr: 46000, maxOrderKr: 143500, minCourtageKr: 69, courtagePercent: 0.069 },
        fastPris: { minOrderKr: 143500, fixedCourtageKr: 99 },
      },
      // Flat 0,25% per växlingstillfälle oavsett courtageklass (lägre, 0,125%,
      // finns bara för Private Banking/Pro-kunder med valutakonto - inte den
      // nivå som jämförs här).
      fxFeePercent: 0.25,
      verified: false,
      note: 'Inte hämtat direkt från avanza.se (JS-renderad sida) - kryssverifierat via två oberoende sökträffar med samma siffror, men dubbelkolla före användning.',
      source: 'https://www.avanza.se/konton-lan-prislista/prislista/handel-sverige.html',
    },

    // Avanza Auto 1-6: robo-advisor-liknande fond-i-fond-familj med stigande
    // risk. KÄLLA: Avanza Fonders egen informationsbroschyr (officiellt
    // faktablad, PDF, daterad 2026-04-28) - primärkälla, högst tillförlitliga
    // datan i hela filen. `equityPercentRange` är det normala intervallet;
    // `equityPercent` är Avanzas egen "normal exponering"-siffra som används
    // för matchning. Auto 6 kan nå upp till 120% aktieexponering via hävstång
    // (indexterminer) - equityPercent 114 gör att den aldrig matchar något
    // maxEquity-värde (max 100 i QUESTIONS), vilket är korrekt: en hävstångsfond
    // ska inte rekommenderas bara för att någon svarat "mest aggressivt".
    // Samtliga Auto 1-6 har samma avgift: 0,35% gällande / 0,49% högsta
    // (max enligt fondbestämmelserna, tas nästan aldrig ut i praktiken).
    fundPackages: [
      {
        id: 'auto-1', name: 'Avanza Auto 1', productType: 'fondpaket',
        equityPercent: 20, equityPercentRange: { min: 10, max: 40 }, fixedIncomePercent: 80,
        annualFeePercent: 0.35, annualFeePercentMax: 0.49,
        composition: 'Fond-i-fond, regelstyrd mix av aktie- och räntefonder, aktieexponering 10-40% (normalt 20%)',
        verified: true,
        source: 'https://investors.avanza.se/files/Avanza_fonder/Informationsbroschyr/informationsbroschyr_avanza_auto_6_2026_04_28.pdf',
      },
      {
        id: 'auto-2', name: 'Avanza Auto 2', productType: 'fondpaket',
        equityPercent: 40, equityPercentRange: { min: 25, max: 55 }, fixedIncomePercent: 60,
        annualFeePercent: 0.35, annualFeePercentMax: 0.49,
        composition: 'Fond-i-fond, regelstyrd mix av aktie- och räntefonder, aktieexponering 25-55% (normalt 40%)',
        verified: true,
        source: 'https://investors.avanza.se/files/Avanza_fonder/Informationsbroschyr/informationsbroschyr_avanza_auto_6_2026_04_28.pdf',
      },
      {
        id: 'auto-3', name: 'Avanza Auto 3', productType: 'fondpaket',
        equityPercent: 60, equityPercentRange: { min: 40, max: 70 }, fixedIncomePercent: 40,
        annualFeePercent: 0.35, annualFeePercentMax: 0.49,
        composition: 'Fond-i-fond, regelstyrd mix av aktie- och räntefonder, aktieexponering 40-70% (normalt 60%)',
        verified: true,
        source: 'https://investors.avanza.se/files/Avanza_fonder/Informationsbroschyr/informationsbroschyr_avanza_auto_6_2026_04_28.pdf',
      },
      {
        id: 'auto-4', name: 'Avanza Auto 4', productType: 'fondpaket',
        equityPercent: 80, equityPercentRange: { min: 55, max: 85 }, fixedIncomePercent: 20,
        annualFeePercent: 0.35, annualFeePercentMax: 0.49,
        composition: 'Fond-i-fond, regelstyrd mix av aktie- och räntefonder, aktieexponering 55-85% (normalt 80%)',
        verified: true,
        source: 'https://investors.avanza.se/files/Avanza_fonder/Informationsbroschyr/informationsbroschyr_avanza_auto_6_2026_04_28.pdf',
      },
      {
        id: 'auto-5', name: 'Avanza Auto 5', productType: 'fondpaket',
        equityPercent: 100, equityPercentRange: { min: 70, max: 100 }, fixedIncomePercent: 0,
        annualFeePercent: 0.35, annualFeePercentMax: 0.49,
        composition: 'Fond-i-fond, regelstyrd mix av aktiefonder, aktieexponering 70-100% (normalt 100%)',
        verified: true,
        source: 'https://investors.avanza.se/files/Avanza_fonder/Informationsbroschyr/informationsbroschyr_avanza_auto_6_2026_04_28.pdf',
      },
      {
        id: 'auto-6', name: 'Avanza Auto 6', productType: 'fondpaket',
        equityPercent: 114, equityPercentRange: { min: 85, max: 120 }, fixedIncomePercent: 0,
        leveraged: true,
        annualFeePercent: 0.35, annualFeePercentMax: 0.49,
        composition: 'Fond-i-fond med hävstång via indexterminer, aktieexponering 85-120% (normalt ca 114%)',
        verified: true,
        note: 'Hävstångsfond (indexterminer), ca 114% exponering, max 120%. Matchar aldrig maxEquity i QUESTIONS (som toppar på 100) - avsiktligt, inte en bugg.',
        source: 'https://investors.avanza.se/files/Avanza_fonder/Informationsbroschyr/informationsbroschyr_avanza_auto_6_2026_04_28.pdf',
      },
    ],

    features: {
      marginLending: true,
      currencyAccount: false,
      verified: false,
      note: 'Avanza har värdepapperskrediter (belåning), men exakta villkor är inte kontrollerade här - ej jämfört mot Montroses räntetrappa.',
      source: 'https://isk-guiden.se/maklare/avanza/',
    },

    source: 'https://isk-guiden.se/maklare/avanza/',
  },

  nordnet: {
    id: 'nordnet',
    name: 'Nordnet',
    url: 'https://www.nordnet.se/',
    verifiedAt: '2026-10-25',
    // robots.txt skiljer sig från de andra tre: "Disallow: /courtageklasser" -
    // den sida som faktiskt listar courtage-trappan är uttryckligen stängd
    // för crawlers (till skillnad från Levler/Montrose/Avanza, där
    // motsvarande sida var öppen). Jag har INTE hämtat den sidan - siffrorna
    // i `trading` nedan kommer enbart från tredjepartsjämförelser.
    // Övriga sidor (t.ex. /fonder/nordnet-one, /blogg/...) är inte på
    // disallow-listan och är hämtade direkt.

    // Räntan är ovanligt rörig i källorna: Nordnets egen blogg bekräftar
    // 3,60% men det inlägget är daterat 2023-09-25 - inaktuellt.
    // Tredjepartskällor från 2026 ger "upp till 2,35%" (mars) respektive en
    // sänkning till 1,35% (april-rapporter). Ingen primärkälla för läget
    // idag (2026-10-25) hittades. Insättningsgarantin: tredjepartskällor
    // säger 1 050 000 kr för Nordnet, vilket motsäger Levler/Montroses
    // primärkälls-bekräftade 1 150 000 kr för SAMMA lagstadgade garanti -
    // troligen en förlegad siffra i Nordnet-källorna (beloppet har höjts),
    // så 1 150 000 används här istället för att inte sprida en föråldrad siffra.
    savingsAccount: {
      id: 'sparkonto',
      name: 'Sparkonto',
      productType: 'savings',
      equityPercent: 0,
      fixedIncomePercent: 100,
      annualFeePercent: 0,
      interestPercent: 1.35,
      interestType: 'rörlig',
      feeKr: 0,
      depositInsuranceKr: 1150000,
      verified: false,
      note: 'Räntan har spretat mellan 3,60% (2023, inaktuell) och 1,35-2,35% (olika 2026-källor) - inte primärkälls-verifierad för dagens datum. Dubbelkolla innan användning.',
      source: 'https://www.nordnet.se/blogg/nordnets-sparkonto-vi-hojer-rantan-till-360',
    },

    trading: {
      fundCourtageKr: 0,
      stockCourtageClasses: {
        mini: { maxOrderKr: 15600, minCourtageKr: 1, courtagePercent: 0.25 },
        small: { minOrderKr: 15600, maxOrderKr: 46000, minCourtageKr: 39, courtagePercent: 0.15 },
        medium: { minOrderKr: 46000, maxOrderKr: 143478, minCourtageKr: 69, courtagePercent: 0.069 },
        fastPris: { minOrderKr: 143478, fixedCourtageKr: 99 },
      },
      // Källorna motsäger varandra (0,25% nämns som automatisk växling,
      // 0,5% som "spread") - använder den lägre, men flaggad osäker.
      fxFeePercent: 0.25,
      verified: false,
      note: 'Kommer enbart från tredjepartsjämförelser, INTE hämtat direkt - Nordnets robots.txt stänger uttryckligen av /courtageklasser för crawlers.',
      source: 'https://kvalitetsaktier.se/courtage-jamforelse',
    },

    // Nordnet One: tre färdiga portföljer på Nordnets egna indexfonder.
    // Direkt hämtat från nordnet.se/fonder/nordnet-one (inte på disallow-
    // listan), så equityPercent/avgift är tillförlitliga på samma sätt som
    // Levlers Lagom eller Avanzas Auto-familj.
    fundPackages: [
      {
        id: 'forsiktig', name: 'Nordnet One Försiktig', productType: 'fondpaket',
        equityPercent: 30, fixedIncomePercent: 70,
        annualFeePercent: 0.34,
        minMonthlyKr: 100,
        composition: 'Färdig portfölj på Nordnets egna indexfonder, 30% aktier / 70% räntor',
        verified: true,
        note: 'Minsta belopp (100 kr) är från en tredjepartskälla, inte bekräftat på nordnet.se/fonder/nordnet-one direkt.',
        source: 'https://www.nordnet.se/fonder/nordnet-one',
      },
      {
        id: 'balanserad', name: 'Nordnet One Balanserad', productType: 'fondpaket',
        equityPercent: 60, fixedIncomePercent: 40,
        annualFeePercent: 0.34,
        minMonthlyKr: 100,
        composition: 'Färdig portfölj på Nordnets egna indexfonder, 60% aktier / 40% räntor',
        verified: true,
        note: 'Minsta belopp (100 kr) är från en tredjepartskälla, inte bekräftat på nordnet.se/fonder/nordnet-one direkt.',
        source: 'https://www.nordnet.se/fonder/nordnet-one',
      },
      {
        id: 'offensiv', name: 'Nordnet One Offensiv', productType: 'fondpaket',
        equityPercent: 100, fixedIncomePercent: 0,
        annualFeePercent: 0.35,
        minMonthlyKr: 100,
        composition: 'Färdig portfölj på Nordnets egna indexfonder, 100% aktier',
        verified: true,
        note: 'Minsta belopp (100 kr) är från en tredjepartskälla, inte bekräftat på nordnet.se/fonder/nordnet-one direkt.',
        source: 'https://www.nordnet.se/fonder/nordnet-one',
      },
    ],

    features: {
      marginLending: true,
      currencyAccount: true,
      verified: false,
      note: 'Nordnet har belåning och valutakonto, men villkoren är inte kontrollerade här.',
      source: 'https://isk-guiden.se/maklare/nordnet/',
    },

    source: 'https://isk-guiden.se/maklare/nordnet/',
  },
};
// ============================== END INSTITUTES ===============================

