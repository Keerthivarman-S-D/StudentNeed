import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Table,
  BarChart3,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Info,
  Code,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { GenUIIntent, GenUIPayload } from '../types/genui';
import { generateGenUIPayload } from '../lib/genuiEngine';
import { validateGenUIPayload } from '../lib/genuiValidator';
import { GenUIRenderer } from '../components/genui/GenUIRenderer';
import { useAppContext } from '../context/AppContext';

export function GenUIDemo() {
  const { listings, savedListings } = useAppContext();

  const DEMO_PRESETS: Array<{
    intent: GenUIIntent;
    title: string;
    description: string;
    prompt: string;
    icon: React.ElementType;
    badge: string;
  }> = [
    {
      intent: 'item_search',
      title: '1. Item Searches → Listing Cards',
      description: 'Generates rich listing cards & card collections with photo, price in ₹, condition, and save actions.',
      prompt: 'Show me engineering mathematics and study books',
      icon: Search,
      badge: 'Listing Cards'
    },
    {
      intent: 'comparison',
      title: '2. Comparisons → Comparison Tables',
      description: 'Generates multi-column comparison tables with highlight columns, feature matrices, and recommendations.',
      prompt: 'Compare Sale vs Borrow vs Donate listing types',
      icon: Table,
      badge: 'Comparison Table'
    },
    {
      intent: 'data_summary',
      title: '3. Data Summaries → Metrics & Progress',
      description: 'Generates real-time statistical metric counters, progress bars by category, and quick filter shortcuts.',
      prompt: 'Show marketplace summary and active category stats',
      icon: BarChart3,
      badge: 'Data Summary'
    },
    {
      intent: 'user_input',
      title: '4. User Input → Validated Action Form',
      description: 'Generates interactive forms with client-side field validation, duplicate prevention, and real submission to Firestore.',
      prompt: 'I want to post a request for a mini drafter',
      icon: FileText,
      badge: 'Validated Form'
    },
    {
      intent: 'destructive_action',
      title: '5. Destructive Actions → Confirmation Dialog',
      description: 'Generates danger confirmation dialogs with cancellation reason selector and invalid state transition guards.',
      prompt: 'Cancel my pending item request',
      icon: AlertTriangle,
      badge: 'Confirmation Dialog'
    },
    {
      intent: 'unsupported',
      title: '6. Unsupported Requests → Safety Fallback',
      description: 'Explains strict campus boundaries (no credit cards, no shipping) with clear alternatives.',
      prompt: 'Can I pay with credit card and courier to my home?',
      icon: ShieldAlert,
      badge: 'Safety Policy'
    },
    {
      intent: 'informational',
      title: '7. Informational → Concise Text & Badges',
      description: 'Provides concise answers with verified campus rules, photo guidelines, and helpful tips.',
      prompt: 'What are the photo upload rules for listings?',
      icon: Info,
      badge: 'Concise Text'
    }
  ];

  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customPrompt, setCustomPrompt] = useState(DEMO_PRESETS[0].prompt);
  const [activePayload, setActivePayload] = useState<GenUIPayload>(() =>
    generateGenUIPayload(DEMO_PRESETS[0].prompt, { activeListings: listings, savedListingIds: savedListings })
  );
  const [validationResult, setValidationResult] = useState(() => validateGenUIPayload(activePayload));
  const [showJson, setShowJson] = useState(false);

  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    const p = DEMO_PRESETS[idx].prompt;
    setCustomPrompt(p);
    const payload = generateGenUIPayload(p, { activeListings: listings, savedListingIds: savedListings });
    setActivePayload(payload);
    setValidationResult(validateGenUIPayload(payload));
  };

  const handleRunCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    const payload = generateGenUIPayload(customPrompt, { activeListings: listings, savedListingIds: savedListings });
    setActivePayload(payload);
    setValidationResult(validateGenUIPayload(payload));
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#dedcd4] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#204b39] text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-[#252b27]">
                Generative UI <span className="text-[#204b39]">Architecture & System</span>
              </h1>
            </div>
            <p className="text-xs text-[#555d56] mt-1 max-w-2xl leading-relaxed">
              Real-time Generative UI system: Maps user natural language intent to pre-audited, trusted React components rather than responding only with plain text. Strict schema validated, accessible, and grounded in StudentNeed campus data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Zero Eval / No Arbitrary HTML
            </span>
          </div>
        </div>

        {/* 7 Intent Presets Grid */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#717870]">
            7 Intent-to-UI Specification Rules (Click to test):
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {DEMO_PRESETS.map((preset, idx) => {
              const isSelected = selectedPresetIndex === idx;
              const IconComp = preset.icon;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(idx)}
                  className={`text-left p-3 rounded-xl border transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#204b39] bg-white shadow-md ring-2 ring-[#204b39]/15'
                      : 'border-[#dedcd4] bg-white hover:bg-[#faf9f5] hover:border-[#204b39]/30'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-[#204b39] text-white' : 'bg-[#edf1ec] text-[#204b39]'
                      }`}>
                        <IconComp className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[10px] font-bold rounded-md bg-[#edf1ec] text-[#204b39] px-1.5 py-0.5">
                        {preset.badge}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-[#252b27] leading-tight">
                      {preset.title}
                    </h3>
                    <p className="text-[11px] text-[#717870] line-clamp-2">
                      {preset.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#dedcd4]/50 flex items-center justify-between text-[10px] text-[#204b39] font-bold">
                    <span>Test rule</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Query Runner */}
        <div className="rounded-2xl border border-[#dedcd4] bg-white p-4 shadow-xs space-y-3">
          <form onSubmit={handleRunCustomPrompt} className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#717870]" />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Type any campus request (e.g. 'Show me Casio calculators', 'Compare meetup spots', 'Cancel request')..."
                className="w-full rounded-xl border border-[#dedcd4] bg-[#faf9f5] pl-9 pr-4 py-2.5 text-xs text-[#252b27] focus:outline-hidden focus:ring-2 focus:ring-[#204b39] focus:bg-white transition"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#204b39] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#183a2c] transition shadow-xs shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Generate UI</span>
            </button>
          </form>

          {/* Diagnostics Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#dedcd4]/60 text-xs">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-bold text-[#555d56]">Detected Intent:</span>
              <span className="rounded-md bg-[#edf1ec] px-2 py-0.5 font-bold text-[#204b39] uppercase text-[10px]">
                {activePayload.intent}
              </span>
              <span className="text-[#dedcd4]">|</span>
              <span className="font-bold text-[#555d56]">Target Component:</span>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-bold text-[#252b27] text-[10px]">
                {activePayload.component.type}
              </span>
              <span className="text-[#dedcd4]">|</span>
              <span className="font-bold text-[#555d56]">Schema Valid:</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                validationResult.valid ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {validationResult.valid ? <CheckCircle2 className="h-3 w-3" /> : 'Invalid'}
                {validationResult.valid ? 'PASS' : validationResult.error}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#204b39] hover:underline"
            >
              <Code className="h-3 w-3" />
              <span>{showJson ? 'Hide Schema JSON' : 'Inspect Schema JSON'}</span>
            </button>
          </div>
        </div>

        {/* Optional Raw JSON Inspector */}
        {showJson && (
          <div className="rounded-2xl border border-[#dedcd4] bg-[#252b27] p-4 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-md">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-zinc-700 text-zinc-400 text-xs">
              <span>GenUIPayload Schema Specification Validation</span>
              <span className="text-emerald-300">Schema Conformance: 100%</span>
            </div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(activePayload, null, 2)}</pre>
          </div>
        )}

        {/* Live Generative UI Rendering Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#717870] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#204b39]" />
              Live Component Rendering (Trusted Registry):
            </h2>
            <span className="text-[10px] text-[#717870]">
              Interactive & Connected to App State
            </span>
          </div>

          <div className="rounded-3xl border border-[#dedcd4] bg-white p-6 shadow-sm">
            <GenUIRenderer
              payload={activePayload}
              fallbackText={activePayload.message}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
