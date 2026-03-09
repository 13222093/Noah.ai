import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * SMS Alert Sender
 * Sends flood warning SMS to all active subscribers in a region via Twilio.
 * Called by /api/smart-alert when risk level is elevated.
 *
 * Gracefully degrades if Twilio is not configured — logs warning but doesn't crash.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

// SMS message templates (max 160 chars for basic phones)
function formatSmsMessage(data: {
    alert_level: string;
    region_name: string;
    water_level_cm?: number;
    recommendation?: string;
}, language: string): string {
    if (language === 'en') {
        const levelMap: Record<string, string> = {
            CRITICAL: 'CRITICAL',
            BAHAYA: 'DANGER',
            WASPADA: 'WARNING',
            AMAN: 'SAFE',
        };
        const level = levelMap[data.alert_level] || data.alert_level;
        let msg = `⚠️ FLOOD ALERT\n${data.region_name}: ${level}`;
        if (data.water_level_cm) msg += `\nWater: ${data.water_level_cm}cm`;
        if (data.alert_level === 'CRITICAL' || data.alert_level === 'BAHAYA') {
            msg += `\nEvacuate now!`;
        }
        msg += `\nReply STOP to unsub`;
        return msg.substring(0, 160);
    }

    // Default: Bahasa Indonesia
    const levelMap: Record<string, string> = {
        CRITICAL: 'KRITIS',
        BAHAYA: 'BAHAYA',
        WASPADA: 'WASPADA',
        AMAN: 'AMAN',
    };
    const level = levelMap[data.alert_level] || data.alert_level;
    let msg = `⚠️ PERINGATAN BANJIR\n${data.region_name}: ${level}`;
    if (data.water_level_cm) msg += `\nTMA: ${data.water_level_cm}cm`;
    if (data.alert_level === 'CRITICAL' || data.alert_level === 'BAHAYA') {
        msg += `\nSegera evakuasi!`;
    }
    msg += `\nBalas STOP utk berhenti`;
    return msg.substring(0, 160);
}

// Region display names
const REGION_NAMES: Record<string, string> = {
    MANGGARAI_01: 'Pintu Air Manggarai',
    ISTIQLAL_01: 'Istiqlal',
    KARET_01: 'Pintu Air Karet',
    ANCOL_01: 'Marina Ancol',
};

interface SmsAlertRequest {
    alert_level: string;
    region_id?: string;
    water_level_cm?: number;
    recommendation?: string;
    prediction_cm?: number;
}

export async function POST(request: Request) {
    // Check Twilio config
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!twilioSid || !twilioToken || !twilioPhone) {
        console.warn('[SMS Alert] Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.local');
        return NextResponse.json({
            warning: 'SMS not configured — Twilio credentials missing',
            sms_sent: 0,
            status: 'skipped',
        });
    }

    try {
        const body: SmsAlertRequest = await request.json();
        const {
            alert_level = 'AMAN',
            region_id = 'MANGGARAI_01',
            water_level_cm,
            recommendation,
            prediction_cm,
        } = body;

        // Only send SMS for elevated risk
        if (!['WASPADA', 'BAHAYA', 'CRITICAL'].includes(alert_level)) {
            return NextResponse.json({
                message: 'Alert level too low for SMS notification',
                alert_level,
                sms_sent: 0,
            });
        }

        const supabase = getSupabase();

        // Get all active subscribers for this region
        const { data: subscribers, error: fetchError } = await supabase
            .from('sms_subscribers')
            .select('id, phone_number, name, language')
            .eq('region_id', region_id)
            .eq('is_active', true);

        if (fetchError) {
            console.error('[SMS Alert] Failed to fetch subscribers:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
        }

        if (!subscribers || subscribers.length === 0) {
            return NextResponse.json({
                message: 'No active subscribers for this region',
                region_id,
                sms_sent: 0,
            });
        }

        // Dynamically import Twilio (to avoid issues if not installed)
        let twilioClient: any;
        try {
            const twilio = await import('twilio');
            twilioClient = twilio.default(twilioSid, twilioToken);
        } catch (importErr) {
            console.error('[SMS Alert] Twilio SDK not installed. Run: npm install twilio');
            return NextResponse.json({
                error: 'Twilio SDK not installed',
                sms_sent: 0,
            }, { status: 500 });
        }

        const regionName = REGION_NAMES[region_id] || region_id;
        const waterLevel = water_level_cm || prediction_cm;

        // Send SMS to each subscriber
        const results = await Promise.allSettled(
            subscribers.map(async (sub) => {
                const message = formatSmsMessage(
                    { alert_level, region_name: regionName, water_level_cm: waterLevel, recommendation },
                    sub.language
                );

                try {
                    const twilioMsg = await twilioClient.messages.create({
                        body: message,
                        from: twilioPhone,
                        to: sub.phone_number,
                    });

                    // Log success
                    await supabase.from('sms_logs').insert({
                        subscriber_id: sub.id,
                        phone_number: sub.phone_number,
                        message,
                        alert_level,
                        region_id,
                        status: 'sent',
                        twilio_sid: twilioMsg.sid,
                    });

                    return { phone: sub.phone_number, status: 'sent', sid: twilioMsg.sid };
                } catch (sendErr: any) {
                    console.error(`[SMS Alert] Failed to send to ${sub.phone_number}:`, sendErr.message);

                    // Log failure
                    await supabase.from('sms_logs').insert({
                        subscriber_id: sub.id,
                        phone_number: sub.phone_number,
                        message,
                        alert_level,
                        region_id,
                        status: 'failed',
                        error_message: sendErr.message,
                    });

                    return { phone: sub.phone_number, status: 'failed', error: sendErr.message };
                }
            })
        );

        const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 'sent').length;
        const failed = results.length - sent;

        return NextResponse.json({
            message: `SMS alerts processed`,
            alert_level,
            region_id,
            sms_sent: sent,
            sms_failed: failed,
            total_subscribers: subscribers.length,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[SMS Alert] Error:', error);
        return NextResponse.json(
            { error: 'SMS alert failed', details: error.message },
            { status: 500 }
        );
    }
}
