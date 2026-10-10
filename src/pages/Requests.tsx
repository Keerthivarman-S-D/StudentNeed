import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, Plus, IndianRupee, Loader2, AlertCircle, MessageSquare, ShieldAlert, Sparkles, Inbox, CheckCircle2 } from 'lucide-react';
import { collection, doc, getDoc, setDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/utils';
import { ItemRequest, Chat } from '../types';

export function Requests() {
  const navigate = useNavigate();
  const { requests, requestsLoading, requestsError, hasMoreRequests, loadMoreRequests, updateRequestStatus, cancelRequest, users } = useAppContext();
  const { currentUser, firebaseUser } = useAuth();
  const { chatUnreadCounts } = useNotifications();
  const currentUserId = firebaseUser?.uid || currentUser?.id;
  
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
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

  const displayedRequests = activeTab === 'all' 
    ? requests.filter(r => r.status === 'open')
    : requests.filter(r => r.requesterId === currentUserId);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">Item Requests</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Campus Needs
            </span>
          </div>
          <p className="text-zinc-600 text-sm">
            Help out a classmate or post what you&apos;re looking for. <span className="font-semibold text-emerald-800">Find → Connect → Meet</span>.
          </p>
        </div>
        
        <Link to="/create-request">
          <Button className="gap-2 w-full sm:w-auto h-11 px-5 shadow-xs font-bold">
            <Plus className="h-4 w-4" />
            Create Request
          </Button>
        </Link>
      </div>

      {/* Transaction Safety Warning Banner */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 text-amber-900 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0 font-bold">
            <ShieldAlert className="h-5 w-5 text-amber-700" />
          </div>
          <div className="space-y-1.5 text-xs sm:text-sm text-amber-900 leading-relaxed">
            <h2 className="font-bold text-amber-950 text-sm sm:text-base">Campus Safety & Exchange Notice</h2>
            <p className="text-xs text-amber-800">
              StudentNeed connects students on campus. We do not guarantee the condition, authenticity, or successful completion of any exchange.
            </p>
            <p className="text-xs text-amber-800">
              Always inspect items in person at an approved campus location before completing the meetup.
            </p>
          </div>
        </div>
      </div>

      {chatError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{chatError}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex space-x-1.5 rounded-2xl bg-zinc-100 p-1 w-fit border border-zinc-200/60 shadow-2xs" role="tablist" aria-label="Requests Filter">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={cn(
            "rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
            activeTab === 'all'
              ? "bg-white text-emerald-950 shadow-xs border border-zinc-200"
              : "text-zinc-600 hover:text-zinc-900"
          )}
        >
          Campus Requests
        </button>
        {currentUser && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'my'}
            onClick={() => setActiveTab('my')}
            className={cn(
              "rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal flex items-center gap-1.5",
              activeTab === 'my'
                ? "bg-white text-emerald-950 shadow-xs border border-zinc-200"
                : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            <span>My Requests</span>
            {myRequestsCount > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.2 text-[11px] font-bold",
                activeTab === 'my' ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-700"
              )}>
                {myRequestsCount}
              </span>
            )}
          </button>
        )}
      </div>

      {requestsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-32 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : requestsError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-red-900 mb-1">Could not load campus requests</h3>
          <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{requestsError}</p>
          {!currentUser && (
            <Link to="/login">
              <Button size="sm">Sign In to Access</Button>
            </Link>
          )}
        </div>
      ) : displayedRequests.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-4">
            {displayedRequests.map(request => {
              const requester = users.find(u => u.id === request.requesterId);
              const isOwner = (firebaseUser?.uid || currentUser?.id) === request.requesterId;
              const existingChat = userChats.find(c => c.requestId === request.id);
              const requestInquiries = userChats.filter(c => c.requestId === request.id);
              
              return (
                <div 
                  key={request.id} 
                  className="flex flex-col gap-4 rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-6 transition-all hover:border-zinc-300 hover:shadow-sm shadow-2xs"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start justify-between">
                    {/* Request Details */}
                    <div className="flex-1 space-y-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold text-brand-charcoal tracking-tight">{request.title}</h3>
                        {request.status !== 'open' && (
                          <Badge 
                            variant={request.status === 'matched' ? 'success' : request.status === 'cancelled' ? 'destructive' : 'secondary'} 
                            className={`ml-2 shrink-0 ${request.status === 'cancelled' ? 'bg-red-600 text-white font-bold' : ''}`}
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-600 leading-relaxed">{request.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold pt-1">
                        <span className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/70 text-zinc-700 px-2.5 py-1 rounded-xl shadow-2xs">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          Needed by: {request.neededBy}
                        </span>
                        <span className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/70 text-zinc-700 px-2.5 py-1 rounded-xl shadow-2xs">
                          <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                          {request.location}
                        </span>
                        {request.budget && (
                          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold shadow-2xs">
                            <IndianRupee className="h-3.5 w-3.5 text-emerald-700" />
                            Budget: ₹{request.budget}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Requester Identity & CTAs */}
                    <div className="flex flex-col items-start gap-3 border-t border-zinc-100 pt-4 sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 shrink-0">
                      <div className="flex items-center gap-2">
                        {requester?.avatarUrl ? (
                          <img src={requester.avatarUrl} alt={requester.name} className="h-8 w-8 rounded-full object-cover bg-zinc-100 ring-1 ring-zinc-200" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-charcoal text-xs font-bold text-white">
                            {requester?.name ? requester.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                        )}
                        <span className="text-xs sm:text-sm font-semibold text-brand-charcoal">
                          {requester?.name || (isOwner ? currentUser?.name || 'You' : 'Student Requester')}
                        </span>
                      </div>

                      {!isOwner && request.status === 'open' ? (
                        <Button 
                          className="w-full sm:w-auto text-xs h-9 gap-1.5 bg-brand-teal hover:bg-brand-teal-hover text-white font-bold shadow-xs"
                          disabled={startingChatId === request.id}
                          onClick={() => handleStartChat(request)}
                        >
                          {startingChatId === request.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Opening Chat...
                            </>
                          ) : existingChat ? (
                            <>
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Continue Chat</span>
                              {Boolean(chatUnreadCounts[existingChat.id]) && (
                                <span className="ml-1 rounded-full bg-white text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold shadow-xs">
                                  {chatUnreadCounts[existingChat.id]}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Chat / Contact</span>
                            </>
                          )}
                        </Button>
                      ) : isOwner && request.status === 'open' ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <Button 
                            variant="secondary" 
                            className="text-xs h-8 font-semibold"
                            disabled={updatingId === request.id || cancellingId === request.id}
                            onClick={() => handleMarkAsFound(request.id)}
                          >
                            {updatingId === request.id ? 'Updating...' : 'Mark as Found'}
                          </Button>
                          {confirmCancelId === request.id ? (
                            <div className="flex items-center justify-end gap-1.5 bg-red-50 p-1 rounded-xl border border-red-200">
                              <span className="text-[11px] font-bold text-red-800 px-1">Cancel?</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-[11px] bg-red-600 hover:bg-red-700 text-white font-semibold"
                                disabled={cancellingId === request.id}
                                onClick={() => handleConfirmCancelRequest(request.id)}
                              >
                                {cancellingId === request.id ? '...' : 'Yes'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[11px] text-zinc-600"
                                onClick={() => setConfirmCancelId(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              className="text-xs h-8 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 font-semibold"
                              disabled={updatingId === request.id || cancellingId === request.id}
                              onClick={() => setConfirmCancelId(request.id)}
                            >
                              Cancel Request
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Show incoming inquiries from other students if user is the request owner */}
                  {isOwner && requestInquiries.length > 0 && (
                    <div className="border-t border-zinc-100 pt-3 mt-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-brand-charcoal flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                          Student Responses ({requestInquiries.length})
                        </span>
                        <span className="text-[11px] text-zinc-500 hidden sm:inline">Tap to open direct conversation</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {requestInquiries.map((chatItem) => {
                          const otherParticipantId = chatItem.participants.find(p => p !== currentUserId);
                          const responder = users.find(u => u.id === otherParticipantId);
                          const unreadCount = chatUnreadCounts[chatItem.id] || 0;
                          return (
                            <Button
                              key={chatItem.id}
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 gap-1.5 border-zinc-200 bg-zinc-50 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 text-zinc-800 transition-all font-semibold rounded-xl"
                              onClick={() => navigate(`/chat/${chatItem.id}`)}
                            >
                              <div className={cn("h-2 w-2 rounded-full", unreadCount > 0 ? "bg-emerald-600 animate-pulse" : "bg-zinc-400")} />
                              <span>Chat with {responder?.name || 'Student'}</span>
                              {unreadCount > 0 && (
                                <span className="ml-1 rounded-full bg-emerald-600 text-white px-1.5 py-0.5 text-[10px] font-bold">
                                  {unreadCount}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMoreRequests && (
            <div className="flex justify-center pt-2 pb-6">
              <Button
                variant="outline"
                onClick={loadMoreRequests}
                className="gap-2 px-6 h-10 border-zinc-200 text-brand-charcoal hover:border-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 font-semibold text-sm transition-all"
              >
                Load More Requests
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/60 py-24 text-center px-4">
          <div className="h-14 w-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4 text-zinc-400">
            <Inbox className="h-7 w-7 text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">
            {activeTab === 'my' ? "You haven't posted any requests yet" : "No requests found"}
          </h3>
          <p className="text-sm text-zinc-500 mt-1.5 mb-6 max-w-sm leading-relaxed">
            {activeTab === 'my'
              ? "When you need something on campus, create a request and peers will reach out to help."
              : "There are no active requests right now. Be the first to ask for what you need!"}
          </p>
          <Link to="/create-request">
            <Button>Create Request</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
