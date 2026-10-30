import React from 'react';
import { AppProvider } from './AppContext';
import { NotificationProvider } from './NotificationContext';

export default function MarketplaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </AppProvider>
  );
}
