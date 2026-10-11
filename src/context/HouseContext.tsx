'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface Roommate {
  id: string;
  name: string;
  house_id?: string;
}

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
  roommates?: Roommate[];
}

interface HouseContextValue {
  activeHouse: House | null;
  setActiveHouse: (house: House | null | ((prev: House | null) => House | null)) => void;
  roommates: Roommate[];
  setRoommates: (roommates: Roommate[] | ((prev: Roommate[]) => Roommate[])) => void;
  updateHouseRoommates: (roommates: Roommate[]) => void;
  addRoommate: (roommate: Roommate) => void;
}

const HouseContext = createContext<HouseContextValue>({
  activeHouse: null,
  setActiveHouse: () => {},
  roommates: [],
  setRoommates: () => {},
  updateHouseRoommates: () => {},
  addRoommate: () => {},
});

export function HouseProvider({ children }: { children: ReactNode }) {
  const [activeHouse, setActiveHouseState] = useState<House | null>(null);
  const [roommates, setRoommatesState] = useState<Roommate[]>([]);

  const setActiveHouse = (house: House | null | ((prev: House | null) => House | null)) => {
    setActiveHouseState((prev) => {
      const next = typeof house === 'function' ? house(prev) : house;
      if (next?.roommates) {
        setRoommatesState(next.roommates);
      }
      return next;
    });
  };

  const updateHouseRoommates = (newList: Roommate[]) => {
    setRoommatesState(newList);
    setActiveHouseState((prev) => (prev ? { ...prev, roommates: newList } : null));
  };

  const setRoommates = (value: Roommate[] | ((prev: Roommate[]) => Roommate[])) => {
    if (typeof value === 'function') {
      setRoommatesState((prev) => {
        const next = value(prev);
        setActiveHouseState((h) => (h ? { ...h, roommates: next } : null));
        return next;
      });
    } else {
      updateHouseRoommates(value);
    }
  };

  const addRoommate = (roommate: Roommate) => {
    setRoommatesState((prev) => {
      const next = [...prev, roommate];
      setActiveHouseState((h) => (h ? { ...h, roommates: next } : null));
      return next;
    });
  };

  const currentRoommates = activeHouse?.roommates && activeHouse.roommates.length > 0 ? activeHouse.roommates : roommates;

  return (
    <HouseContext.Provider
      value={{
        activeHouse,
        setActiveHouse,
        roommates: currentRoommates,
        setRoommates,
        updateHouseRoommates,
        addRoommate,
      }}
    >
      {children}
    </HouseContext.Provider>
  );
}

export function useHouse() {
  return useContext(HouseContext);
}
