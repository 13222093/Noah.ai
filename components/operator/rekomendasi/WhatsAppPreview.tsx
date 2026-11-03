'use client';

// Preview of the operator WhatsApp group as it would look if the
// recommendations were sent. Nothing is sent: Noah has no messaging
// integration in this demo, and messages only ever go to operator groups
// (guardrail 1). Text is rendered exactly from Recommendation.whatsappText,
// with WhatsApp's own formatting (*bold*, _italic_, ~strike~, `mono`).

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { EyeOff, Users } from 'lucide-react';
import type { Recipient, Recommendation } from '@/lib/ops/types';
import { cn } from '@/lib/utils';
import { formatWibDate, formatWibTime } from '@/lib/time';
import { RECIPIENT_GROUP, tokenColor } from '@/components/operator/ops/meta';

/*
 * Scoped palette exception (docs/design/palette.md): the chat frame imitates
 * WhatsApp's own dark theme so the operator recognises the message as it will
 * look in the group. These colours are used only inside the chat frame below;
 * everything around it (the "tidak dikirim" label, the pane, the selection
 * ring) uses the app tokens. This file is allow-listed in the `no-raw-palette`
 * guardrail (scripts/check-guardrails.mjs) for that reason only.
 */
const WA = {
  chatBg: '#0b141a',
  headerBg: '#202c33',
  bubbleBg: '#202c33',
  systemBg: '#182229',
  inputBg: '#2a3942',
  text: '#e9edef',
  textMuted: '#8696a0',
  link: '#53bdeb',
  brandBg: 'rgba(0, 168, 132, 0.25)',
  brandIcon: '#25d366',
  systemText: '#ffd279',
  codeBg: 'rgba(0, 0, 0, 0.3)',
  frameBorder: 'rgba(255, 255, 255, 0.1)',
  dots: 'rgba(255, 255, 255, 0.035)',
  dots2: 'rgba(255, 255, 255, 0.025)',
} as const;

const URL_RE = /(https?:\/\/[^\s]+|\/operator\/(?:polder|rekomendasi)\/?[^\s]*)/g;
const FORMAT_RE = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

function renderLink(raw: string, key: string): React.ReactNode {
  // Strip trailing punctuation from the match.
  const m = /^(.*?)([.,;:!?)]*)$/.exec(raw);
  const url = m?.[1] ?? raw;
  const tail = m?.[2] ?? '';
  let internal: string | null = null;
  try {
    const u = new URL(url, 'http://noah.local');
    if (/^\/operator\/(polder|rekomendasi)(\/|$)/.test(u.pathname)) internal = `${u.pathname}${u.search}`;
  } catch {
    internal = null;
  }
  return (
    <React.Fragment key={key}>
      {internal ? (
        <Link href={internal} className="break-all underline-offset-2 hover:underline" style={{ color: WA.link }}>
          {url}
        </Link>
      ) : (
        <span className="break-all" style={{ color: WA.link }}>
          {url}
        </span>
      )}
      {tail}
    </React.Fragment>
  );
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(URL_RE).forEach((chunk, i) => {
    if (!chunk) return;
    if (i % 2 === 1) {
      out.push(renderLink(chunk, `${keyBase}-u${i}`));
      return;
    }
    chunk.split(FORMAT_RE).forEach((part, j) => {
      if (!part) return;
      const k = `${keyBase}-${i}-${j}`;
      if (j % 2 === 1) {
        const inner = part.slice(1, -1);
        if (part.startsWith('*')) out.push(<strong key={k} className="font-semibold">{inner}</strong>);
        else if (part.startsWith('_')) out.push(<em key={k}>{inner}</em>);
        else if (part.startsWith('~')) out.push(<s key={k}>{inner}</s>);
        else
          out.push(
            <code key={k} className="rounded-sm px-1 font-mono text-[12px]" style={{ backgroundColor: WA.codeBg }}>
              {inner}
            </code>,
          );
      } else {
        out.push(<React.Fragment key={k}>{part}</React.Fragment>);
      }
    });
  });
  return out;
}

export function WhatsAppText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {renderInline(line, `l${i}`)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

function hhmm(iso: string) {
  return formatWibTime(iso).replace(' WIB', '');
}

export function WhatsAppPreview({
  recipient,
  messages,
  selectedId,
  className,
}: {
  recipient: Recipient | null;
  /** Messages for this group up to the replay time, oldest first. */
  messages: Recommendation[];
  selectedId: string | null;
  className?: string;
}) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const group = recipient ? RECIPIENT_GROUP[recipient] : null;

  // Centre the selected message inside the chat only (never scroll the page).
  // Runs a frame later so it also works while a dialog is still opening.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const c = scrollRef.current;
      const el = selectedRef.current;
      if (!c) return;
      c.scrollTop = el ? el.offsetTop - c.clientHeight / 2 + el.clientHeight / 2 : c.scrollHeight;
    });
    return () => window.cancelAnimationFrame(id);
  }, [selectedId, messages.length]);

  let lastDate = '';

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Honesty label: app tokens (violet), not WhatsApp colours. */}
      <div role="note" className="mb-2 flex items-center gap-2 rounded-lg border border-white/5 bg-op-sim/10 px-2.5 py-1.5 text-[11px] text-op-fg">
        <EyeOff className="h-3.5 w-3.5 shrink-0 text-op-sim" aria-hidden />
        <span>
          <strong className="font-bold uppercase tracking-wider text-op-sim">Pratinjau – tidak dikirim.</strong> Begini
          pesan akan tampil di grup operator. Demo ini tidak mengirim pesan apa pun.
        </span>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
        style={{ backgroundColor: WA.chatBg, borderColor: WA.frameBorder }}
      >
        {/* Group header */}
        <div className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: WA.headerBg }}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: WA.brandBg, color: WA.brandIcon }}
          >
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium" style={{ color: WA.text }}>
              {group?.name ?? 'Grup operator'}
            </p>
            <p className="truncate text-[12px]" style={{ color: WA.textMuted }}>
              {group?.members ?? 'Pilih rekomendasi untuk melihat pesannya'}
            </p>
          </div>
        </div>

        {/* Chat */}
        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
          style={{
            // WhatsApp's dotted wallpaper (part of the imitation, not app chrome).
            backgroundImage: `radial-gradient(${WA.dots} 1px, transparent 1px), radial-gradient(${WA.dots2} 1px, transparent 1px)`,
            backgroundSize: '22px 22px, 22px 22px',
            backgroundPosition: '0 0, 11px 11px',
          }}
        >
          <div
            className="mx-auto mb-2 max-w-[90%] rounded-[8px] px-3 py-1.5 text-center text-[11.5px] leading-snug"
            style={{ backgroundColor: WA.systemBg, color: WA.systemText }}
          >
            Pesan di grup ini hanya untuk petugas. Noah memberi saran; keputusan tetap di tangan operator.
          </div>

          {messages.length === 0 ? (
            <p className="py-10 text-center text-xs" style={{ color: WA.textMuted }}>
              Belum ada pesan sampai waktu replay ini.
            </p>
          ) : (
            messages.map((m) => {
              const date = formatWibDate(m.provenance.ts);
              const showDate = date !== lastDate;
              lastDate = date;
              const selected = m.id === selectedId;
              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex justify-center py-1">
                      <span
                        className="rounded-[6px] px-2.5 py-1 text-[11.5px] uppercase"
                        style={{ backgroundColor: WA.systemBg, color: WA.textMuted }}
                      >
                        {date}
                      </span>
                    </div>
                  )}
                  <div ref={selected ? selectedRef : undefined} className="flex justify-start">
                    <div
                      className="relative max-w-[88%] rounded-[8px] rounded-tl-none px-2.5 pb-1.5 pt-1 text-[14px] leading-[1.35]"
                      style={{
                        backgroundColor: WA.bubbleBg,
                        color: WA.text,
                        // Selected message: the app's selection accent (a ring, not a shadow effect).
                        boxShadow: selected ? `0 0 0 2px ${tokenColor('accent')}` : undefined,
                      }}
                    >
                      <p className="text-[12.5px] font-medium" style={{ color: WA.link }}>
                        Noah AI
                      </p>
                      <div className="whitespace-pre-wrap break-words">
                        <WhatsAppText text={m.whatsappText} />
                      </div>
                      {/* No delivery ticks: nothing was sent. */}
                      <p
                        className="mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums"
                        style={{ color: WA.textMuted }}
                      >
                        {hhmm(m.provenance.ts)}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: WA.headerBg }}>
          <div className="flex-1 rounded-full px-4 py-2 text-[13px]" style={{ backgroundColor: WA.inputBg, color: WA.textMuted }}>
            Pratinjau saja: tidak dapat membalas
          </div>
        </div>
      </div>
    </div>
  );
}
