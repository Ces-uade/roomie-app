'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Period {
  id: string;
  house_id?: string;
  month?: number;
  year?: number;
  is_closed?: boolean;
}

interface House {
  id: string;
  name: string;
  month?: number;
  year?: number;
  periods?: Period[];
}

interface Roommate {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [house, setHouse] = useState<House | null>(null);
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [newRoommateName, setNewRoommateName] = useState('');
  const [roommateError, setRoommateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [newMonth, setNewMonth] = useState('1');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const fetchRoommates = async (houseId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/roommates?houseId=${houseId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.roommates || [];
        setRoommates(list);
      }
    } catch {
      // Error fetching roommates
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const fetchHouse = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`);
        if (!res.ok) {
          router.push('/setup');
          return;
        }

        const data = await res.json().catch(() => null);
        const houseData = data?.house || data;

        if (!houseData || !houseData.id) {
          router.push('/setup');
          return;
        }

        setHouse(houseData);
        await fetchRoommates(houseData.id);
      } catch {
        router.push('/setup');
      } finally {
        setLoading(false);
      }
    };

    fetchHouse();
  }, [router]);

  const handleAddRoommate = async (e: FormEvent) => {
    e.preventDefault();
    setRoommateError(null);

    const trimmedName = newRoommateName.trim();
    if (!trimmedName) {
      setRoommateError('El nombre no puede estar vacío');
      return;
    }

    if (!house?.id) return;

    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/roommates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseId: house.id,
          house_id: house.id,
          name: trimmedName,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Error al agregar el conviviente');
      }

      setNewRoommateName('');
      await fetchRoommates(house.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setRoommateError(err.message);
      } else {
        setRoommateError('Ocurrió un error inesperado');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openCloseModal = () => {
    if (house?.periods?.[0]?.month && house?.periods?.[0]?.year) {
      const curM = house.periods[0].month;
      const curY = house.periods[0].year;
      const nextM = curM === 12 ? 1 : curM + 1;
      const nextY = curM === 12 ? curY + 1 : curY;
      setNewMonth(nextM.toString());
      setNewYear(nextY.toString());
    }
    setCloseError(null);
    setShowCloseModal(true);
  };

  const handleClosePeriod = async (e: FormEvent) => {
    e.preventDefault();
    setCloseError(null);

    const periodId = house?.periods?.[0]?.id;
    if (!periodId || !house?.id) {
      setCloseError('No se encontró el período activo');
      return;
    }

    setClosing(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/periods/${periodId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseId: house.id,
          newMonth: parseInt(newMonth, 10),
          newYear: parseInt(newYear, 10),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error al cerrar el período');
      }

      window.location.reload();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCloseError(err.message);
      } else {
        setCloseError('Ocurrió un error inesperado');
      }
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">{house?.name}</h1>
            <p className="mt-1 text-sm text-gray-500">Panel principal y gestión de convivientes</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/balances"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Ver Saldos y Deudas
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Ver Historial de Gastos
            </Link>
            <Link
              href="/expenses/new"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Nuevo Gasto
            </Link>
            <button
              type="button"
              onClick={openCloseModal}
              className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Cerrar mes actual
            </button>
          </div>
        </div>

        {roommates.length < 2 && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            Debes registrar al menos 2 convivientes para habilitar los gastos
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Formulario Agregar conviviente */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold text-gray-900">Agregar conviviente</h2>
            <form className="mt-4 space-y-4" onSubmit={handleAddRoommate}>
              <div>
                <label htmlFor="roommateName" className="block text-sm font-medium text-gray-700">
                  Nombre o alias
                </label>
                <input
                  id="roommateName"
                  name="roommateName"
                  type="text"
                  required
                  value={newRoommateName}
                  onChange={(e) => setNewRoommateName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 sm:text-sm"
                  placeholder="Ej. Juan Pérez"
                />
                {roommateError && (
                  <p className="mt-2 text-sm text-red-600">{roommateError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Agregar conviviente'}
              </button>
            </form>
          </div>

          {/* Lista de convivientes */}
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold text-gray-900">
              Convivientes ({roommates.length})
            </h2>
            <div className="mt-4">
              {roommates.length === 0 ? (
                <p className="text-sm text-gray-500">No hay convivientes registrados aún.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {roommates.map((roommate) => (
                    <li key={roommate.id} className="py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{roommate.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {showCloseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Cerrar Período</h3>
              <p className="mt-1 text-sm text-gray-500">
                Selecciona el mes y año para el próximo período a abrir.
              </p>

              {closeError && (
                <p className="mt-2 text-sm text-red-600">{closeError}</p>
              )}

              <form onSubmit={handleClosePeriod} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="closeMonth" className="block text-sm font-medium text-gray-700">
                    Mes
                  </label>
                  <select
                    id="closeMonth"
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-red-500 focus:outline-hidden focus:ring-red-500 sm:text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="closeYear" className="block text-sm font-medium text-gray-700">
                    Año
                  </label>
                  <input
                    id="closeYear"
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-red-500 focus:outline-hidden focus:ring-red-500 sm:text-sm"
                    required
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    disabled={closing}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={closing}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {closing ? 'Cerrando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
