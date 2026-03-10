'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BrainCircuit,
  Camera,
  Video,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePanel } from './PanelContext';

const aiToolItems = [
  {
    id: 'flood-predict',
    title: 'LSTM Flood Prediction',
    description: 'Predict water levels using machine learning',
    icon: BrainCircuit,
    href: '/flood-predict',
    color: 'text-indigo-400',
  },
  {
    id: 'visual-verify',
    title: 'Visual Verification (YOLO)',
    description: 'Upload images to detect flooding',
    icon: Camera,
    href: '/visual-verify',
    color: 'text-violet-400',
  },
  {
    id: 'cctv',
    title: 'CCTV Monitoring',
    description: 'Live camera feeds with flood detection overlay',
    icon: Video,
    href: '/cctv-simulation',
    color: 'text-fuchsia-400',
  },
];

export function AIToolsPanel() {
  const { resetPanel } = usePanel();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cc-border">
        <button onClick={resetPanel} className="text-cc-text-muted hover:text-cc-text">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <BrainCircuit className="w-4 h-4 text-cc-cyan" />
        <h2 className="text-sm font-semibold text-cc-text font-heading">AI Tools</h2>
      </div>

      {/* AI Health Status */}
      <div className="px-3 py-3 border-b border-cc-border">
        <div className="flex items-center gap-1.5 mb-2">
          <Cpu className="w-3.5 h-3.5 text-cc-cyan" />
          <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
            Model Health
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between p-2 bg-cc-elevated border border-cc-border rounded">
            <span className="text-xs text-cc-text">LSTM Predictor</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cc-safe" />
              <span className="text-[10px] font-mono text-cc-safe">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 bg-cc-elevated border border-cc-border rounded">
            <span className="text-xs text-cc-text">YOLO Detector</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cc-safe" />
              <span className="text-[10px] font-mono text-cc-safe">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tool List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {aiToolItems.map((tool) => (
          <Link key={tool.id} href={tool.href}>
            <div className="flex items-center gap-3 p-3 bg-cc-elevated border border-cc-border rounded hover:border-cc-border-active transition-colors cursor-pointer group">
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center bg-cc-surface border border-cc-border',
                'group-hover:border-cc-cyan/30'
              )}>
                <tool.icon className={cn('w-5 h-5', tool.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-cc-text">{tool.title}</p>
                <p className="text-[10px] text-cc-text-muted mt-0.5">{tool.description}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-cc-text-muted group-hover:text-cc-cyan flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
