# 🎯 noah.ai — Hackathon Evaluation Gap Analysis

> **Theme:** ASEAN Disaster Preparedness (Floods & Landslides)
> **Alignment:** ASEAN Capacity Building Roadmap 2025-2030, UN SDGs

---

## Scoring Summary

| Category | Weight | noah.ai Strength | Score Est. |
|----------|--------|-------------------|------------|
| **Report** | 25% | 🟡 Needs UN-SDG mapping + AI disclosure | 6/10 |
| **AI Integration** | 10% | 🟢 Strong — LSTM + YOLO + Gemini, well-documented | 8/10 |
| **Innovation** | 15% | 🟢 Strong — closed-loop AI system, ASEAN-relevant | 7/10 |
| **Functionality** | 15% | 🟢 Strong — working prototype with real APIs | 8/10 |
| **Visual Design** | 15% | 🟡 Needs review — ASEAN inclusivity gap | 6/10 |
| **Pitching** | 10% | ⚪ Up to team (Dejet) | —/10 |
| **Market & Scalability** | 10% | 🔴 Missing — needs ASEAN expansion plan | 4/10 |

---

## Category Breakdown & Action Items

### 1. Report (25%) — Highest Weight ⚠️

| Criterion | Status | Gap |
|-----------|--------|-----|
| Problem Statement | 🟢 Strong | Already clear — Jakarta flooding, 5000+ ASEAN disasters |
| Objective + UN-SDG | 🔴 **Missing** | No explicit SDG mapping anywhere |
| Solution sustainability | 🟡 Partial | Architecture is future-proof, but no sustainability roadmap written |
| AI Acknowledgement | 🔴 **Missing** | No explicit AI tools disclosure in the project |

**Action Items:**
- [ ] **Map to UN SDGs explicitly** — SDG 11 (Sustainable Cities), SDG 13 (Climate Action), SDG 9 (Infrastructure)
- [ ] **Write AI Acknowledgement section** — list all AI tools: LSTM (TensorFlow), YOLOv8 (Ultralytics), Gemini (Google), and any coding assistants used
- [ ] **Add sustainability roadmap** to documentation

---

### 2. AI Integration & Responsible Use (10%)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Value Add | 🟢 Excellent | AI is core to the product — 24h flood prediction, visual detection, smart alerts |
| Appropriateness | 🟢 Excellent | LSTM for time-series forecasting, YOLO for image detection — textbook-correct choices |
| Transparency | 🟢 Good | `noah.ai_IMPLEMENTATION.md` documents it well |
| Safety & Ethics | 🟡 Gap | No documented guardrails — what if LSTM gives false alarm? What if YOLO misclassifies? |
| Data Privacy | 🟡 Gap | No privacy statement about CCTV data, location data, or user data |

**Action Items:**
- [ ] **Add guardrails documentation** — confidence thresholds, human-in-the-loop for CRITICAL alerts, false positive handling
- [ ] **Add data privacy statement** — CCTV data retention policy, no personal data collection, anonymized usage
- [ ] **Document model limitations** — LSTM trained on 2020 Jakarta data only, YOLO may fail in low-light

---

### 3. Innovation & Originality (15%)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Originality | 🟢 Strong | Closed-loop AI system (predict → verify → alert) is genuinely novel |
| Problem-Solution Fit | 🟢 Excellent | Directly addresses ASEAN flood preparedness |
| Creative Approach | 🟡 Needs framing | Need to emphasize **ASEAN-relevant constraints**: limited infrastructure, monsoon patterns, developing-nation scalability |

**Action Items:**
- [ ] **Emphasize ASEAN-specific innovation** — works with limited sensors, uses free APIs, designed for developing infra
- [ ] **Highlight the "honest demo" approach** — historical replay instead of fake data shows integrity

---

### 4. Functionality & Prototype (15%)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Impact | 🟢 Strong | Feasible, specific, targeted at Jakarta flood gates |
| Efficiency | 🟢 Good | Clean architecture, real API calls, sensible caching |
| Practical Usage | 🟡 Need to verify | Must ensure the demo flow works end-to-end for judges |

**Action Items:**
- [ ] **Verify entire demo flow works** — Auto-predict → Map layer → Smart alert
- [ ] **Prepare a scripted demo path** for judges

---

### 5. Visual Design (15%)

| Criterion | Status | Notes |
|-----------|--------|-------|
| UX | 🟡 Needs review | Inherited from noah.ai — need to check intuitiveness |
| Consistency | 🟡 Needs review | Multiple source projects merged — may have style inconsistencies |
| Accessibility | 🟡 Needs review | Contrast, font sizes, screen reader support unclear |
| **ASEAN Inclusivity** | 🔴 **Gap** | Currently Jakarta-only, Indonesian language only, no multi-language support |

**Action Items:**
- [ ] **Add language considerations** — at minimum, show UI works for Bahasa Indonesia (primary) + English
- [ ] **Review visual consistency** across merged pages
- [ ] **Ensure risk colors are accessible** — colorblind-friendly palette for AMAN/WASPADA/BAHAYA/CRITICAL

---

### 6. Market & Scalability (10%) — Biggest Gap 🔴

| Criterion | Status | Notes |
|-----------|--------|-------|
| Commercial Viability | 🔴 Missing | No revenue model or adoption strategy |
| Regional Appeal | 🔴 Missing | Only Jakarta — no mention of other ASEAN cities |
| Stakeholders | 🟡 Partial | BPBD mentioned but no other stakeholders mapped |
| Scalability Plan | 🔴 Missing | No plan for adapting to Thailand, Philippines, Vietnam, Myanmar |
| Sustainability | 🔴 Missing | No post-hackathon roadmap |

**Action Items:**
- [ ] **Write ASEAN scalability plan** — how to replicate for Bangkok (Chao Phraya flooding), Manila (Pasig River), Ho Chi Minh City, Myanmar (Irrawaddy)
- [ ] **Identify stakeholders** — BPBD (Indonesia), NDRRMC (Philippines), DDM (Thailand), government water agencies, NGOs (Red Cross ASEAN), ASEAN AHA Centre
- [ ] **Define revenue model** — B2G (government contracts), freemium for communities, data licensing
- [ ] **Post-hackathon sustainability** — open-source core, partner with ASEAN AHA Centre

---

## Priority Matrix

### 🔴 Must Fix Before Submission (High Impact, Quick)
1. **UN-SDG mapping** — add to report/docs (SDG 11, 13, 9)
2. **AI Acknowledgement** — explicit list of all AI tools
3. **ASEAN scalability narrative** — even a 1-page plan dramatically improves Market score
4. **Stakeholder mapping** — name specific organizations

### 🟡 Should Fix (Medium Impact)
5. **Safety guardrails documentation** — false positive handling, confidence thresholds
6. **Data privacy statement** — CCTV, location, user data policies
7. **ASEAN inclusivity in UI** — at minimum English language toggle or regional context

### 🟢 Nice to Have
8. Visual accessibility review (colorblind-safe risk colors)
9. Demo script for judges
10. Model limitations disclaimer

---

## Recommended UN SDG Alignment

| SDG | Connection to noah.ai |
|-----|----------------------|
| **SDG 11** — Sustainable Cities & Communities | Core: flood early warning protects urban communities |
| **SDG 13** — Climate Action | Core: AI-driven climate disaster preparedness |
| **SDG 9** — Industry, Innovation & Infrastructure | Supporting: infrastructure monitoring (flood gates, pumps) |
| **SDG 17** — Partnerships | Supporting: multi-stakeholder collaboration (BPBD, ASEAN AHA Centre) |

---

## Competitive Edge — What Makes noah.ai Stand Out

1. **Closed-Loop AI** — Not just prediction OR detection, but both cross-validated
2. **Real Data, Honest Demo** — Historical replay instead of fake data (integrity point)
3. **Production Architecture** — Built on noah.ai's real monitoring platform, not a throwaway prototype
4. **Triple AI Stack** — LSTM (prediction) + YOLOv8 (detection) + Gemini (natural language analysis)
5. **ASEAN-Relevant** — Designed for developing infrastructure, uses free/low-cost APIs
