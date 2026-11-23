'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Roommate {
  id: string;
  name: string;
  house_id?: string;
  user_id?: string | null;
  is_owner?: boolean;
  is_active?: boolean;
}

export interface Period {
  id: string;
  house_id?: string;
  month?: number;
  year?: number;
  is_closed?: boolean;
  created_at?: string;
}

export interface House {
  id: string;
  name: string;
  owner_id?: string;
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
  periods: Period[];
  selectedPeriodId: string;
  selectedPeriod: Period | null;
  periodsReady: boolean;
  houseMissing: boolean;
  setHouseMissing: (missing: boolean) => void;
  setSelectedPeriodId: (id: string) => void;
  refreshHouseData: (selectOpenPeriod?: boolean) => Promise<void>;
  clearSession: () => void;
}

const HouseContext = createContext<HouseContextValue>({
  activeHouse: null,
  setActiveHouse: () => {},
  roommates: [],
  setRoommates: () => {},
  updateHouseRoommates: () => {},
  addRoommate: () => {},
  periods: [],
  selectedPeriodId: '',
  selectedPeriod: null,
  periodsReady: false,
  houseMissing: false,
  setHouseMissing: () => {},
  setSelectedPeriodId: () => {},
  refreshHouseData: async () => {},
  clearSession: () => {},
});

const sortPeriods = (list: Period[]) =>
  [...list].sort(
    (a, b) =>
      (b.year ?? 0) - (a.year ?? 0) ||
      (b.month ?? 0) - (a.month ?? 0) ||
      (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );

export function HouseProvider({ children }: { children: ReactNode }) {
  const [activeHouse, setActiveHouseState] = useState<House | null>(null);
  const [roommates, setRoommatesState] = useState<Roommate[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodIdState] = useState('');
  const [periodsReady, setPeriodsReady] = useState(false);
  const [houseMissing, setHouseMissing] = useState(false);

  const activeHouseId = activeHouse?.id;

  const loadPeriods = useCallback(async (houseId: string, fallback?: Period[], selectOpen = false) => {
    let list: Period[] = [];
    try {
      const res = await fetch(`${API}/api/periods?houseId=${houseId}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data)) list = data;
      }
    } catch {
      // ignore
    }
    if (list.length === 0 && fallback) list = fallback;
    const sorted = sortPeriods(list);
    setPeriods(sorted);

    const storedId = typeof window !== 'undefined' ? localStorage.getItem('activePeriodId') : null;
    const stored = !selectOpen && storedId ? sorted.find((p) => p.id === storedId) : undefined;
    const chosen = stored || sorted.find((p) => !p.is_closed) || sorted[0];
    const chosenId = chosen?.id || '';
    setSelectedPeriodIdState(chosenId);
    if (typeof window !== 'undefined') {
      if (chosenId) localStorage.setItem('activePeriodId', chosenId);
      else localStorage.removeItem('activePeriodId');
    }
    setPeriodsReady(true);
  }, []);

  const fetchRoommatesFor = useCallback(async (houseId: string): Promise<Roommate[]> => {
    const rmRes = await fetch(`${API}/api/roommates?houseId=${houseId}`).catch(() => null);
    if (rmRes && rmRes.ok) {
      const rmData = await rmRes.json().catch(() => null);
      return Array.isArray(rmData) ? rmData : rmData?.roommates || [];
    }
    return [];
  }, []);

  useEffect(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const queryId = urlParams?.get('houseId');
    const activeId = typeof window !== 'undefined' ? localStorage.getItem('activeHouseId') : null;
    const targetId = queryId || activeId;
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

    if (targetId && typeof window !== 'undefined') {
      localStorage.setItem('activeHouseId', targetId);
    }

    if (!(targetId && userId)) {
      setPeriodsReady(true);
      return;
    }

    fetch(`${API}/api/houses/mine?userId=${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (!data) {
          setPeriodsReady(true);
          return;
        }
        const list: House[] = Array.isArray(data) ? data : data ? [data] : [];
        const found = list.find((h) => h.id === targetId);
        if (found) {
          setActiveHouseState(found);
          const rmList = await fetchRoommatesFor(found.id);
          if (rmList.length > 0) {
            setRoommatesState(rmList);
          }
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activeHouseId');
            localStorage.removeItem('activePeriodId');
          }
          setActiveHouseState(null);
          setPeriodsReady(true);
          setHouseMissing(true);
        }
      })
      .catch(() => setPeriodsReady(true));
  }, [fetchRoommatesFor]);

  useEffect(() => {
    if (!activeHouseId) return;
    setPeriodsReady(false);
    loadPeriods(activeHouseId, activeHouse?.periods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHouseId, loadPeriods]);

  const setActiveHouse = useCallback((house: House | null | ((prev: House | null) => House | null)) => {
    setActiveHouseState((prev) => {
      const next = typeof house === 'function' ? house(prev) : house;
      if (next?.id && typeof window !== 'undefined') {
        localStorage.setItem('activeHouseId', next.id);
      }
      return next;
    });
  }, []);

  const updateHouseRoommates = useCallback((newList: Roommate[]) => {
    setRoommatesState(newList);
  }, []);

  const setRoommates = useCallback((value: Roommate[] | ((prev: Roommate[]) => Roommate[])) => {
    setRoommatesState(value);
  }, []);

  const addRoommate = useCallback((roommate: Roommate) => {
    setRoommatesState((prev) => [...prev, roommate]);
  }, []);

  const setSelectedPeriodId = useCallback((id: string) => {
    setSelectedPeriodIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('activePeriodId', id);
      else localStorage.removeItem('activePeriodId');
    }
  }, []);

  const refreshHouseData = useCallback(
    async (selectOpenPeriod = false) => {
      if (typeof window === 'undefined') return;
      const userId = localStorage.getItem('userId');
      const houseId = localStorage.getItem('activeHouseId');
      if (!userId || !houseId) return;

      try {
        const res = await fetch(`${API}/api/houses/mine?userId=${userId}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const list: House[] = Array.isArray(data) ? data : data ? [data] : [];
          const found = list.find((h) => h.id === houseId);
          if (found) {
            setActiveHouseState(found);
            setRoommatesState(await fetchRoommatesFor(found.id));
            await loadPeriods(found.id, found.periods, selectOpenPeriod);
          }
        }
      } catch {
        // ignore
      }
    },
    [fetchRoommatesFor, loadPeriods]
  );

  const clearSession = useCallback(() => {
    setActiveHouseState(null);
    setRoommatesState([]);
    setPeriods([]);
    setSelectedPeriodIdState('');
    setPeriodsReady(true);
    setHouseMissing(false);
  }, []);

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) || null;

  return (
    <HouseContext.Provider
      value={{
        activeHouse,
        setActiveHouse,
        roommates,
        setRoommates,
        updateHouseRoommates,
        addRoommate,
        periods,
        selectedPeriodId,
        selectedPeriod,
        periodsReady,
        houseMissing,
        setHouseMissing,
        setSelectedPeriodId,
        refreshHouseData,
        clearSession,
      }}
    >
      {children}
    </HouseContext.Provider>
  );
}

export function useHouse() {
  return useContext(HouseContext);
}
