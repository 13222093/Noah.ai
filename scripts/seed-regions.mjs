/**
 * Populate Indonesian region data (provinces, regencies, districts)
 * into Supabase from the public emsifa API.
 * 
 * Usage: node scripts/seed-regions.mjs
 */

const SUPABASE_URL = 'https://mqebuzgvhtpupvuohvgg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZWJ1emd2aHRwdXB2dW9odmdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzMxNjU5MCwiZXhwIjoyMDg4ODkyNTkwfQ.cBLXlQX9UCEV5D8kKBtM1E5Pivh8XyyESZ1P7MxD4b4';

const API_BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function supabaseInsert(table, rows) {
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Error inserting into ${table} (batch ${i}):`, err);
    } else {
      console.log(`  ✅ ${table}: inserted batch ${i}-${i + batch.length}`);
    }
  }
}

async function main() {
  console.log('🌏 Fetching provinces...');
  const provinces = await fetchJson(`${API_BASE}/provinces.json`);
  console.log(`  Found ${provinces.length} provinces`);

  // Insert provinces
  const provRows = provinces.map(p => ({
    province_code: p.id,
    province_name: p.name,
    province_latitude: null,
    province_longitude: null,
  }));
  await supabaseInsert('provinces', provRows);

  // For each province, fetch regencies
  console.log('🏙️ Fetching regencies...');
  const allRegencies = [];
  for (const prov of provinces) {
    try {
      const regencies = await fetchJson(`${API_BASE}/regencies/${prov.id}.json`);
      for (const r of regencies) {
        allRegencies.push({
          city_code: r.id,
          city_name: r.name,
          city_province_code: prov.id,
          city_latitude: null,
          city_longitude: null,
        });
      }
      process.stdout.write('.');
    } catch (e) {
      console.error(`  ⚠️ Failed for province ${prov.id}: ${e.message}`);
    }
  }
  console.log(`\n  Found ${allRegencies.length} regencies`);
  await supabaseInsert('regencies', allRegencies);

  // For each regency, fetch districts
  console.log('📍 Fetching districts (this takes a while)...');
  const allDistricts = [];
  let count = 0;
  for (const reg of allRegencies) {
    try {
      const districts = await fetchJson(`${API_BASE}/districts/${reg.city_code}.json`);
      for (const d of districts) {
        allDistricts.push({
          sub_district_code: d.id,
          sub_district_name: d.name,
          sub_district_city_code: reg.city_code,
          sub_district_latitude: null,
          sub_district_longitude: null,
          sub_district_geometry: null,
        });
      }
      count++;
      if (count % 50 === 0) process.stdout.write(`[${count}/${allRegencies.length}]`);
      else process.stdout.write('.');
    } catch (e) {
      // Some regencies may not have districts
    }
  }
  console.log(`\n  Found ${allDistricts.length} districts`);
  await supabaseInsert('districts', allDistricts);

  console.log('\n🎉 Done! All region data populated.');
}

main().catch(console.error);
