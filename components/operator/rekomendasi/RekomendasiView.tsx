'use client';

// Rekomendasi: every recommendation issued up to the replay time, newest
// first, with filters, the operator's answer (03 workflow step 4) and a
// preview of the WhatsApp group message (not sent).

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ClipboardCheck, RotateCcw, X } from 'lucide-react';
import type { Recipient, Recommendation } from '@/lib/ops/types';
import { useAcknowledgements, usePolders, useRecommendations } from '@/lib/ops/hooks';
import { usePlaybackStore } from '@/lib/ops/playback';
import { recStatus, type RecStatus } from '@/hooks/useOps';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/operator/ui/empty-state';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/operator/ui/dialog';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { RECIPIENT_LABEL } from '@/components/operator/ops/meta';
import { RecommendationCard } from './RecommendationCard';
import { AckDialog } from './AckDialog';
import { WhatsAppPreview } from './WhatsAppPreview';

type StatusFilter = 'semua' | RecStatus;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'semua', label: 'Semua' },
  { id: 'terbuka', label: 'Terbuka' },
  { id: 'ditanggapi', label: 'Ditanggapi' },
  { id: 'lewat', label: 'Lewat waktu' },
];

const selectCls =
  'h-8 rounded border border-op-border-strong bg-op-surface-2 px-2 text-xs text-op-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-accent';

function ResetDemoButton() {
  const { acks, reset } = useAcknowledgements();
  const [open, setOpen] = useState(false);
  const count = Object.keys(acks).length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={count === 0}
        className="inline-flex items-center gap-1.5 rounded border border-op-border-strong bg-op-surface-2 px-2.5 py-1 text-xs text-op-fg-2 hover:bg-op-surface-3 hover:text-op-fg disabled:text-op-fg-disabled disabled:hover:bg-op-surface-2"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Reset demo
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Hapus semua tanggapan demo?</DialogTitle>
            <DialogDescription>
              {count} tanggapan yang tersimpan di peramban ini akan dihapus sehingga demo bisa diulang dari awal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-op-border-strong bg-op-surface-3 px-3 py-1.5 text-sm text-op-fg hover:border-op-fg-3">
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded border border-op-danger bg-op-danger px-3 py-1.5 text-sm font-semibold text-op-on-danger hover:bg-op-danger/90"
            >
              Hapus tanggapan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RekomendasiView() {
  const pathname = usePathname();
  const params = useSearchParams();
  const recs = useRecommendations();
  const polders = usePolders();
  const { acks } = useAcknowledgements();
  const nowMs = usePlaybackStore((s) => s.nowMs);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [status, setStatus] = useState<StatusFilter>('semua');
  const [polder, setPolder] = useState<string>('semua');
  const [recipient, setRecipient] = useState<'semua' | Recipient>('semua');
  const [ackFor, setAckFor] = useState<Recommendation | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);

  const nameOf = (id: string) => polders.find((p) => p.id === id)?.name ?? id;

  const filtered = recs.filter(
    (r) =>
      (status === 'semua' || recStatus(r, acks[r.id], nowMs) === status) &&
      (polder === 'semua' || r.polderId === polder) &&
      (recipient === 'semua' || r.recipient === recipient),
  );

  const paramId = params.get('id');
  const selected = recs.find((r) => r.id === paramId) ?? filtered[0] ?? null;

  const groupMessages = selected ? recs.filter((r) => r.recipient === selected.recipient).reverse() : [];

  const counts: Record<RecStatus, number> = { terbuka: 0, ditanggapi: 0, lewat: 0 };
  for (const r of recs) counts[recStatus(r, acks[r.id], nowMs)] += 1;

  const select = (r: Recommendation) => {
    const q = new URLSearchParams(params.toString());
    q.set('id', r.id);
    // Native history keeps this view mounted (Next syncs useSearchParams with it).
    window.history.replaceState(null, '', `${pathname}?${q.toString()}`);
    if (!isDesktop) setMobilePreview(true);
  };

  const anySimulated = recs.some((r) => r.provenance.kind === 'simulated');
  const polderOptions = polders.filter((p) => recs.some((r) => r.polderId === p.id));

  return (
    <div className="flex min-h-full flex-col bg-op-page text-op-fg lg:h-full lg:min-h-0 lg:flex-row">
      {/* Queue */}
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <header className="space-y-2.5 border-b border-op-border bg-op-surface-1 px-4 pb-3 pt-3 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-op-fg-3" aria-hidden />
                <h1 className="font-heading text-lg font-bold">Rekomendasi</h1>
                {anySimulated && <SimulasiBadge />}
              </div>
              <p className="mt-1 text-xs text-op-fg-2">
                Saran untuk operator, terbaru di atas. Keputusan di tangan operator; catat tanggapan Anda pada tiap saran.
              </p>
            </div>
            <ResetDemoButton />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div role="radiogroup" aria-label="Status" className="inline-flex flex-wrap rounded border border-op-border bg-op-surface-2 p-0.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={status === f.id}
                  onClick={() => setStatus(f.id)}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                    status === f.id ? 'bg-op-accent-fill text-op-on-accent' : 'text-op-fg-2 hover:bg-op-surface-3 hover:text-op-fg',
                  )}
                >
                  {f.label}
                  {f.id !== 'semua' && <span className="ml-1 tabular-nums opacity-70">{counts[f.id]}</span>}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-op-fg-2">
              Polder
              <select value={polder} onChange={(e) => setPolder(e.target.value)} className={selectCls}>
                <option value="semua">Semua</option>
                {polderOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-op-fg-2">
              Penerima
              <select value={recipient} onChange={(e) => setRecipient(e.target.value as 'semua' | Recipient)} className={selectCls}>
                <option value="semua">Semua</option>
                {(Object.keys(RECIPIENT_LABEL) as Recipient[]).map((r) => (
                  <option key={r} value={r}>
                    {RECIPIENT_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div className="px-4 py-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {recs.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Belum ada rekomendasi"
              description="Sampai waktu replay ini belum ada saran. Rekomendasi muncul saat peluang banjir atau kondisi pompa memenuhi aturan pemicu."
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Tidak ada yang cocok dengan filter" />
          ) : (
            <ul className="mx-auto max-w-3xl space-y-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <RecommendationCard
                    rec={r}
                    polderName={nameOf(r.polderId)}
                    ack={acks[r.id]}
                    status={recStatus(r, acks[r.id], nowMs)}
                    selected={selected?.id === r.id}
                    onSelect={() => select(r)}
                    onAck={() => setAckFor(r)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* WhatsApp preview: side pane on desktop, dialog on smaller screens */}
      {isDesktop ? (
        <aside className="flex min-h-0 w-[440px] shrink-0 flex-col border-l border-op-border bg-op-surface-1 p-3" aria-label="Pratinjau pesan WhatsApp">
          <WhatsAppPreview recipient={selected?.recipient ?? null} messages={groupMessages} selectedId={selected?.id ?? null} />
        </aside>
      ) : (
        <Dialog open={mobilePreview && !!selected} onOpenChange={setMobilePreview}>
          <DialogContent className="flex h-[88dvh] max-w-[440px] flex-col gap-0 bg-op-surface-1 p-3 [&>button:last-child]:hidden">
            <DialogHeader className="mb-2 flex-row items-center justify-between space-y-0">
              <DialogTitle className="text-sm">Pratinjau WhatsApp</DialogTitle>
              <button
                type="button"
                onClick={() => setMobilePreview(false)}
                className="rounded-sm p-1 text-op-fg-3 hover:bg-op-surface-3 hover:text-op-fg"
                aria-label="Tutup pratinjau"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogHeader>
            <DialogDescription className="sr-only">Pesan tidak dikirim; ini hanya pratinjau.</DialogDescription>
            <WhatsAppPreview
              className="min-h-0 flex-1"
              recipient={selected?.recipient ?? null}
              messages={groupMessages}
              selectedId={selected?.id ?? null}
            />
          </DialogContent>
        </Dialog>
      )}

      <AckDialog
        rec={ackFor}
        polderName={ackFor ? nameOf(ackFor.polderId) : ''}
        open={!!ackFor}
        onOpenChange={(o) => !o && setAckFor(null)}
      />
    </div>
  );
}
