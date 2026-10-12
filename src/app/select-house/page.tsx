'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse, House } from '@/context/HouseContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function extractCode(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value);
    return url.searchParams.get('code') || url.searchParams.get('invite') || value;
  } catch {
    const m = value.match(/[?&](?:code|invite)=([^&\s]+)/);
    return m ? decodeURIComponent(m[1]) : value;
  }
}

export default function SelectHousePage() {
  const router = useRouter();
  const { setActiveHouse } = useHouse();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const fetchHouses = useCallback(async (userId: string): Promise<House[] | null> => {
    try {
      const res = await fetch(`${API}/api/houses/mine?userId=${userId}`);
      if (!res.ok) {
        setError('Error al cargar las casas');
        return null;
      }
      const data = await res.json().catch(() => null);
      const list: House[] = Array.isArray(data) ? data : data ? [data] : [];
      setHouses(list);
      return list;
    } catch {
      setError('Error de conexión');
      return null;
    }
  }, []);

  const joinWithCode = useCallback(
    async (rawCode: string) => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        router.push('/login');
        return;
      }
      const code = extractCode(rawCode);
      if (!code) {
        setJoinError('Ingresá un código o enlace de invitación.');
        return;
      }
      setJoining(true);
      setJoinError(null);
      setSuccess(null);
      try {
        const res = await fetch(`${API}/api/houses/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            userId,
            userName: localStorage.getItem('userName') || '',
            userEmail: localStorage.getItem('userEmail') || '',
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setJoinError(data?.message || data?.error || 'El código o enlace de invitación es inválido o ha expirado');
          setShowJoin(true);
          return;
        }
        localStorage.removeItem('pendingInviteCode');
        await fetchHouses(userId);
        const joinedName = data?.house?.name || data?.name;
        setSuccess(joinedName ? `Te uniste a la casa "${joinedName}" correctamente.` : 'Te uniste a la casa correctamente.');
        setShowJoin(false);
        setJoinInput('');
      } catch {
        setJoinError('Error de conexión');
        setShowJoin(true);
      } finally {
        setJoining(false);
      }
    },
    [fetchHouses, router]
  );

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('invite') || localStorage.getItem('pendingInviteCode');

    const init = async () => {
      const list = await fetchHouses(userId);
      if (code) {
        await joinWithCode(code);
        window.history.replaceState(null, '', '/select-house');
      } else if (list && list.length === 0) {
        router.push('/setup');
        return;
      }
      setLoading(false);
    };

    init();
  }, [router, fetchHouses, joinWithCode]);

  const handleSelectHouse = (house: House) => {
    localStorage.setItem('activeHouseId', house.id);
    setActiveHouse(house);
    router.push('/dashboard');
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    joinWithCode(joinInput);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando casas...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <h1 className="text-center font-display text-3xl font-semibold tracking-tight text-ink">Mis casas</h1>
          <p className="mt-2 text-center text-sm text-muted">
            Elegí una casa para continuar, creá una nueva o unite con un código
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium text-ink-2 text-center">{success}</p>
        )}

        {houses.length === 0 && !error ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
            <p className="text-sm text-muted">No tenés casas registradas todavía.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {houses.map((house) => {
              const period = house.periods?.find((p) => !p.is_closed) || house.periods?.[0];
              return (
                <li
                  key={house.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
                >
                  <div>
                    <span className="block font-display text-lg font-semibold text-ink">{house.name}</span>
                    {period?.month && period?.year && (
                      <span className="mt-1 block text-sm text-muted">
                        Período abierto: {String(period.month).padStart(2, '0')}/{period.year}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectHouse(house)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
                  >
                    Ingresar
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-3 pt-2">
          <Link
            href="/setup"
            className="flex w-full justify-center rounded-lg border border-transparent bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
          >
            Crear nueva casa
          </Link>
          <button
            type="button"
            onClick={() => setShowJoin((v) => !v)}
            className="flex w-full justify-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-2"
          >
            Unirme a una casa
          </button>
        </div>

        {showJoin && (
          <form onSubmit={handleJoinSubmit} className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <label htmlFor="inviteCode" className="block text-sm font-semibold text-ink-2">
              Código o enlace de invitación
            </label>
            <input
              id="inviteCode"
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="Pegá el código o el enlace completo"
              className="block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
            />
            {joinError && (
              <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">{joinError}</p>
            )}
            <button
              type="submit"
              disabled={joining}
              className="flex w-full justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 disabled:opacity-50"
            >
              {joining ? 'Uniéndome...' : 'Unirme'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
