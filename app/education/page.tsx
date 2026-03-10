import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { GraduationCap } from 'lucide-react';

export const metadata = {
    title: 'Pusat Edukasi Banjir & Hidrologi | noah.ai',
    description: 'Artikel dan panduan lengkap tentang mitigasi bencana banjir, hidrologi, dan cara membaca data sensor cuaca.',
};

export default function EducationHubPage() {
    return (
        <PageShell title="Education Hub" subtitle="Flood science & preparedness" icon={<GraduationCap className="w-4 h-4" />}>
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 text-center max-w-3xl mx-auto">
                    <div className="text-cc-cyan font-mono tracking-widest text-sm mb-3">KNOWLEDGE BASE</div>
                    <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4 text-cc-text">Edu-Center</h2>
                    <p className="text-sm text-cc-text-secondary">
                        Memahami sains di balik bencana untuk meningkatkan kesiapsiagaan kita.
                        Data tanpa pemahaman hanyalah angka.
                    </p>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Article Card 1: Analysis */}
                    <Link href="/education/kenapa-jakarta-banjir" className="group">
                        <article className="bg-cc-surface rounded-lg overflow-hidden border border-cc-border hover:border-cc-border-active transition h-full flex flex-col">
                            <div className="h-40 bg-cc-elevated relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                    <span className="text-white font-mono text-xs bg-cc-cyan/80 px-2 py-1 rounded">ANALISIS</span>
                                </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-base font-bold mb-2 group-hover:text-cc-cyan transition text-cc-text">Kenapa Jakarta Sering Banjir?</h3>
                                <p className="text-cc-text-secondary text-sm mb-3 flex-1">
                                    Bedah tuntas faktor topografi, penurunan muka tanah, dan cuaca ekstrem yang membuat ibu kota rentan.
                                </p>
                                <div className="flex items-center text-xs text-cc-text-muted font-mono mt-3 pt-3 border-t border-cc-border">
                                    <span>5 MIN READ</span>
                                </div>
                            </div>
                        </article>
                    </Link>

                    {/* Article Card 2: Mitigation */}
                    <Link href="/education/panduan-siaga-banjir" className="group">
                        <article className="bg-cc-surface rounded-lg overflow-hidden border border-cc-border hover:border-cc-border-active transition h-full flex flex-col">
                            <div className="h-40 bg-cc-elevated relative overflow-hidden flex items-center justify-center">
                                <span className="text-5xl">🎒</span>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                    <span className="text-white font-mono text-xs bg-cc-caution/80 px-2 py-1 rounded">SAFETY</span>
                                </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-base font-bold mb-2 group-hover:text-cc-cyan transition text-cc-text">Panduan Siaga & Mitigasi</h3>
                                <p className="text-cc-text-secondary text-sm mb-3 flex-1">
                                    Checklist evakuasi keluarga, barang wajib siaga, dan langkah kritis saat sirine berbunyi.
                                </p>
                                <div className="flex items-center text-xs text-cc-text-muted font-mono mt-3 pt-3 border-t border-cc-border">
                                    <span>7 MIN READ</span>
                                </div>
                            </div>
                        </article>
                    </Link>

                    {/* Article Card 3: Technology */}
                    <Link href="/education/teknologi-monitoring-banjir" className="group">
                        <article className="bg-cc-surface rounded-lg overflow-hidden border border-cc-border hover:border-cc-border-active transition h-full flex flex-col">
                            <div className="h-40 bg-cc-elevated relative overflow-hidden flex items-center justify-center">
                                <span className="text-5xl">📡</span>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                    <span className="text-white font-mono text-xs bg-blue-500/80 px-2 py-1 rounded">TECH</span>
                                </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-base font-bold mb-2 group-hover:text-cc-cyan transition text-cc-text">Teknologi & Cara Baca Data</h3>
                                <p className="text-cc-text-secondary text-sm mb-3 flex-1">
                                    Memahami sensor IoT, satelit, dan cara membaca status pintu air di dashboard noah.ai.
                                </p>
                                <div className="flex items-center text-xs text-cc-text-muted font-mono mt-3 pt-3 border-t border-cc-border">
                                    <span>6 MIN READ</span>
                                </div>
                            </div>
                        </article>
                    </Link>

                    {/* Article Card 4: Jakarta SEO */}
                    <Link href="/education/banjir-jakarta-realtime" className="group">
                        <article className="bg-cc-surface rounded-lg overflow-hidden border border-cc-border hover:border-cc-border-active transition h-full flex flex-col">
                            <div className="h-40 bg-cc-elevated relative overflow-hidden flex items-center justify-center">
                                <span className="text-5xl">🏙️</span>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                    <span className="text-white font-mono text-xs bg-cc-critical/80 px-2 py-1 rounded">LOKAL</span>
                                </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-base font-bold mb-2 group-hover:text-cc-cyan transition text-cc-text">Status Banjir Jakarta</h3>
                                <p className="text-cc-text-secondary text-sm mb-3 flex-1">
                                    Titik rawan Ciliwung, kondisi pompa air, dan info banjir rob Jakarta Utara realtime.
                                </p>
                                <div className="flex items-center text-xs text-cc-text-muted font-mono mt-3 pt-3 border-t border-cc-border">
                                    <span>5 MIN READ</span>
                                </div>
                            </div>
                        </article>
                    </Link>
                </div>
            </div>
        </PageShell>
    );
}
