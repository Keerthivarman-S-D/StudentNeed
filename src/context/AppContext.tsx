import React, { createContext, useContext, useState } from 'react';
import { User, Listing, ItemRequest } from '../types';
import { mockUsers, mockListings, mockRequests } from '../data';

type AppContextType = {
  listings: Listing[];
  addListing: (listing: Listing) => void;
  requests: ItemRequest[];
  addRequest: (request: ItemRequest) => void;
  savedListings: string[];
  toggleSaveListing: (id: string) => void;
  users: User[];
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>(mockListings);
  const [requests, setRequests] = useState<ItemRequest[]>(mockRequests);
  const [savedListings, setSavedListings] = useState<string[]>(['l2', 'l4']);
  const [users] = useState<User[]>(mockUsers);

  const addListing = (listing: Listing) => {
    setListings((prev) => [listing, ...prev]);
  };

  const addRequest = (request: ItemRequest) => {
    setRequests((prev) => [request, ...prev]);
  };

  const toggleSaveListing = (id: string) => {
    setSavedListings((prev) => 
      prev.includes(id) ? prev.filter((listingId) => listingId !== id) : [...prev, id]
    );
  };

  return (
    <AppContext.Provider
      value={{
        listings,
        addListing,
        requests,
        addRequest,
        savedListings,
        toggleSaveListing,
        users
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
