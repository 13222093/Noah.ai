# Demo script: Noah AI operator screens (6 minutes)

Historical replay of the 1 January 2020 Jakarta flood on three screens: **Ringkasan**, **Polder detail**, **Rekomendasi + WhatsApp preview**. What is real and what is simulated is listed in `docs/demo/simulation.md`; the honesty lines below are the ones to say out loud.

On this branch the operator screens are a **new section, `/operator`**, added next to the original Noah AI app. The original app (Command dashboard, Alerts, Data, Weather, AI tools and the rest) is unchanged and still reachable from the NavRail; the new **Operator** entry (wave icon, second from the top) opens this section. Inside it, a small sub-nav switches between **Ringkasan · Polder · Rekomendasi**, and the replay bar sits at the bottom of the content area.

## Before you start (5 minutes ahead)
- Start it with `npm run demo` (production build, port 3000; `npm run demo -- --no-build` to restart the last build). It sets `NOAH_DEMO_MODE` / `NEXT_PUBLIC_NOAH_DEMO_MODE` and picks up `NEXT_PUBLIC_CARTO_BASEMAP_KEY` from `.env.development.local` for the CARTO dark basemap (without it the map uses Esri Dark Gray). The `/operator` section shows the replay even without demo mode; there is no access gate on this branch.
- Desktop browser at 1920 x 1080, dark theme, zoom 100%. Close DevTools.
- Open `/operator/rekomendasi` and press **Reset demo** if earlier answers are still there (answers live in this browser only).
- Phone on the same network, with `/operator/polder/setiabudi_timur` ready in a tab.
- Open `/operator` (or click **Operator** in the NavRail) and wait for the map. The replay opens at **31 Des 2019 23:40 WIB**, when the DSDA archive starts.

Keyboard: **space** = play/pause, **left/right** = 10 minutes back/forward (not while the map or a form has focus; click a panel heading first). The **Lompat ke** chips under the replay bar jump to the scenario's notable moments.

## 0:00 to 0:45: frame it honestly (Ringkasan)
Click: nothing yet. Point at the violet chip **SKENARIO HISTORIS + SIMULASI** (violet always means simulated or demo; it is never a warning level), then click the scenario title next to it to open the list.

Say:
- "This is a replay of the night of 1 January 2020, not today. Time on screen is replay time, in WIB, at the bottom."
- "Water levels and the Siaga status at each post are the **real DSDA archive**. Rain is **real ERA5 reanalysis**, coarse, and it badly underestimates this event (ERA5 peaks at about 7 mm per hour; BMKG measured 377 mm in a day at Halim)."
- "Flood probability, pond and pump state, and the recommendations are **SIMULASI** from a transparent demo rule. Not a validated model, and not scored."
- "Noah only advises. It does not touch pumps or gates, and it never messages the public."

Close the popover.

## 0:45 to 1:45: read the map (Ringkasan)
Point at:
- **Squares** = DSDA posts, coloured and numbered by the Siaga status DSDA recorded (N green, 3 orange, 2 deep orange, 1 red: the original Noah status colours). Hover **PA. Manggarai**: level in cm, the 2020 Siaga thresholds, reading time, source "Arsip historis".
- **Hatched squares** = Pompa Yos Sudarso 1 and PA. Pulo Gadung. Their readings do not change all night, so they are flagged "sensor tidak berubah" and not used. "Three polders, Pulomas, Sunter Selatan and Kelapa Gading, are therefore blind spots: their forecast runs on rain only, and the reasons say so." This is an honest gap, worth showing.
- **Circles** = lighthouse polders, coloured by the chance of flooding in the selected window. Switch **60 / 120 / 180 mnt** top right. Circles are reference points, not polder boundaries.
- Left panel: polders ranked, with the three lead times as small bars. Right panel: open recommendations and **Sumber data** (each source with its last data time; greyed when old).

## 1:45 to 2:45: the event builds (playback)
Click **Lompat ke → 02:40 Manggarai masuk Siaga 3**. The map pans to Manggarai.
Set speed **4×**, press **space**. Let it run to about 06:00 (≈ 25 seconds), then press **space** again.

Say while it plays (plan 03 workflow, steps 1 to 3):
- "Every 10 minutes of replay, Noah recomputes the chance of flooding per polder for the next 1, 2 and 3 hours." Watch **Setiabudi Timur** climb to tinggi and sangat tinggi as Manggarai and Karet rise.
- "When a trigger in the trigger-to-action table is met, a recommendation appears for the operator." The badge on **Rekomendasi** in the operator sub-nav counts the open ones nobody has answered yet.

## 2:45 to 4:00: one polder in depth (Polder detail)
Click the **Setiabudi Timur** circle on the map (or its row on the left).

Point at:
- Three big numbers: chance of flooding within 60, 120 and 180 minutes, each with its category and time window. Click **120 mnt**: the reasons, in plain language, most important first, with "diterbitkan" time and the SIMULASI label.
- Chart: **PA. Manggarai** water level against the Siaga 3, 2 and 1 lines, with hourly rain. "The line stops at **sekarang**: the screen never shows data after the replay time." Switch to **P.A. Karet**.
- **Riwayat peluang banjir**: how the forecast moved over the night, one line per lead time.
- **Operasi polder** (all SIMULASI, no SCADA yet): pond fill, time to full, pumps running, wet or dry drawdown state, and the anomaly "debit pompa kurang". Say: "We injected a pump fault at 00:00 for this exercise. It did not happen in 2020." That is why the **Periksa pompa** recommendation exists.

## 4:00 to 5:15: the operator decides (Rekomendasi)
Click **Rekomendasi** in the operator sub-nav. Filter **Polder → Polder Setiabudi Timur**.

- Click **Pratinjau WhatsApp** on the newest card. The right pane shows the operator group exactly as the message would read, with the violet **Pratinjau – tidak dikirim** label. "Messages go only to operator groups, at most one per polder per 30 minutes unless the category changes. In this demo nothing is sent."
- Click **Tanggapi**, choose **Ditindaklanjuti**, type a short note (for example "2 pompa dinyalakan 05.10"), **Simpan tanggapan**. The answer shows on the card with the replay time, and the sub-nav badge drops. Say: "This is step 4 of the workflow: the operator records what was done. Every card says *Saran — keputusan di tangan operator*."
- Optional: set **Status → Lewat waktu** to show recommendations whose window ended without an answer.

## 5:15 to 5:45: the phone (WhatsApp deep link)
On the phone, open the link from the message (`/operator/polder/setiabudi_timur`). The same polder page, stacked for a 375 px screen: big numbers first, then the chart, pond status and recommendations, with the replay bar at the bottom. "This is where a pump-house operator lands from the group chat."

## 5:45 to 6:30: close
Click **Lompat ke → 23:40 Manggarai masuk Siaga 1**, then **00:40 Puncak Manggarai** to show the peak.

Say:
- "Real: DSDA levels and Siaga status, ERA5 rain. Simulated: probabilities, pond and pumps, recommendations."
- "Next in the plan (workflow steps 5 and 6): BPBD flood reports matched against every forecast, a scoreboard of hits and false alarms for operators and supervisors (never public), and a weekly report to DSDA supervisors. None of that is in this demo."

After the demo: **Rekomendasi → Reset demo**.

## If something goes wrong
- Map tiles missing: switch the basemap (layers button, top left of the map) to **Gelap (Esri)**, or **Jalan** as a last resort.
- Keys do nothing: focus is on the map or a form. Click a panel heading, or use the buttons on the replay bar.
- Lost the thread: use a **Lompat ke** chip under the replay bar.
- Need the original app: every NavRail entry other than **Operator** opens it exactly as before.
