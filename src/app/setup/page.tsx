'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const months = [
    { value: 1, label: '1 - Enero' },
    { value: 2, label: '2 - Febrero' },
    { value: 3, label: '3 - Marzo' },
    { value: 4, label: '4 - Abril' },
    { value: 5, label: '5 - Mayo' },
    { value: 6, label: '6 - Junio' },
    { value: 7, label: '7 - Julio' },
    { value: 8, label: '8 - Agosto' },
    { value: 9, label: '9 - Septiembre' },
    { value: 10, label: '10 - Octubre' },
    { value: 11, label: '11 - Noviembre' },
    { value: 12, label: '12 - Diciembre' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setError('El nombre de la casa no puede estar vacío ni contener solo espacios.');
      return;
    }

    if (!month) {
      setError('Debes seleccionar un mes.');
      return;
    }

    if (!year) {
      setError('Debes seleccionar un año.');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      setError('No se encontró el ID de usuario. Por favor, inicia sesión nuevamente.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/houses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameTrimmed,
          month: Number(month),
          year: Number(year),
          userId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Error al configurar la casa');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-md">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Configuración de la casa - RM-01
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="houseName" className="block text-sm font-medium text-gray-700">
                Nombre de la casa
              </label>
              <input
                id="houseName"
                name="houseName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                Mes
              </label>
              <select
                id="month"
                name="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Selecciona un mes</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                Año
              </label>
              <select
                id="year"
                name="year"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Selecciona un año</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
