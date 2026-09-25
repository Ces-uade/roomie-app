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
        const houseRes = await fetch(`http://localhost:3001/api/houses/mine?userId=${userId}`);
        if (!houseRes.ok) {
          router.push('/setup');
          return;
        }

        const houseData = await houseRes.json().catch(() => null);
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

        const expensesRes = await fetch(`http://localhost:3001/api/expenses?periodId=${periodId}`);
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando gastos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-gray-900">Historial de Gastos</h1>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                ← Volver al Dashboard
              </Link>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Gastos registrados en el período activo
            </p>
          </div>

          <Link
            href="/expenses/new"
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Nuevo gasto
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Resumen del total */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
          <span className="text-sm font-medium text-gray-500">Total del período</span>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            ${totalPeriod.toFixed(2)}
          </p>
        </div>

        {/* Lista de gastos */}
        {expenses.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs">
            <p className="text-base text-gray-600">
              Todavía no hay gastos registrados en este período
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
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
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-gray-900">
                          {expense.concept}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">
                          {expense.date}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Pagado por: <span className="font-medium text-gray-900">{payerName}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className="text-xl font-bold text-gray-900">
                        ${Number(expense.amount).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExpand(expense.id)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        {isExpanded ? 'Ocultar reparto' : 'Ver reparto'}
                      </button>
                    </div>
                  </div>

                  {/* Reparto desplegable */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Participantes y cuotas
                      </h4>
                      {expense.expense_splits && expense.expense_splits.length > 0 ? (
                        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
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
                                <span className="text-gray-900">{participantName}</span>
                                <span className="font-medium text-gray-900">
                                  ${Number(split.amount).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">
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
