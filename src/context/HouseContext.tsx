'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

  useEffect(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const queryId = urlParams?.get('houseId');
    const activeId = typeof window !== 'undefined' ? localStorage.getItem('activeHouseId') : null;
    const targetId = queryId || activeHouse?.id || activeId;
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

    if (targetId && typeof window !== 'undefined') {
      localStorage.setItem('activeHouseId', targetId);
    }

    if (targetId && userId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then(async (data) => {
          if (!data) return;
          const list: House[] = Array.isArray(data) ? data : data ? [data] : [];
          const found = list.find((h) => h.id === targetId);
          if (found) {
            const rmRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/roommates?houseId=${found.id}`
            ).catch(() => null);
            let rmList: Roommate[] = [];
            if (rmRes && rmRes.ok) {
              const rmData = await rmRes.json().catch(() => null);
              rmList = Array.isArray(rmData) ? rmData : rmData?.roommates || [];
            }
            setActiveHouseState((prev) => ({
              ...found,
              roommates: rmList.length > 0 ? rmList : prev?.roommates || [],
            }));
            if (rmList.length > 0) {
              setRoommatesState(rmList);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const setActiveHouse = (house: House | null | ((prev: House | null) => House | null)) => {
    setActiveHouseState((prev) => {
      const next = typeof house === 'function' ? house(prev) : house;
      if (next?.id && typeof window !== 'undefined') {
        localStorage.setItem('activeHouseId', next.id);
      }
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
