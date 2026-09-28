'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHouse, House } from '@/context/HouseContext';

export default function SelectHousePage() {
  const router = useRouter();
  const { setActiveHouse } = useHouse();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const fetchHouses = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`
        );

        if (!res.ok) {
          setError('Error al cargar las casas');
          return;
        }

        const data = await res.json().catch(() => null);
        const list: House[] = Array.isArray(data) ? data : data ? [data] : [];
        setHouses(list);
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchHouses();
  }, [router]);

  const handleSelectHouse = (house: House) => {
    setActiveHouse(house);
    router.push('/dashboard');
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
          <h1 className="text-center font-display text-3xl font-semibold tracking-tight text-ink">
            Seleccionar casa
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            Elegí una casa para continuar o creá una nueva
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">
            {error}
          </p>
        )}

        {houses.length === 0 && !error ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
            <p className="text-sm text-muted">No tenés casas registradas todavía.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {houses.map((house) => (
              <li key={house.id}>
                <button
                  type="button"
                  onClick={() => handleSelectHouse(house)}
                  className="w-full rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
                >
                  <span className="block font-display text-lg font-semibold text-ink">
                    {house.name}
                  </span>
                  {house.periods && house.periods.length > 0 && (
                    <span className="mt-1 block text-sm text-muted">
                      Período activo: {house.periods[0].month}/{house.periods[0].year}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-2">
          <Link
            href="/setup"
            className="flex w-full justify-center rounded-lg border border-transparent bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
          >
            + Crear nueva casa
          </Link>
        </div>
      </div>
    </div>
  );
}
