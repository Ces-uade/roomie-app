'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface Period {
  id: string;
  house_id?: string;
  month?: number;
  year?: number;
  is_closed?: boolean;
}

export interface House {
  id: string;
  name: string;
  month?: number;
  year?: number;
  periods?: Period[];
}

interface HouseContextValue {
  activeHouse: House | null;
  setActiveHouse: (house: House | null) => void;
}

const HouseContext = createContext<HouseContextValue>({
  activeHouse: null,
  setActiveHouse: () => {},
});

export function HouseProvider({ children }: { children: ReactNode }) {
  const [activeHouse, setActiveHouse] = useState<House | null>(null);

  return (
    <HouseContext.Provider value={{ activeHouse, setActiveHouse }}>
      {children}
    </HouseContext.Provider>
  );
}

export function useHouse() {
  return useContext(HouseContext);
}
