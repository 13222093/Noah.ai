// Operator UI strings, English (secondary). Same shape as id.ts.
// See id.ts for why the hackathon-era keys were removed (F9, qa-W1).
import type id from './id';

const en: typeof id = {
  common: {
    appName: 'Noah AI',
    language: 'Language',
    loading: 'Loading...',
    noData: 'No data yet',
    lastData: 'Last data',
    stale: 'Stale data',
    levels: {
      // DSDA Siaga levels are proper names; kept untranslated.
      siaga1: 'Siaga 1',
      siaga2: 'Siaga 2',
      siaga3: 'Siaga 3',
      siaga4: 'Siaga 4',
    },
  },
  nav: {
    ringkasan: 'Overview',
    polder: 'Polder',
    rekomendasi: 'Recommendations',
    skor: 'Scoreboard',
    laporan: 'Reports',
    admin: 'Admin',
    settings: 'Settings',
  },
};

export default en;
