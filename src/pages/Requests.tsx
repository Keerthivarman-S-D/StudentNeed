import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, Plus, IndianRupee } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function Requests() {
  const { requests, users } = useAppContext();
  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  const displayedRequests = activeTab === 'all' 
    ? requests.filter(r => r.status === 'open')
    : requests.filter(r => r.requesterId === currentUser?.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Item Requests</h1>
          <p className="text-zinc-600 mt-1">Help out a peer or post what you're looking for.</p>
        </div>
        
        <Link to="/create-request">
          <Button className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Create Request
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex space-x-1 rounded-xl bg-zinc-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          Campus Requests
        </button>
        {currentUser && (
          <button
            onClick={() => setActiveTab('my')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'my'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            My Requests
          </button>
        )}
      </div>

      {displayedRequests.length > 0 ? (
        <div className="grid gap-4">
          {displayedRequests.map(request => {
            const requester = users.find(u => u.id === request.requesterId);
            
            return (
              <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md sm:flex-row sm:items-center">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold text-zinc-900">{request.title}</h3>
                    {request.status !== 'open' && (
                      <Badge variant={request.status === 'matched' ? 'success' : 'secondary'} className="ml-2">
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2">{request.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-500 pt-2">
                    <span className="flex items-center gap-1 bg-zinc-50 px-2 py-1 rounded-md">
                      <Clock className="h-3.5 w-3.5" />
                      Needed by: {request.neededBy}
                    </span>
                    <span className="flex items-center gap-1 bg-zinc-50 px-2 py-1 rounded-md">
                      <MapPin className="h-3.5 w-3.5" />
                      {request.location}
                    </span>
                    {request.budget && (
                      <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md">
                        <IndianRupee className="h-3.5 w-3.5" />
                        Budget: ₹{request.budget}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-start gap-4 border-t border-zinc-100 pt-4 sm:items-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 shrink-0">
                  <div className="flex items-center gap-2">
                    <img src={requester?.avatarUrl} alt={requester?.name} className="h-8 w-8 rounded-full bg-zinc-100" />
                    <span className="text-sm font-medium text-zinc-900">{requester?.name}</span>
                  </div>
                  {currentUser?.id !== request.requesterId && request.status === 'open' ? (
                    <Button variant="outline" className="w-full sm:w-auto">I have this</Button>
                  ) : activeTab === 'my' ? (
                    <Button variant="secondary" className="w-full sm:w-auto text-xs h-8">Mark as Found</Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-24 text-center">
          <Search className="h-12 w-12 text-zinc-300 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900">No requests found</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm">
            There are no active requests right now. 
          </p>
        </div>
      )}
    </div>
  );
}
