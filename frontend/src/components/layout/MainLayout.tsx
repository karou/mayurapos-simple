import React from 'react';
import { Outlet } from 'react-router-dom';
import AppBar from './AppBar';
import BottomNavigation from './BottomNavigation';
import { useOffline } from '../../contexts/OfflineContext';

const MainLayout: React.FC = () => {
  const { isOfflineMode } = useOffline();

  return (
    <div className={`flex min-h-screen flex-col ${isOfflineMode ? 'bg-warning-50' : 'bg-secondary-50'}`}>
      <AppBar />
      
      <main className="container mx-auto flex-grow px-4 pb-20 pt-6 md:pb-8">
        <Outlet />
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default MainLayout;