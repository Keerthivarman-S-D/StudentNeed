import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  MessageSquare,
  Package,
  CheckCheck,
  Volume2,
  VolumeX,
  Globe,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { cn } from '../lib/utils';

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadTotal,
    soundEnabled,
    browserNotificationsEnabled,
    toggleSound,
    toggleBrowserNotifications,
    markNotificationAsRead,
    markChatAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif: (typeof notifications)[0]) => {
    markNotificationAsRead(notif.id);
    if (notif.chatId) {
      markChatAsRead(notif.chatId);
    }
    setIsOpen(false);
    navigate(notif.link);
  };

  const formatRelativeTime = (isoString: string) => {
    const diff = Math.max(0, Date.now() - new Date(isoString).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-white text-brand-charcoal transition-all hover:bg-zinc-50 hover:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20",
          isOpen && "border-brand-teal bg-brand-teal-light/40 text-brand-teal"
        )}
        aria-label={`Notifications${unreadTotal > 0 ? `, ${unreadTotal} unread` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        
        {unreadTotal > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white shadow-xs">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-brand-teal opacity-75 animate-ping pointer-events-none" />
          </>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-brand-border bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-brand-border/70 px-4 py-3 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-brand-charcoal">Notifications</span>
              {unreadTotal > 0 && (
                <span className="rounded-full bg-brand-teal-light text-brand-teal-hover border border-brand-teal-border px-2 py-0.5 text-[10px] font-bold">
                  {unreadTotal} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadTotal > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-brand-teal hover:text-brand-teal-hover transition-colors px-2 py-1 rounded-md hover:bg-brand-teal-light"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-brand-muted">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-zinc-400">
                  <Sparkles className="h-5 w-5 text-brand-teal" />
                </div>
                <p className="text-sm font-semibold text-brand-charcoal">All caught up!</p>
                <p className="text-xs text-brand-muted mt-0.5">
                  You have no unread messages or trade notifications.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-slate-50/80",
                    !notif.read && "bg-brand-teal-light/20"
                  )}
                >
                  {/* Type Icon */}
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs",
                      notif.type === 'chat'
                        ? "bg-brand-teal-light text-brand-teal border border-brand-teal-border"
                        : notif.type === 'reservation'
                        ? "bg-blue-50 text-blue-600 border border-blue-200"
                        : "bg-slate-100 text-zinc-600"
                    )}
                  >
                    {notif.type === 'chat' ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-brand-charcoal truncate">
                        {notif.title}
                      </p>
                      <span className="flex items-center gap-0.5 text-[10px] text-brand-muted shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-brand-muted line-clamp-2 leading-snug">
                      {notif.message}
                    </p>
                  </div>

                  {/* Unread indicator pill */}
                  {!notif.read && (
                    <span className="h-2 w-2 rounded-full bg-brand-teal shrink-0 mt-1.5 ring-2 ring-white" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Settings / Preference Footer */}
          <div className="flex items-center justify-between border-t border-brand-border/60 bg-slate-50/70 px-4 py-2.5 text-xs text-brand-muted">
            <div className="flex items-center gap-3">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  "flex items-center gap-1.5 transition-colors rounded px-1.5 py-0.5",
                  soundEnabled
                    ? "text-brand-charcoal hover:text-brand-teal"
                    : "text-zinc-400 hover:text-zinc-600"
                )}
                title={soundEnabled ? 'Chime sound is active' : 'Chime sound is muted'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-brand-teal" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
                )}
                <span className="text-[11px] font-medium">
                  {soundEnabled ? 'Sound ON' : 'Muted'}
                </span>
              </button>

              {/* Browser Alert Toggle */}
              <button
                type="button"
                onClick={toggleBrowserNotifications}
                className={cn(
                  "flex items-center gap-1.5 transition-colors rounded px-1.5 py-0.5",
                  browserNotificationsEnabled
                    ? "text-brand-charcoal hover:text-brand-teal"
                    : "text-zinc-400 hover:text-zinc-600"
                )}
                title="Toggle browser desktop notifications"
              >
                <Globe
                  className={cn(
                    "h-3.5 w-3.5",
                    browserNotificationsEnabled ? "text-brand-teal" : "text-zinc-400"
                  )}
                />
                <span className="text-[11px] font-medium">
                  {browserNotificationsEnabled ? 'Alerts ON' : 'Alerts OFF'}
                </span>
              </button>
            </div>

            <span className="text-[10px] text-zinc-400 font-medium">
              StudentNeed Alerts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
