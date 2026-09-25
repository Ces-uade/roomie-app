'use client';

import { Suspense, useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Period {
  id: string;
  is_closed?: boolean;
}

function PaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const debtorId = searchParams.get('debtorId') || '';
  const debtorName = searchParams.get('debtorName') || '';
  const creditorId = searchParams.get('creditorId') || '';
  const creditorName = searchParams.get('creditorName') || '';
  const initialAmount = searchParams.get('amount') || '';

  const maxDebt = initialAmount ? parseFloat(initialAmount) : 0;

  const [periodId, setPeriodId] = useState<string | null>(null);
  const [amount, setAmount] = useState(initialAmount);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    const fetchPeriod = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/houses/mine?userId=${userId}`);
        if (!res.ok) {
          router.push('/setup');
          return;
        }

        const houseData = await res.json().catch(() => null);
        if (!houseData || !houseData.id) {
          router.push('/setup');
          return;
        }

        const activePeriod =
          houseData.periods?.find((p: Period) => !p.is_closed) ||
          houseData.periods?.[0];

        const pId = activePeriod?.id || houseData.periodId;
        setPeriodId(pId);
      } catch {
        router.push('/setup');
      } finally {
        setLoading(false);
      }
    };

    fetchPeriod();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser un número mayor a 0');
      return;
    }

    if (maxDebt > 0 && parsedAmount > maxDebt) {
      setError(`El monto pagado no puede superar la deuda pendiente ($${maxDebt.toFixed(2)})`);
      return;
    }

    if (!periodId) {
      setError('No se encontró un período activo');
      return;
    }

    if (!debtorId || !creditorId) {
      setError('Faltan los datos del pagador o receptor');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('http://localhost:3001/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId,
          paidBy: debtorId,
          paidTo: creditorId,
          amount: parsedAmount,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error al registrar el pago');
      }

      router.push('/balances');
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg rounded-xl bg-white p-8 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Registrar Pago</h1>
          <Link
            href="/balances"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Volver a Saldos
          </Link>
        </div>

        {/* Texto informativo de deuda pendiente */}
        <div className="mb-6 rounded-md bg-blue-50 p-4 border border-blue-200">
          <p className="text-sm text-blue-900 font-medium">
            Deuda pendiente: <span className="font-bold text-base">${maxDebt.toFixed(2)}</span>
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="debtor" className="block text-sm font-medium text-gray-700">
              Persona que paga
            </label>
            <input
              id="debtor"
              type="text"
              disabled
              value={debtorName}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-900 shadow-xs sm:text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="creditor" className="block text-sm font-medium text-gray-700">
              Persona que recibe
            </label>
            <input
              id="creditor"
              type="text"
              disabled
              value={creditorName}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-900 shadow-xs sm:text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Monto pagado
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={maxDebt > 0 ? maxDebt : undefined}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-indigo-500 sm:text-sm"
              placeholder="0.00"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? 'Registrando...' : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-gray-500">Cargando formulario...</p>
        </div>
      }
    >
      <PaymentForm />
    </Suspense>
  );
}
