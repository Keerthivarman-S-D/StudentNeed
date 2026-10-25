import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Clock, 
  Plus, 
  IndianRupee, 
  Loader2, 
  AlertCircle, 
  MessageSquare, 
  Inbox, 
  X,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { collection, doc, getDoc, setDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { cn } from '../lib/utils';
import { ItemRequest, Chat, Category } from '../types';

export function Requests() {
  const navigate = useNavigate();
  const { requests, requestsLoading, requestsError, hasMoreRequests, loadMoreRequests, updateRequestStatus, cancelRequest, users } = useAppContext();
  const { currentUser, firebaseUser } = useAuth();
  const { chatUnreadCounts } = useNotifications();
  const currentUserId = firebaseUser?.uid || currentUser?.id;
  
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'budget_high' | 'needed_soon'>('newest');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [userChats, setUserChats] = useState<Chat[]>([]);

  // Subscribe to authenticated user's conversations to display request inquiries
  useEffect(() => {
    if (!currentUserId) {
      setUserChats([]);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveChats: Chat[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          participants: data.participants || [],
          requestId: data.requestId,
          reservationId: data.reservationId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      setUserChats(liveChats);
    }, (err) => console.warn('User chats query notice in requests:', err));

    return () => unsubscribe();
  }, [currentUserId]);

  const categories: (Category | 'All')[] = [
    'All',
    'Textbooks',
    'Electronics',
    'Stationery',
    'Lab Essentials',
    'Hostel Essentials',
    'Sports',
    'College Wear',
    'Other'
  ];

  // Filter and sort requests without mutating state
  const filteredRequests = useMemo(() => {
    let result = activeTab === 'all'
      ? requests.filter(r => r.status === 'open')
      : requests.filter(r => r.requesterId === currentUserId);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(r => 
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.location && r.location.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter(r => r.category === selectedCategory);
    }

    const sorted = [...result];
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'budget_high':
        sorted.sort((a, b) => (b.budget || 0) - (a.budget || 0));
        break;
      case 'needed_soon':
        sorted.sort((a, b) => (a.neededBy || '').localeCompare(b.neededBy || ''));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return sorted;
  }, [requests, activeTab, currentUserId, search, selectedCategory, sortBy]);

  const handleStartChat = async (request: ItemRequest) => {
    setChatError(null);
    if (!currentUserId) {
      navigate('/login', { state: { from: '/requests' } });
      return;
    }

    if (currentUserId === request.requesterId) {
      return;
    }

    setStartingChatId(request.id);
    try {
      // 1. Immediately reuse conversation if already in user state
      const existingInState = userChats.find(
        (c) => c.requestId === request.id && c.participants.includes(request.requesterId)
      );
      if (existingInState) {
        navigate(`/chat/${existingInState.id}`);
        return;
      }

      // 2. Deterministic ID ensures no duplicate conversations from repeated clicks
      const chatId = `req_${request.id}_${[currentUserId, request.requesterId].sort().join('_')}`;
      const chatDocRef = doc(db, 'chats', chatId);

      // 3. Try to get doc or create if it does not exist yet
      try {
        const chatDocSnap = await getDoc(chatDocRef);
        if (!chatDocSnap.exists()) {
          await setDoc(chatDocRef, {
            participants: [currentUserId, request.requesterId],
            requestId: request.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        navigate(`/chat/${chatId}`);
      } catch (checkErr) {
        // Fallback: If getDoc fails due to security rules evaluation on null resource,
        // create the conversation via the authorized chat create rule
        console.warn('Initial chat check notice, initializing conversation:', checkErr);
        try {
          await setDoc(chatDocRef, {
            participants: [currentUserId, request.requesterId],
            requestId: request.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          navigate(`/chat/${chatId}`);
        } catch (createErr) {
          console.error('Failed to initialize request chat:', createErr);
          setChatError('Could not start conversation. Please try again.');
        }
      }
    } catch (err: unknown) {
      console.error('Failed to initialize request chat:', err);
      setChatError('Could not start conversation. Please try again.');
    } finally {
      setStartingChatId(null);
    }
  };

  const handleMarkAsFound = async (requestId: string) => {
    setUpdatingId(requestId);
    try {
      await updateRequestStatus(requestId, 'completed');
    } catch (err) {
      console.error('Failed to mark request as found:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmCancelRequest = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      await cancelRequest(requestId);
      setConfirmCancelId(null);
    } catch (err) {
      console.error('Failed to cancel request:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const myRequestsCount = requests.filter(r => r.requesterId === currentUserId).length;
  const hasActiveFilters = Boolean(search.trim() || selectedCategory !== 'All');

  const handleClearAllFilters = () => {
    setSearch('');
    setSelectedCategory('All');
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#252b27]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252b27]">
              Campus Requests
            </h1>
            <p className="text-sm sm:text-base text-[#555d56] mt-1">
              Find what students need, or post a request of your own.
            </p>
          </div>
          
          <Link to="/create-request" className="shrink-0">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto h-11 px-5 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Post a Request</span>
            </button>
          </Link>
        </div>

        {/* Campus Safety & Exchange Notice */}
        <div className="mb-6 rounded-2xl bg-[#edf1ec] p-4 sm:p-5 flex items-start gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#204b39] text-[#204b39] shrink-0 mt-0.5 text-[11px] font-bold">
            i
          </div>
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-[#204b39] block sm:inline mr-2">
              Campus Safety &amp; Exchange Notice
            </span>
            <span className="text-[#555d56]">
              StudentNeed connects peers across campus. Always inspect items in person at a verified public campus spot before concluding any exchange.
            </span>
          </div>
        </div>

        {chatError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-4 text-xs sm:text-sm text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{chatError}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatError(null)}
              className="text-xs font-semibold underline hover:text-red-900 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Tabs: Campus Requests vs My Requests */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
                activeTab === 'all'
                  ? "bg-[#204b39] text-white shadow-xs"
                  : "bg-white text-[#555d56] border border-[#dedcd4] hover:text-[#252b27]"
              )}
            >
              All Requests
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('my')}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'my'
                    ? "bg-[#204b39] text-white shadow-xs"
                    : "bg-white text-[#555d56] border border-[#dedcd4] hover:text-[#252b27]"
                )}
              >
                <span>My Requests</span>
                {myRequestsCount > 0 && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeTab === 'my' ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"
                  )}>
                    {myRequestsCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#204b39] hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>

        {/* Search Field & Sort Control */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end">
          {/* Search field */}
          <div className="sm:col-span-8 lg:col-span-9 flex flex-col gap-1.5">
            <label htmlFor="requests-search" className="text-xs font-semibold text-[#252b27]">
              Search campus requests
            </label>
            <div className="relative">
              <input
                id="requests-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requests by title, description, or category..."
                className="h-11 w-full rounded-xl border border-[#dedcd4] bg-white px-4 pr-10 text-sm text-[#252b27] placeholder:text-[#8a918a] outline-none transition-colors focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39]"
                aria-label="Search requests"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#717870] hover:text-[#252b27] hover:bg-zinc-100 transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Sort listings */}
          <div className="sm:col-span-4 lg:col-span-3 flex flex-col gap-1.5">
            <label htmlFor="requests-sort" className="text-xs font-semibold text-[#252b27]">
              Sort requests
            </label>
            <div className="relative">
              <select
                id="requests-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-11 w-full appearance-none rounded-xl border border-[#dedcd4] bg-white pl-4 pr-10 text-sm font-medium text-[#252b27] outline-none transition-colors focus:border-[#204b39] focus:ring-1 focus:ring-[#204b39] cursor-pointer"
                aria-label="Sort requests"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="budget_high">Highest budget</option>
                <option value="needed_soon">Needed soonest</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#717870]" />
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="mb-6 flex flex-wrap gap-2 items-center">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(isSelected && cat !== 'All' ? 'All' : cat)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium border transition-all cursor-pointer",
                  isSelected
                    ? "bg-[#edf1ec] text-[#204b39] border-[#204b39]/40 font-semibold shadow-2xs"
                    : "bg-white text-[#555d56] border-[#dedcd4] hover:border-zinc-400 hover:text-[#252b27]"
                )}
                aria-pressed={isSelected}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Requests Feed */}
        {requestsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[#dedcd4] bg-white p-5 sm:p-6 space-y-3.5">
                <div className="flex justify-between items-center">
                  <div className="h-5 w-40 rounded-full bg-zinc-200 animate-pulse" />
                  <div className="h-4 w-20 rounded-full bg-zinc-200 animate-pulse" />
                </div>
                <div className="h-6 w-3/4 rounded-md bg-zinc-200 animate-pulse" />
                <div className="h-4 w-full rounded-md bg-zinc-200 animate-pulse" />
                <div className="pt-2 flex items-center justify-between border-t border-[#f4f3ee]">
                  <div className="h-8 w-32 rounded-lg bg-zinc-200 animate-pulse" />
                  <div className="h-9 w-28 rounded-xl bg-zinc-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : requestsError ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center max-w-lg mx-auto">
            <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#252b27] mb-1">Could not load campus requests</h3>
            <p className="text-sm text-[#555d56] max-w-md mx-auto mb-4">{requestsError}</p>
            {!currentUser && (
              <Link to="/login">
                <button
                  type="button"
                  className="rounded-xl bg-[#204b39] px-4 py-2 text-sm font-semibold text-white hover:bg-[#183a2c]"
                >
                  Sign In to Access
                </button>
              </Link>
            )}
          </div>
        ) : filteredRequests.length > 0 ? (
          <div className="space-y-4">
            {filteredRequests.map(request => {
              const requester = users.find(u => u.id === request.requesterId);
              const isOwner = currentUserId === request.requesterId;
              const existingChat = userChats.find(c => c.requestId === request.id);
              const requestInquiries = userChats.filter(c => c.requestId === request.id);

              return (
                <div 
                  key={request.id} 
                  className="rounded-2xl border border-[#dedcd4] bg-white p-5 sm:p-6 shadow-none hover:border-zinc-400 transition-all duration-200"
                >
                  {/* Top Row: Category, Budget, Needed By, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-0.5 text-xs font-medium text-zinc-700">
                        {request.category}
                      </span>
                      {request.budget !== undefined && request.budget > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1ec] text-[#204b39] border border-[#204b39]/20 px-2.5 py-0.5 text-xs font-semibold">
                          <IndianRupee className="h-3 w-3 text-[#204b39]" />
                          Budget: ₹{request.budget}
                        </span>
                      )}
                      {request.status !== 'open' && (
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          request.status === 'completed' || request.status === 'matched'
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : request.status === 'cancelled'
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                        )}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-[#717870] flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#717870]" />
                      <span>Needed by: <strong>{request.neededBy}</strong></span>
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-base sm:text-lg font-bold text-[#252b27] mb-1.5">
                    {request.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-[#555d56] leading-relaxed mb-4 whitespace-pre-wrap">
                    {request.description}
                  </p>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#717870] font-medium mb-4">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#204b39]" />
                      <span>{request.location}</span>
                    </span>
                    <span>•</span>
                    <span>Posted {formatTimeAgo(request.createdAt)}</span>
                  </div>

                  {/* Bottom Divider: Requester identity on left, Actions on right */}
                  <div className="pt-3.5 border-t border-[#f4f3ee] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {requester?.avatarUrl ? (
                        <img 
                          src={requester.avatarUrl} 
                          alt={requester.name} 
                          className="h-8 w-8 rounded-full object-cover border border-[#dedcd4]" 
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-[#252b27]">
                          {requester?.name ? requester.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                      )}
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-[#252b27]">
                          {requester?.name || (isOwner ? 'You' : 'Campus Student')}
                        </span>
                        <span className="text-xs text-[#717870] ml-1.5 hidden sm:inline">
                          · MIT Campus
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {!isOwner && request.status === 'open' ? (
                        <button
                          type="button"
                          disabled={startingChatId === request.id}
                          onClick={() => handleStartChat(request)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#204b39] hover:bg-[#183a2c] text-white font-semibold text-xs h-9 px-4 shadow-xs transition-colors cursor-pointer"
                        >
                          {startingChatId === request.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Opening Chat...</span>
                            </>
                          ) : existingChat ? (
                            <>
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Continue Chat</span>
                              {Boolean(chatUnreadCounts[existingChat.id]) && (
                                <span className="ml-1 rounded-full bg-white text-[#204b39] px-1.5 py-0.5 text-[10px] font-bold">
                                  {chatUnreadCounts[existingChat.id]}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>I Have This / Contact</span>
                            </>
                          )}
                        </button>
                      ) : isOwner && request.status === 'open' ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={updatingId === request.id || cancellingId === request.id}
                            onClick={() => handleMarkAsFound(request.id)}
                            className="rounded-xl border border-[#dedcd4] bg-white hover:bg-[#edf1ec] text-[#204b39] font-semibold text-xs h-9 px-3.5 transition-colors cursor-pointer"
                          >
                            {updatingId === request.id ? 'Updating...' : 'Mark as Found'}
                          </button>
                          {confirmCancelId === request.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-xl border border-red-200">
                              <span className="text-[11px] font-bold text-red-800 px-1">Cancel?</span>
                              <button
                                type="button"
                                disabled={cancellingId === request.id}
                                onClick={() => handleConfirmCancelRequest(request.id)}
                                className="h-7 px-2.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg cursor-pointer"
                              >
                                {cancellingId === request.id ? '...' : 'Yes'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCancelId(null)}
                                className="h-7 px-2 text-xs text-[#555d56] hover:text-[#252b27] cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={updatingId === request.id || cancellingId === request.id}
                              onClick={() => setConfirmCancelId(request.id)}
                              className="rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold text-xs h-9 px-3.5 transition-colors cursor-pointer"
                            >
                              Cancel Request
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Incoming student inquiries if user is owner */}
                  {isOwner && requestInquiries.length > 0 && (
                    <div className="border-t border-[#f4f3ee] pt-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#252b27] flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-[#204b39]" />
                          Student Responses ({requestInquiries.length})
                        </span>
                        <span className="text-[11px] text-[#717870] hidden sm:inline">
                          Tap to open conversation
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {requestInquiries.map((chatItem) => {
                          const otherParticipantId = chatItem.participants.find(p => p !== currentUserId);
                          const responder = users.find(u => u.id === otherParticipantId);
                          const unreadCount = chatUnreadCounts[chatItem.id] || 0;
                          return (
                            <button
                              key={chatItem.id}
                              type="button"
                              onClick={() => navigate(`/chat/${chatItem.id}`)}
                              className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-xl border border-[#dedcd4] bg-[#f4f7f4] hover:bg-[#edf1ec] text-[#252b27] font-medium transition-colors cursor-pointer"
                            >
                              <div className={cn("h-2 w-2 rounded-full", unreadCount > 0 ? "bg-[#204b39] animate-pulse" : "bg-zinc-400")} />
                              <span>Chat with {responder?.name || 'Student'}</span>
                              {unreadCount > 0 && (
                                <span className="ml-1 rounded-full bg-[#204b39] text-white px-1.5 py-0.2 text-[10px] font-bold">
                                  {unreadCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {hasMoreRequests && (
              <div className="flex justify-center pt-4 pb-6">
                <button
                  type="button"
                  onClick={loadMoreRequests}
                  className="rounded-xl border border-[#dedcd4] bg-white px-8 py-2.5 text-sm font-semibold text-[#252b27] hover:border-[#204b39] hover:text-[#204b39] transition-colors shadow-2xs cursor-pointer"
                >
                  Load More Requests
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedcd4] bg-white py-16 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1ec] text-[#204b39] mb-4">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#252b27]">
              {hasActiveFilters 
                ? "No matching campus requests"
                : activeTab === 'my' 
                ? "You haven't posted any requests yet" 
                : "No active requests right now"}
            </h3>
            <p className="text-sm text-[#555d56] mt-1 max-w-sm">
              {hasActiveFilters
                ? "We couldn't find any requests matching your active search or category filters."
                : activeTab === 'my'
                ? "When you need a textbook, calculator, or lab item, post a request and peers will reach out."
                : "There are no active requests right now. Be the first to ask for what you need!"}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="mt-5 rounded-xl border border-[#dedcd4] bg-white px-5 py-2 text-sm font-semibold text-[#204b39] hover:border-[#204b39] cursor-pointer"
              >
                Clear All Filters
              </button>
            ) : (
              <Link to="/create-request" className="mt-5">
                <button
                  type="button"
                  className="rounded-xl bg-[#204b39] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#183a2c] cursor-pointer"
                >
                  Post a Request
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 pb-12 text-xs text-[#717870]">
          StudentNeed · MIT Campus, Anna University · Campus meetups only
        </footer>

      </div>
    </div>
  );
}
