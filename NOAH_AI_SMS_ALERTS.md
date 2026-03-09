# 📱 SMS Alert System — Implementation Details

> SMS flood warnings for rural communities without internet access. Works on any basic phone.

---

## Why SMS?

| Factor | Detail |
|--------|--------|
| 📶 No internet needed | SMS works on 2G networks and basic phones |
| 🌏 ASEAN-wide | Twilio supports all ASEAN countries |
| 🤖 AI-powered | Triggered automatically by LSTM + YOLO cross-validation |
| 📋 Audit trail | Every SMS logged to Supabase for accountability |

---

## How It Works

```
[AI Detection Pipeline]
  LSTM predicts flood → YOLO verifies visually → Smart Alert scores confidence
                                    ↓
                         alert_level ≥ WASPADA?
                                    ↓ YES
                    Query sms_subscribers for affected region
                                    ↓
                         Send SMS via Twilio
                                    ↓
                         Log to sms_logs (audit)
```

The SMS trigger is **fire-and-forget** — it doesn't block the smart alert response. If Twilio is not configured, the system logs a warning and continues normally.

---

## Files

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20250309100000_create_sms_subscribers.sql` | `sms_subscribers` + `sms_logs` tables with RLS |
| `app/api/sms-subscribe/route.ts` | POST subscribe / DELETE unsubscribe with phone validation |
| `app/api/sms-alert/route.ts` | Core SMS sender via Twilio SDK |
| `app/sms-subscribe/page.tsx` | Subscription form UI at `/sms-subscribe` |

### Modified Files
| File | Change |
|------|--------|
| `app/api/smart-alert/route.ts` | Triggers SMS on WASPADA / BAHAYA / CRITICAL alerts |
| `.env.example` | Added `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| `package.json` | Added `twilio` dependency |

---

## Database Schema

### `sms_subscribers`
| Column | Type | Purpose |
|--------|------|---------|
| `phone_number` | TEXT | International format (+62xxx) |
| `name` | TEXT | Subscriber name |
| `region_id` | TEXT | Monitoring area (e.g., `MANGGARAI_01`) |
| `language` | TEXT | `id` (Bahasa) or `en` (English) |
| `is_active` | BOOLEAN | Soft-delete for unsubscribe |

### `sms_logs`
| Column | Type | Purpose |
|--------|------|---------|
| `phone_number` | TEXT | Recipient |
| `message` | TEXT | SMS content sent |
| `alert_level` | TEXT | Risk level that triggered the SMS |
| `status` | TEXT | `sent` / `failed` / `queued` |
| `twilio_sid` | TEXT | Twilio message ID for tracking |

---

## SMS Format (≤160 chars for basic phones)

**Bahasa Indonesia:**
```
⚠️ PERINGATAN BANJIR
Pintu Air Manggarai: BAHAYA
TMA: 720cm
Segera evakuasi!
Balas STOP utk berhenti
```

**English:**
```
⚠️ FLOOD ALERT
Pintu Air Manggarai: DANGER
Water: 720cm
Evacuate now!
Reply STOP to unsub
```

---

## Subscription Page (`/sms-subscribe`)

The page features:
- Phone number input with +62 default
- Region selector (4 Jakarta monitoring points)
- Language toggle (ID / EN)
- Live SMS preview
- Privacy notice
- "How it works" explainer

---

## API Endpoints

### POST `/api/sms-subscribe`
```json
{
  "phone_number": "+6281234567890",
  "name": "Pak Ahmad",
  "region_id": "MANGGARAI_01",
  "language": "id"
}
```

### DELETE `/api/sms-subscribe`
```json
{ "phone_number": "+6281234567890" }
```

### POST `/api/sms-alert` (called by smart-alert)
```json
{
  "alert_level": "BAHAYA",
  "region_id": "MANGGARAI_01",
  "water_level_cm": 720
}
```

---

## Setup

### 1. Twilio Account
Sign up at https://www.twilio.com/try-twilio (free $15 credit).

### 2. Environment Variables
Add to `flood/.env.local`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### 3. Database Migration
Run the SQL in Supabase dashboard or:
```bash
npx supabase db reset
```

### 4. Test
```bash
# Subscribe
curl -X POST http://localhost:3000/api/sms-subscribe \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+6281234567890", "name": "Test", "region_id": "MANGGARAI_01"}'

# Trigger smart alert (will send SMS if risk is elevated)
curl -X POST http://localhost:3000/api/smart-alert \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Graceful Degradation

- **No Twilio configured** → SMS skipped, warning logged, app works normally
- **No subscribers** → SMS endpoint returns `sms_sent: 0`, no errors
- **Twilio send fails** → Logged as `failed` in `sms_logs`, other subscribers still receive
- **CSV fallback missing** → Smart alert still works, just without SMS
