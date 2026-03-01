import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(null);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || null);
  } catch (error: any) {
    console.error('Error in preferences GET:', error.message);
    return NextResponse.json(null);
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database is not configured.' },
      { status: 503 }
    );
  }

  try {
    const { default_location, preferences_data } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existingPreferences, error: fetchError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing preferences:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let result;
    if (existingPreferences) {
      result = await supabase
        .from('user_preferences')
        .update({ default_location, preferences_data, updated_at: new Date().toISOString() })
        .eq('id', existingPreferences.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('user_preferences')
        .insert({ user_id: user.id, default_location, preferences_data })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving user preferences:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('Error in preferences POST:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
