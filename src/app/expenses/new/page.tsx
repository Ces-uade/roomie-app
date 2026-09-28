'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Roommate {
  id: string;
  name: string;
}

interface Period {
  id: string;
  is_closed?: boolean;
}

export default function NewExpensePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [periodId, setPeriodId] = useState<string | null>(null);
  const [roommates, setRoommates] = useState<Roommate[]>([]);

  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const houseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`);
        if (!houseRes.ok) {
          router.push('/setup');
          return;
        }

        const data = await houseRes.json().catch(() => null);
        const houseData = Array.isArray(data) ? data[0] : (data?.house || data);
        if (!houseData || !houseData.id) {
          router.push('/setup');
          return;
        }

        const activePeriod =
          houseData.periods?.find((p: Period) => !p.is_closed) ||
          houseData.periods?.[0];

        const activePeriodId = activePeriod?.id || houseData.periodId || null;
        setPeriodId(activePeriodId);

        const roommatesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/roommates?houseId=${houseData.id}`);
        if (roommatesRes.ok) {
          const roommatesData = await roommatesRes.json();
          const list: Roommate[] = Array.isArray(roommatesData)
            ? roommatesData
            : roommatesData?.roommates || [];

          setRoommates(list);
          setParticipants(list.map((r) => r.id));
          if (list.length > 0) {
            setPaidBy(list[0].id);
          }
        }
      } catch {
        router.push('/setup');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleParticipantToggle = (id: string) => {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (participants.length === 0) {
      setError('Seleccioná al menos un conviviente para dividir el gasto');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    if (!periodId) {
      setError('No se encontró un período activo para la casa');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId,
          paidBy,
          concept: concept.trim(),
          amount: parsedAmount,
          date,
          participants,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error al registrar el gasto');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-ink">Nuevo Gasto</h1>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            Volver al Dashboard
          </Link>
        </div>

        {roommates.length < 2 ? (
          <div className="rounded-lg border border-warn/20 bg-warn-soft p-4 text-sm font-medium text-warn">
            Necesitas al menos 2 convivientes para registrar gastos
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="concept" className="block text-sm font-semibold text-ink-2">
                Concepto
              </label>
              <input
                id="concept"
                name="concept"
                type="text"
                required
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                placeholder="Ej. Supermercado"
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-semibold text-ink-2">
                Monto
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="paidBy" className="block text-sm font-semibold text-ink-2">
                Pagado por
              </label>
              <select
                id="paidBy"
                name="paidBy"
                required
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
              >
                {roommates.map((roommate) => (
                  <option key={roommate.id} value={roommate.id}>
                    {roommate.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-semibold text-ink-2">
                Fecha
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-ink-2 mb-2">
                Participantes
              </span>
              <div className="space-y-2 rounded-lg border border-line bg-bg p-3">
                {roommates.map((roommate) => (
                  <label
                    key={roommate.id}
                    className="flex items-center space-x-3 text-sm text-ink cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={participants.includes(roommate.id)}
                      onChange={() => handleParticipantToggle(roommate.id)}
                      className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                    />
                    <span>{roommate.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm font-medium text-neg text-center">{error}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full justify-center rounded-lg border border-transparent bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar Gasto'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}