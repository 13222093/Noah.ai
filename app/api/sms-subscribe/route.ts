import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * SMS Subscribe Endpoint
 * POST — Subscribe a phone number to flood alerts for a region
 * DELETE — Unsubscribe (deactivate)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

// Validate international phone number format
function isValidPhone(phone: string): boolean {
    return /^\+[1-9]\d{7,14}$/.test(phone);
}

const VALID_REGIONS = [
    'MANGGARAI_01',
    'ISTIQLAL_01',
    'KARET_01',
    'ANCOL_01',
];

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone_number, name, region_id, language } = body;

        // Validate required fields
        if (!phone_number) {
            return NextResponse.json(
                { error: 'Nomor telepon wajib diisi / Phone number is required' },
                { status: 400 }
            );
        }

        if (!isValidPhone(phone_number)) {
            return NextResponse.json(
                { error: 'Format nomor tidak valid. Gunakan format internasional: +62xxx / Invalid phone format. Use international format: +62xxx' },
                { status: 400 }
            );
        }

        const selectedRegion = region_id || 'MANGGARAI_01';
        if (!VALID_REGIONS.includes(selectedRegion)) {
            return NextResponse.json(
                { error: `Region tidak valid. Pilihan: ${VALID_REGIONS.join(', ')}` },
                { status: 400 }
            );
        }

        const selectedLanguage = language === 'en' ? 'en' : 'id';
        const subscriberName = name || 'Warga';

        const supabase = getSupabase();

        // Check if already subscribed
        const { data: existing } = await supabase
            .from('sms_subscribers')
            .select('id, is_active')
            .eq('phone_number', phone_number)
            .eq('region_id', selectedRegion)
            .single();

        if (existing) {
            if (existing.is_active) {
                return NextResponse.json(
                    { message: 'Nomor ini sudah terdaftar untuk wilayah ini / Already subscribed to this region', subscriber_id: existing.id },
                    { status: 200 }
                );
            }

            // Reactivate
            const { error: updateError } = await supabase
                .from('sms_subscribers')
                .update({ is_active: true, name: subscriberName, language: selectedLanguage, updated_at: new Date().toISOString() })
                .eq('id', existing.id);

            if (updateError) {
                console.error('Reactivation error:', updateError);
                return NextResponse.json({ error: 'Gagal mengaktifkan kembali / Failed to reactivate' }, { status: 500 });
            }

            return NextResponse.json({
                message: 'Berhasil diaktifkan kembali / Reactivated successfully',
                subscriber_id: existing.id,
            });
        }

        // Insert new subscriber
        const { data: newSub, error: insertError } = await supabase
            .from('sms_subscribers')
            .insert({
                phone_number,
                name: subscriberName,
                region_id: selectedRegion,
                language: selectedLanguage,
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: 'Gagal mendaftar / Failed to subscribe' }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Berhasil terdaftar! Anda akan menerima peringatan banjir via SMS. / Subscribed! You will receive flood alerts via SMS.',
            subscriber_id: newSub.id,
            region: selectedRegion,
        }, { status: 201 });

    } catch (error: any) {
        console.error('SMS subscribe error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server / Server error', details: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { phone_number, region_id } = body;

        if (!phone_number) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const supabase = getSupabase();

        const query = supabase
            .from('sms_subscribers')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('phone_number', phone_number);

        if (region_id) {
            query.eq('region_id', region_id);
        }

        const { error } = await query;

        if (error) {
            console.error('Unsubscribe error:', error);
            return NextResponse.json({ error: 'Gagal berhenti berlangganan / Failed to unsubscribe' }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Berhasil berhenti berlangganan. Anda tidak akan menerima SMS lagi. / Unsubscribed successfully.',
        });

    } catch (error: any) {
        console.error('SMS unsubscribe error:', error);
        return NextResponse.json(
            { error: 'Server error', details: error.message },
            { status: 500 }
        );
    }
}
