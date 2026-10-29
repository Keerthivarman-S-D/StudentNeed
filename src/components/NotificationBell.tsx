import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  MessageSquare,
  Package,
  Bookmark,
  CheckCheck,
  Check,
  Volume2,
  VolumeX,
  Globe,
  Clock,
  Sparkles,
  X,
  HelpCircle,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { cn } from '../lib/utils';
import { AppNotification } from '../types';

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadTotal,
    isLoading,
    hasMore,
    loadMore,
    soundEnabled,
    browserNotificationsEnabled,
    toggleSound,
    toggleBrowserNotifications,
    markNotificationAsRead,
    markChatAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    if (notif.chatId || notif.targetType === 'chat') {
      const cid = notif.chatId || notif.targetId;
      if (cid) markChatAsRead(cid);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.targetType === 'chat' && notif.targetId) {
      navigate(`/chat/${notif.targetId}`);
    } else if (notif.targetType === 'reservation') {
      navigate('/reserved');
    } else if (notif.targetType === 'listing' && notif.targetId) {
      navigate(`/listing/${notif.targetId}`);
    } else if (notif.targetType === 'request') {
      navigate('/requests');
    } else {
      navigate('/');
    }
  };


  const handleSingleMarkRead = (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    markNotificationAsRead(notifId);
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'just now';
    const diff = Math.max(0, Date.now() - new Date(isoString).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const renderIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="h-4 w-4" />;
      case 'reservation':
        return <Package className="h-4 w-4" />;
      case 'request':
        return <HelpCircle className="h-4 w-4" />;
      case 'listing':
        return <Bookmark className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getIconBadgeStyles = (type: string) => {
    switch (type) {
      case 'chat':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'reservation':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'request':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'listing':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-zinc-600 border-zinc-200';
    }
  };

  return (
    <div className={cn("relative inline-block", isOpen && "z-50")} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="notification-bell-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border border-[#dedcd4] bg-white text-[#252b27] transition-all hover:bg-zinc-50 hover:border-[#204b39] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39]/30 focus-visible:border-[#204b39] cursor-pointer",
          isOpen && "border-[#204b39] bg-[#edf1ec] text-[#204b39]"
        )}
        aria-label={`Notifications${unreadTotal > 0 ? `, ${unreadTotal} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />

        {unreadTotal > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#204b39] px-1 text-[10px] font-bold text-white shadow-xs">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#204b39] opacity-60 animate-ping pointer-events-none" />
          </>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notification Center"
          className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] rounded-2xl border border-[#dedcd4] bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="border-b border-[#dedcd4]/80 px-4 py-3 bg-[#faf9f5]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#252b27]">Notifications</span>
                {unreadTotal > 0 ? (
                  <span className="rounded-full bg-[#edf1ec] text-[#204b39] border border-[#204b39]/20 px-2 py-0.5 text-[10px] font-bold">
                    {unreadTotal} new
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 text-[#717870] px-2 py-0.5 text-[10px] font-medium">
                    All caught up
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {unreadTotal > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#204b39] hover:text-[#183a2c] transition-colors px-2 py-1 rounded-md hover:bg-[#edf1ec] cursor-pointer"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-[#717870] hover:text-[#252b27] hover:bg-zinc-100 transition-colors cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-[#dedcd4]/60">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  filter === 'all'
                    ? "bg-[#204b39] text-white shadow-2xs"
                    : "text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100"
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5",
                  filter === 'unread'
                    ? "bg-[#204b39] text-white shadow-2xs"
                    : "text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100"
                )}
              >
                <span>Unread</span>
                {unreadTotal > 0 && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    filter === 'unread' ? "bg-white text-[#204b39]" : "bg-[#edf1ec] text-[#204b39]"
                  )}>
                    {unreadTotal}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#dedcd4]/50 overscroll-contain">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[#717870]">
                <Loader2 className="h-6 w-6 animate-spin text-[#204b39] mb-2" />
                <p className="text-xs font-medium">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[#717870]">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#edf1ec] text-[#204b39]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-[#252b27]">
                  {filter === 'unread' ? 'No unread notifications' : 'All caught up!'}
                </p>
                <p className="text-xs text-[#717870] mt-0.5 max-w-[240px]">
                  {filter === 'unread'
                    ? 'You have read all your campus trade and chat alerts.'
                    : 'Activity on your listings, reservations, and chats will appear here.'}
                </p>
                {filter === 'unread' && notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="mt-3 text-xs font-semibold text-[#204b39] hover:underline cursor-pointer"
                  >
                    View all notifications
                  </button>
                )}
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "group relative flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-zinc-50 cursor-pointer",
                    !notif.read && "bg-[#edf1ec]/40"
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(notif);
                    }
                  }}
                >
                  {/* Type Icon */}
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs border shadow-2xs",
                      getIconBadgeStyles(notif.type)
                    )}
                  >
                    {renderIcon(notif.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-0.5 pr-6">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn(
                        "text-xs truncate",
                        notif.read ? "font-medium text-[#252b27]" : "font-bold text-[#252b27]"
                      )}>
                        {notif.title}
                      </p>
                      <span className="flex items-center gap-0.5 text-[10px] text-[#717870] shrink-0 font-medium">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-[#555d56] line-clamp-2 leading-snug">
                      {notif.body || notif.message}
                    </p>
                  </div>

                  {/* Action Controls */}
                  <div className="absolute right-3 top-3.5 flex items-center gap-1">
                    {!notif.read ? (
                      <button
                        type="button"
                        onClick={(e) => handleSingleMarkRead(e, notif.id)}
                        className="rounded-full p-1 text-[#717870] hover:text-[#204b39] hover:bg-[#edf1ec] transition-colors cursor-pointer"
                        title="Mark as read"
                        aria-label="Mark notification as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className="p-2.5 text-center bg-zinc-50 border-t border-[#dedcd4]/60">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#204b39] hover:text-[#183a2c] transition-colors py-1 px-3 rounded-lg hover:bg-[#edf1ec] disabled:opacity-50 cursor-pointer"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      <span>Load more</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Preferences & Quick View Footer */}
          <div className="flex items-center justify-between border-t border-[#dedcd4] bg-[#faf9f5] px-4 py-2.5 text-xs text-[#717870]">
            <div className="flex items-center gap-3">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  "flex items-center gap-1.5 transition-colors rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] cursor-pointer",
                  soundEnabled
                    ? "text-[#252b27] hover:text-[#204b39]"
                    : "text-[#717870] hover:text-[#252b27]"
                )}
                title={soundEnabled ? 'Chime sound is active' : 'Chime sound is muted'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-[#204b39]" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-[#717870]" />
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
                  "flex items-center gap-1.5 transition-colors rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] cursor-pointer",
                  browserNotificationsEnabled
                    ? "text-[#252b27] hover:text-[#204b39]"
                    : "text-[#717870] hover:text-[#252b27]"
                )}
                title="Toggle browser push notifications"
              >
                <Globe
                  className={cn(
                    "h-3.5 w-3.5",
                    browserNotificationsEnabled ? "text-[#204b39]" : "text-[#717870]"
                  )}
                />
                <span className="text-[11px] font-medium">
                  {browserNotificationsEnabled ? 'Alerts ON' : 'Alerts OFF'}
                </span>
              </button>
            </div>

            {filter === 'unread' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="text-[11px] font-semibold text-[#204b39] hover:underline cursor-pointer"
              >
                View all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
