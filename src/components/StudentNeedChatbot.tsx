import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Send, 
  RotateCcw, 
  ChevronDown, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CHAT_ENDPOINTS } from '../config/api';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';
import { GenUIChatMessageItem, GenUIPayload } from '../types/genui';
import { GenUIRenderer } from './genui/GenUIRenderer';
import { useAppContext } from '../context/AppContext';

export type ChatMessageItem = GenUIChatMessageItem;

const INITIAL_GREETING: GenUIChatMessageItem = {
  id: 'msg_welcome',
  role: 'assistant',
  text: "Hello! I'm the StudentNeed Campus Guide with dynamic Generative UI. I can help you search marketplace listings, compare listing types & meetup spots, view marketplace summaries, post requests, or answer questions about safe campus trades. How can I help you today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  source: 'knowledge_base',
  genui: {
    intent: 'informational',
    message: "Welcome to StudentNeed! Here's how our verified peer-to-peer campus exchange works:",
    component: {
      type: 'text',
      headline: 'Find → Connect → Meet Campus Flow',
      body: '1. **Find**: Browse items or post an item request.\n2. **Connect**: Chat with peers & reserve.\n3. **Meet**: Safe in-person handoff at approved campus landmarks.',
      badges: [
        { label: 'Anna Univ Only', variant: 'success' },
        { label: 'Generative UI Enabled', variant: 'info' }
      ],
      tips: [
        'Ask to search items, compare listing types, or see campus statistics',
        'Try typing "Show Casio calculator" or "Compare meetup spots"'
      ]
    },
    suggestions: [
      "Search for textbooks",
      "Compare Sale vs Borrow vs Donate",
      "Compare campus meetup locations",
      "Show marketplace stats",
      "Post a request for an item"
    ]
  }
};

const SUGGESTED_QUESTIONS = [
  "Search for textbooks",
  "Compare Sale vs Borrow vs Donate",
  "Compare campus meetup locations",
  "Show marketplace stats",
  "Post a request for an item",
  "What are the photo rules?",
  "How does Find → Connect → Meet work?",
  "Are online payments supported?"
];

export function StudentNeedChatbot() {
  const { listings, savedListings } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<GenUIChatMessageItem[]>([INITIAL_GREETING]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Focus input when opened
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    if (text.length > 600) {
      setError('Your message is too long (maximum 600 characters).');
      return;
    }

    setError(null);
    setInputText('');
    setHasInteracted(true);

    const userMessage: GenUIChatMessageItem = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build brief recent conversation history for context
      const historyPayload = messages
        .filter((m) => m.id !== 'msg_welcome')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text
        }));

      const res = await fetch(CHAT_ENDPOINTS.assistant, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          history: historyPayload
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'The campus assistant is temporarily unavailable.');
      }

      const botReply = data.reply || "I'm sorry, I couldn't process that response. Please try asking in a different way.";

      const assistantMessage: GenUIChatMessageItem = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source || 'knowledge_base',
        genui: data.genui // Dynamic Generative UI payload
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.warn('[Campus Assistant Error]:', err?.message || err);
      setError('The campus assistant is temporarily unavailable. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetConversation = () => {
    setMessages([INITIAL_GREETING]);
    setError(null);
    setInputText('');
  };

  // Helper to format text with clean line breaks and basic emphasis
  const renderMessageContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      // Basic markdown bold replacement (**text**)
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <React.Fragment key={idx}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
          {idx < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  // Determine active suggestion chips (either from latest GenUI payload or defaults)
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeSuggestions = lastAssistantMessage?.genui?.suggestions && lastAssistantMessage.genui.suggestions.length > 0
    ? lastAssistantMessage.genui.suggestions
    : SUGGESTED_QUESTIONS.slice(0, 4);

  return (
    <>
      {/* Floating Launcher Trigger (Desktop: bottom-6 right-6; Mobile: bottom-20 right-4 above bottom nav) */}
      {!isOpen && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 transition-all">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open StudentNeed Campus Assistant"
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#204b39] text-white shadow-xl shadow-[#204b39]/25 transition-all hover:scale-105 hover:bg-[#183a2c] active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-[#204b39] focus:ring-offset-2"
          >
            <Bot className="h-6 w-6 transition-transform group-hover:rotate-6" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#173e2d] ring-2 ring-white animate-pulse">
              <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
            </span>

            {/* Introductory Tooltip Pill */}
            {!hasInteracted && (
              <span className="absolute right-16 hidden md:flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#252b27] shadow-md border border-[#dedcd4] pointer-events-none animate-in fade-in slide-in-from-right-2 duration-300">
                <Sparkles className="h-3.5 w-3.5 text-[#204b39]" />
                Ask StudentNeed AI
              </span>
            )}
          </button>
        </div>
      )}

      {/* Floating Chatbot Drawer / Window */}
      {isOpen && (
        <div 
          role="dialog" 
          aria-label="StudentNeed Campus Assistant Chat"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl border border-[#dedcd4] transition-all animate-in fade-in zoom-in-95 duration-200",
            // Mobile: positioned neatly above the bottom nav bar with safe margins
            "inset-x-3 bottom-20 top-16 rounded-2xl",
            // Desktop: floating window with responsive expanded width mode for wide tables/cards
            isExpanded
              ? "md:inset-auto md:bottom-6 md:right-6 md:top-auto md:h-[660px] md:w-[580px] md:rounded-3xl"
              : "md:inset-auto md:bottom-6 md:right-6 md:top-auto md:h-[580px] md:w-[410px] md:rounded-3xl"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#204b39]/30 bg-[#173e2d] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20">
                <Bot className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold tracking-tight text-white leading-tight">StudentNeed Guide</h3>
                  <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
                    GenUI Active
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-none mt-0.5">Anna Univ Campus Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Expand / Minimize Desktop toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse view" : "Expand for wider cards & tables"}
                aria-label={isExpanded ? "Collapse view" : "Expand view"}
                className="hidden md:flex rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleResetConversation}
                title="Restart conversation"
                aria-label="Restart conversation"
                className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                aria-label="Minimize assistant"
                className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-[#faf9f5]">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col text-sm",
                    isUser ? "max-w-[85%] ml-auto items-end" : "w-full mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2.5 shadow-2xs leading-relaxed",
                      isUser
                        ? "bg-[#204b39] text-white rounded-2xl rounded-tr-xs"
                        : "bg-white text-[#252b27] border border-[#dedcd4] rounded-2xl rounded-tl-xs w-full"
                    )}
                  >
                    {renderMessageContent(msg.text)}

                    {/* Generative UI Component Injection */}
                    {!isUser && msg.genui && (
                      <GenUIRenderer
                        payload={msg.genui}
                        fallbackText={msg.text}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-[#717870] mt-1 px-1">
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.source === 'knowledge_base' && (
                      <span className="text-[9px] text-[#204b39] font-medium">• Verified</span>
                    )}
                    {!isUser && msg.source === 'ai' && (
                      <span className="text-[9px] text-emerald-700 font-medium flex items-center gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" /> AI Powered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* In-Flight Typing Indicator */}
            {isLoading && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-tl-xs bg-white border border-[#dedcd4] px-4 py-2.5 text-sm text-[#717870] shadow-2xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#204b39]" />
                <span className="text-xs">Generating interface components...</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-red-800">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span>Unable to complete request</span>
                </div>
                <p className="text-red-600 leading-normal">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                      handleSendMessage(lastUserMsg.text);
                    } else {
                      setError(null);
                    }
                  }}
                  className="text-[11px] font-semibold text-red-800 underline hover:text-red-900"
                >
                  Retry previous question
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Contextual Intent Suggestions Chips */}
          {!isLoading && (
            <div className="border-t border-[#dedcd4] bg-white px-3 py-2">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <p className="text-[10px] font-bold text-[#717870] uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-[#204b39]" />
                  Intent Suggestions
                </p>
                <span className="text-[9px] text-[#717870]">1-click prompt</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {activeSuggestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="shrink-0 rounded-full border border-[#dedcd4] bg-[#faf9f5] px-2.5 py-1 text-xs text-[#252b27] hover:bg-[#edf1ec] hover:text-[#204b39] hover:border-[#204b39] transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form Bar */}
          <div className="border-t border-[#dedcd4] bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask about listings, compare, post requests..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  maxLength={600}
                  className="w-full rounded-full border border-[#dedcd4] bg-[#faf9f5] px-4 py-2 text-xs text-[#252b27] placeholder:text-[#717870] focus:border-[#204b39] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#204b39] disabled:opacity-60 transition"
                />
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputText.trim()}
                className="h-9 w-9 rounded-full bg-[#204b39] text-white hover:bg-[#183a2c] disabled:opacity-40 shrink-0 shadow-xs"
                aria-label="Send question"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <div className="mt-1.5 flex items-center justify-between px-2 text-[10px] text-[#717870]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-[#204b39]" />
                Strict Schema Validated & Grounded
              </span>
              <span>{inputText.length}/600</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
