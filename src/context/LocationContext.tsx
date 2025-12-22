import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LocationContextType {
  isLocationLoading: boolean;
  setLocationLoading: (loading: boolean) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [isLocationLoading, setLocationLoading] = useState(true); // Start as loading

  return (
    <LocationContext.Provider value={{ isLocationLoading, setLocationLoading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};

