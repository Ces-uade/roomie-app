'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BalanceItem {
  id: string;
  name: string;
  balance: number;
}

interface DebtItem {
  deudor_id: string;
  deudor: string;
  acreedor_id: string;
  acreedor: string;
  monto: number;
}

interface PaymentItem {
  id: string;
  amount: number;
  created_at: string;
  paid_by: { id: string; name: string };
  paid_to: { id: string; name: string };
}

interface Period {
  id: string;
  is_closed?: boolean;
}

export default function BalancesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

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
          houseData.periods?.find((p: Period) => !p.is_closed) ??
          houseData.periods?.[0];
        const periodId = activePeriod?.id ?? houseData.periodId;
        const houseId = houseData.id;

        if (!periodId || !houseId) {
          setLoading(false);
          return;
        }

        const [balancesRes, paymentsRes] = await Promise.all([
          fetch(`http://localhost:3001/api/balances?periodId=${periodId}&houseId=${houseId}`),
          fetch(`http://localhost:3001/api/payments?periodId=${periodId}`),
        ]);

        if (balancesRes.ok) {
          const bData = await balancesRes.json();
          setBalances(Array.isArray(bData?.balances) ? bData.balances : []);
          setDebts(Array.isArray(bData?.debts) ? bData.debts : []);
        }

        if (paymentsRes.ok) {
          const pData = await paymentsRes.json();
          setPayments(Array.isArray(pData) ? pData : []);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando saldos y deudas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900">Saldos y Deudas</h1>
            <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              ← Dashboard
            </Link>
          </div>
          <p className="mt-1 text-sm text-gray-500">Estado financiero del período activo</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {/* Saldos por conviviente */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Saldos por conviviente</h2>
          {balances.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No hay saldos disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((item) => {
                const bal = Number(item.balance);
                let label: string;
                let badgeCls: string;
                let amtCls: string;

                if (bal > 0) {
                  label = 'A favor';
                  badgeCls = 'bg-green-50 text-green-700 border-green-200';
                  amtCls = 'text-green-600';
                } else if (bal < 0) {
                  label = 'A pagar';
                  badgeCls = 'bg-red-50 text-red-700 border-red-200';
                  amtCls = 'text-red-600';
                } else {
                  label = 'Saldado';
                  badgeCls = 'bg-gray-100 text-gray-700 border-gray-300';
                  amtCls = 'text-gray-700';
                }

                return (
                  <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">{item.name}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeCls}`}>
                        {label}
                      </span>
                    </div>
                    <p className={`mt-3 text-2xl font-bold ${amtCls}`}>${Math.abs(bal).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deudas pendientes */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Deudas pendientes</h2>
          {debts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No hay deudas pendientes en este período
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
              {debts.map((d, i) => (
                <div key={i} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-900">
                  <span>
                    <strong>{d.deudor}</strong> le debe a <strong>{d.acreedor}</strong>:{' '}
                    <span className="font-bold text-red-600">${Number(d.monto).toFixed(2)}</span>
                  </span>
                  <Link
                    className="ml-4 text-blue-600 hover:underline"
                    href={`/payments/new?debtorId=${d.deudor_id}&debtorName=${d.deudor}&creditorId=${d.acreedor_id}&creditorName=${d.acreedor}&amount=${d.monto}`}
                  >
                    Registrar pago
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial de Pagos */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Historial de Pagos</h2>
          {payments.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No hay pagos registrados
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
              {payments.map((p) => {
                const pagador = typeof p.paid_by === 'object' ? p.paid_by.name : String(p.paid_by);
                const receptor = typeof p.paid_to === 'object' ? p.paid_to.name : String(p.paid_to);
                const fecha = p.created_at ? p.created_at.split('T')[0] : '';

                return (
                  <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-900">
                    <div>
                      {fecha && (
                        <span className="mr-3 text-xs text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">{fecha}</span>
                      )}
                      <strong>{pagador}</strong> le pagó a <strong>{receptor}</strong>
                    </div>
                    <span className="font-bold text-green-600">${Number(p.amount).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
