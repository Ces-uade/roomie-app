'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Split {
  id: string;
  roommate_id: string;
  amount: number;
  roommates?: { name: string } | { name: string }[];
}

interface Expense {
  id: string;
  period_id: string;
  paid_by: string;
  concept: string;
  amount: number;
  date: string;
  roommates?: { name: string } | { name: string }[];
  expense_splits?: Split[];
}

interface Period {
  id: string;
  is_closed?: boolean;
}

export default function ExpensesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});

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
        const houseData = Array.isArray(data) && data.length > 0 ? data[data.length - 1] : (data?.house || data);
        if (!houseData || !houseData.id) {
          router.push('/setup');
          return;
        }

        const activePeriod =
          houseData.periods?.find((p: Period) => !p.is_closed) ||
          houseData.periods?.[0];

        const periodId = activePeriod?.id || houseData.periodId;
        if (!periodId) {
          setExpenses([]);
          setLoading(false);
          return;
        }

        const expensesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/expenses?periodId=${periodId}`);
        if (!expensesRes.ok) {
          throw new Error('Error al cargar los gastos');
        }

        const expensesData = await expensesRes.json();
        setExpenses(Array.isArray(expensesData) ? expensesData : []);
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

    fetchData();
  }, [router]);

  const toggleExpand = (expenseId: string) => {
    setExpandedExpenses((prev) => ({
      ...prev,
      [expenseId]: !prev[expenseId],
    }));
  };

  const getRoommateName = (roommatesData?: { name: string } | { name: string }[], fallbackId?: string) => {
    if (!roommatesData) return fallbackId || 'Desconocido';
    if (Array.isArray(roommatesData)) {
      return roommatesData[0]?.name || fallbackId || 'Desconocido';
    }
    return roommatesData.name || fallbackId || 'Desconocido';
  };

  const totalPeriod = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando gastos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Historial de Gastos</h1>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
              >
                ← Volver al Dashboard
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted">
              Gastos registrados en el período activo
            </p>
          </div>

          <Link
            href="/expenses/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
          >
            Nuevo gasto
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-neg/20 bg-neg-soft p-4 text-sm font-medium text-neg">
            {error}
          </div>
        )}

        {/* Resumen del total */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
          <span className="text-sm font-medium text-muted">Total del período</span>
          <p className="font-display text-3xl font-semibold text-ink mt-1">
            ${totalPeriod.toFixed(2)}
          </p>
        </div>

        {/* Lista de gastos */}
        {expenses.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
            <p className="text-base text-ink-2">
              Todavía no hay gastos registrados en este período
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              Total: $0.00
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {expenses.map((expense) => {
              const isExpanded = !!expandedExpenses[expense.id];
              const payerName = getRoommateName(expense.roommates, expense.paid_by);

              return (
                <div
                  key={expense.id}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-ink">
                          {expense.concept}
                        </span>
                        <span className="text-xs text-muted bg-surface-2 rounded-md px-2 py-0.5">
                          {expense.date}
                        </span>
                      </div>
                      <p className="text-sm text-ink-2">
                        Pagado por: <span className="font-medium text-ink">{payerName}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className="font-display text-xl font-semibold text-ink">
                        ${Number(expense.amount).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpand(expense.id)}
                        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2 focus:outline-hidden focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg"
                      >
                        {isExpanded ? 'Ocultar reparto' : 'Ver reparto'}
                      </button>
                    </div>
                  </div>

                  {/* Reparto desplegable */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-line pt-4">
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                        Participantes y cuotas
                      </h4>
                      {expense.expense_splits && expense.expense_splits.length > 0 ? (
                        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
                          {expense.expense_splits.map((split) => {
                            const participantName = getRoommateName(
                              split.roommates,
                              split.roommate_id
                            );

                            return (
                              <div
                                key={split.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-ink">{participantName}</span>
                                <span className="font-medium text-ink">
                                  ${Number(split.amount).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          No hay detalles de reparto disponibles.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}