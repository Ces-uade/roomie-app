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
          houseData.periods?.find((p: Period) => !p.is_closed) ??
          houseData.periods?.[0];
        const periodId = activePeriod?.id ?? houseData.periodId;
        const houseId = houseData.id;

        if (!periodId || !houseId) {
          setLoading(false);
          return;
        }

        const [balancesRes, paymentsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/balances?periodId=${periodId}&houseId=${houseId}`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments?periodId=${periodId}`),
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
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted">Cargando saldos y deudas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Saldos y Deudas</h1>
            <Link href="/dashboard" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
              ← Dashboard
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">Estado financiero del período activo</p>
        </div>

        {error && (
          <div className="rounded-lg border border-neg/20 bg-neg-soft p-4 text-sm font-medium text-neg">{error}</div>
        )}

        {/* Saldos por conviviente */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Saldos por conviviente</h2>
          {balances.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
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
                  badgeCls = 'bg-pos/10 text-pos border-pos/30';
                  amtCls = 'text-pos';
                } else if (bal < 0) {
                  label = 'A pagar';
                  badgeCls = 'bg-neg-soft text-neg border-neg/30';
                  amtCls = 'text-neg';
                } else {
                  label = 'Saldado';
                  badgeCls = 'bg-surface-2 text-ink-2 border-line-strong';
                  amtCls = 'text-ink-2';
                }

                return (
                  <div key={item.id} className="rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-ink">{item.name}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeCls}`}>
                        {label}
                      </span>
                    </div>
                    <p className={`mt-3 font-display text-2xl font-semibold ${amtCls}`}>${Math.abs(bal).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Deudas pendientes */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink">Deudas pendientes</h2>
          {debts.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
              No hay deudas pendientes en este período
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
              {debts.map((d, i) => (
                <div key={i} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink">
                  <span>
                    <strong>{d.deudor}</strong> le debe a <strong>{d.acreedor}</strong>:{' '}
                    <span className="font-semibold text-neg">${Number(d.monto).toFixed(2)}</span>
                  </span>
                  <Link
                    className="ml-4 font-semibold text-brand hover:underline"
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
          <h2 className="font-display text-xl font-semibold text-ink">Historial de Pagos</h2>
          {payments.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
              No hay pagos registrados
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
              {payments.map((p) => {
                const pagador = typeof p.paid_by === 'object' ? p.paid_by.name : String(p.paid_by);
                const receptor = typeof p.paid_to === 'object' ? p.paid_to.name : String(p.paid_to);
                const fecha = p.created_at ? p.created_at.split('T')[0] : '';

                return (
                  <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                    <div>
                      {fecha && (
                        <span className="mr-3 text-xs text-muted bg-surface-2 rounded-md px-2 py-0.5">{fecha}</span>
                      )}
                      <strong>{pagador}</strong> le pagó a <strong>{receptor}</strong>
                    </div>
                    <span className="font-semibold text-pos">${Number(p.amount).toFixed(2)}</span>
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