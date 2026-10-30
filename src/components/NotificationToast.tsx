import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, MessageSquare, Package, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export function NotificationToast() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeToast, dismissToast } = useNotifications();

  if (!activeToast) return null;

  // Don't pop up active chat banner if user is currently inside this chat
  if (
    activeToast.targetType === 'chat' &&
    activeToast.targetId &&
    location.pathname === `/chat/${activeToast.targetId}`
  ) {
    return null;
  }

  const handleClick = () => {
    dismissToast();
    if (activeToast.link) {
      navigate(activeToast.link);
    } else if (activeToast.targetType === 'chat' && activeToast.targetId) {
      navigate(`/chat/${activeToast.targetId}`);
    } else if (activeToast.targetType === 'reservation') {
      navigate('/reserved');
    } else {
      navigate('/');
    }
  };

  const getIcon = () => {
    if (activeToast.targetType === 'chat') {
      return <MessageSquare className="h-4 w-4 text-[#204b39]" />;
    }
    if (activeToast.targetType === 'reservation') {
      return <Package className="h-4 w-4 text-[#204b39]" />;
    }
    return <Bell className="h-4 w-4 text-[#204b39]" />;
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] bg-white border border-[#dedcd4] shadow-2xl rounded-2xl p-3.5 transition-all animate-in slide-in-from-top-3 fade-in duration-200 cursor-pointer hover:border-[#204b39]"
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf1ec] border border-[#204b39]/20">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-xs font-bold text-[#252b27] truncate">{activeToast.title}</p>
          <p className="text-xs text-[#555d56] line-clamp-2 mt-0.5 leading-snug">{activeToast.body}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissToast();
          }}
          className="rounded-lg p-1 text-[#555d56] hover:text-[#252b27] hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
