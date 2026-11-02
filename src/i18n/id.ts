// Operator UI strings, Bahasa Indonesia (primary; guardrail 15).
//
// F9 (qa-W1): the hackathon-era dictionary (public warnings, SMS, evacuation,
// LSTM/CCTV claims, "real-time" labels, chatbot, 34-province copy) was removed.
// No page called t() for those keys any more. Add keys here only together with
// the component that renders them, and keep en.ts in the same shape.
const id = {
  common: {
    appName: 'Noah AI',
    language: 'Bahasa',
    loading: 'Memuat...',
    noData: 'Belum ada data',
    lastData: 'Data terakhir',
    stale: 'Data usang',
    levels: {
      siaga1: 'Siaga 1',
      siaga2: 'Siaga 2',
      siaga3: 'Siaga 3',
      siaga4: 'Siaga 4',
    },
  },
  nav: {
    ringkasan: 'Ringkasan',
    polder: 'Polder',
    rekomendasi: 'Rekomendasi',
    skor: 'Skor',
    laporan: 'Laporan',
    admin: 'Admin',
    settings: 'Pengaturan',
  },
};

export default id;
