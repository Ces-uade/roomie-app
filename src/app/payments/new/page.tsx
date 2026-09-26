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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/houses/mine?userId=${userId}`);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments`, {
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
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-ink">Registrar Pago</h1>
          <Link
            href="/balances"
            className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            Volver a Saldos
          </Link>
        </div>

        {/* Texto informativo de deuda pendiente */}
        <div className="mb-6 rounded-lg bg-brand-soft p-4 border border-brand/20">
          <p className="text-sm text-ink font-medium">
            Deuda pendiente: <span className="font-semibold text-base">${maxDebt.toFixed(2)}</span>
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="debtor" className="block text-sm font-semibold text-ink-2">
              Persona que paga
            </label>
            <input
              id="debtor"
              type="text"
              disabled
              value={debtorName}
              className="mt-1 block w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-ink-2 sm:text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="creditor" className="block text-sm font-semibold text-ink-2">
              Persona que recibe
            </label>
            <input
              id="creditor"
              type="text"
              disabled
              value={creditorName}
              className="mt-1 block w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-ink-2 sm:text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-semibold text-ink-2">
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
              className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink transition-colors focus:border-brand focus:outline-hidden focus:ring-2 focus:ring-brand/25 sm:text-sm"
              placeholder="0.00"
            />
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
        <div className="flex min-h-screen items-center justify-center bg-bg">
          <p className="text-muted">Cargando formulario...</p>
        </div>
      }
    >
      <PaymentForm />
    </Suspense>
  );
}