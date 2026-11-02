# 📱 SMS Alert System — Implementation Plan

> **Goal:** Add SMS notifications so rural communities without smartphones/internet can receive flood warnings via basic SMS. Directly addresses the hackathon theme's emphasis on rural populations.

---

## Why SMS?

- 🏘️ **Rural reach** — SMS works on basic phones, no internet needed
- 🌏 **ASEAN-wide** — Works across all ASEAN countries
- ⚡ **Instant** — Arrives in seconds during emergencies
- 📱 **Universal** — 100% mobile phone penetration vs ~60% smartphone in rural ASEAN

---

## Architecture

```
[Smart Alert System]
  LSTM prediction + YOLO detection
         ↓
  alert_level ≥ WASPADA?
         ↓ YES
  Query sms_subscribers for affected region
         ↓
  Send SMS via Twilio → Rural phones
         ↓
  Log to sms_logs (audit trail)
```

---

## SMS Provider: Twilio

- Free trial with $15 credit (~1000 SMS)
- Works internationally (Indonesia + ASEAN)
- Official Node.js SDK
- Provider-agnostic architecture — can swap to Vonage, Zenziva, etc.

---

## New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20250309100000_create_sms_subscribers.sql` | `sms_subscribers` + `sms_logs` tables |
| `app/api/sms-subscribe/route.ts` | Subscribe/unsubscribe phone numbers |
| `app/api/sms-alert/route.ts` | Send SMS via Twilio to affected subscribers |
| `app/sms-subscribe/page.tsx` | Subscription form UI |

## Modified Files

| File | Change |
|------|--------|
| `app/api/smart-alert/route.ts` | Trigger SMS after alert generation |
| `package.json` | Add `twilio` dependency |
| `.env.example` | Add Twilio env vars |

---

## Database Schema

### `sms_subscribers`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `phone_number` | TEXT | International format (+62xxx) |
| `name` | TEXT | Subscriber name |
| `region_id` | TEXT | Area to receive alerts for (e.g., `MANGGARAI_01`) |
| `language` | TEXT | `id` or `en` for localized SMS |
| `is_active` | BOOLEAN | Can unsubscribe without deleting |
| `created_at` | TIMESTAMPTZ | Registration time |

### `sms_logs`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `phone_number` | TEXT | Recipient |
| `message` | TEXT | SMS content sent |
| `alert_level` | TEXT | WASPADA / BAHAYA / CRITICAL |
| `status` | TEXT | `sent` / `failed` / `queued` |
| `twilio_sid` | TEXT | Twilio message ID for tracking |
| `created_at` | TIMESTAMPTZ | Send time |

---

## SMS Format (160 chars max for basic phones)

```
⚠️ PERINGATAN BANJIR
Manggarai: BAHAYA
TMA: 720cm
Segera evakuasi!
Info: noah.ai.id/alerts
```

English variant:
```
⚠️ FLOOD WARNING
Manggarai: DANGER
Water: 720cm
Evacuate now!
Info: noah.ai.id/alerts
```

---

## API Endpoints

### POST `/api/sms-subscribe`
Subscribe a phone number to flood alerts.
```json
{
  "phone_number": "+6281234567890",
  "name": "Pak Ahmad",
  "region_id": "MANGGARAI_01",
  "language": "id"
}
```

### DELETE `/api/sms-subscribe`
Unsubscribe (sets `is_active = false`).

### POST `/api/sms-alert`
Send SMS to all subscribers in a region (called by smart-alert system).
```json
{
  "alert_level": "BAHAYA",
  "region_id": "MANGGARAI_01",
  "recommendation": "Segera evakuasi!",
  "water_level_cm": 720
}
```

---

## Smart Alert Integration

When `smart-alert/route.ts` generates an alert with `alert_level ≥ WASPADA`:
1. Calls `/api/sms-alert` with alert data
2. SMS sent to all active subscribers for that region
3. Each send logged to `sms_logs` for accountability

---

## Environment Variables

```env
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Theme Alignment

| Theme Requirement | How SMS Addresses It |
|-------------------|---------------------|
| Rural populations at risk | ✅ SMS works on basic phones, no internet needed |
| Precise coordinates for rescue | ✅ SMS includes location + water level data |
| Hyper-local early warning | ✅ Region-specific subscriber lists |
| ASEAN inclusivity | ✅ Multi-language SMS (ID/EN), Twilio works across ASEAN |
| AI-driven warning | ✅ Triggered by LSTM + YOLO cross-validated predictions |
