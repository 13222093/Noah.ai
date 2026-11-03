'use client';

// Record what the operator did with a recommendation (03 workflow step 4):
// followed, deferred or ignored, with an optional note. In the demo the
// answer is kept in this browser only.

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Acknowledgement, OperatorAction, Recommendation } from '@/lib/ops/types';
import { useAcknowledgements } from '@/lib/ops/hooks';
import { usePlaybackStore } from '@/lib/ops/playback';
import { cn } from '@/lib/utils';
import { formatWibTime } from '@/lib/time';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/operator/ui/dialog';
import { Textarea } from '@/components/operator/ui/textarea';
import { OPERATOR_ACTION_META } from '@/components/operator/ops/meta';

const ACTIONS: OperatorAction[] = ['followed', 'deferred', 'ignored'];
export const DEMO_OPERATOR = 'Operator Posko (demo)';

function AckForm({
  rec,
  existing,
  onDone,
}: {
  rec: Recommendation;
  existing?: Acknowledgement;
  onDone: () => void;
}) {
  const { acknowledge } = useAcknowledgements();
  const [action, setAction] = useState<OperatorAction | null>(existing?.action ?? null);
  const [note, setNote] = useState(existing?.note ?? '');

  const save = () => {
    if (!action) return;
    const nowMs = usePlaybackStore.getState().nowMs;
    acknowledge({
      recommendationId: rec.id,
      // In the replay the answer is stamped with the replay time.
      at: new Date(nowMs ?? Date.parse(rec.provenance.ts)).toISOString(),
      by: DEMO_OPERATOR,
      action,
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <>
      <div role="radiogroup" aria-label="Tindakan operator" className="grid gap-2">
        {ACTIONS.map((a) => {
          const meta = OPERATOR_ACTION_META[a];
          const active = action === a;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setAction(a)}
              className={cn(
                'flex items-start gap-3 rounded border px-3 py-2 text-left transition-colors',
                active ? 'border-op-accent bg-op-accent/10' : 'border-op-border bg-op-surface-1 hover:border-op-border-strong',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  active ? 'border-op-accent-fill bg-op-accent-fill text-op-on-accent' : 'border-op-fg-3',
                )}
                aria-hidden
              >
                {active && <Check className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-op-fg">{meta.label}</span>
                <span className="block text-xs text-op-fg-2">{meta.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <label className="block">
        <span className="text-xs font-medium text-op-fg-2">Catatan (opsional)</span>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Misalnya: 2 pompa dinyalakan pukul 05.10, menunggu operator shift pagi."
          className="mt-1 text-sm"
        />
      </label>
      <DialogFooter className="gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-op-border-strong bg-op-surface-3 px-3 py-1.5 text-sm text-op-fg hover:border-op-fg-3"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!action}
          className="rounded bg-op-accent-fill px-3 py-1.5 text-sm font-semibold text-op-on-accent hover:bg-op-accent-fill/90 disabled:bg-op-surface-3 disabled:text-op-fg-disabled"
        >
          Simpan tanggapan
        </button>
      </DialogFooter>
    </>
  );
}

export function AckDialog({
  rec,
  polderName,
  open,
  onOpenChange,
}: {
  rec: Recommendation | null;
  polderName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { acks } = useAcknowledgements();
  const existing = rec ? acks[rec.id] : undefined;

  return (
    <Dialog open={open && !!rec} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {rec && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-base">Tanggapi rekomendasi</DialogTitle>
              <DialogDescription>
                {rec.title} · {polderName} · terbit {formatWibTime(rec.provenance.ts)}. Catat apa yang Anda putuskan;
                Noah hanya menyarankan.
              </DialogDescription>
            </DialogHeader>
            {/* Remount per recommendation so the form starts from its saved answer. */}
            <AckForm key={`${rec.id}-${existing?.at ?? 'new'}`} rec={rec} existing={existing} onDone={() => onOpenChange(false)} />
            <p className="text-[11px] text-op-fg-3">Demo: tanggapan disimpan di peramban ini saja.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
