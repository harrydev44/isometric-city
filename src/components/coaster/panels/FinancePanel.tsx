'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { T, useGT } from 'gt-next';

interface FinancePanelProps {
  cash: number;
  entranceRevenue: number;
  rideRevenue: number;
  shopRevenue: number;
  income: number;
  expenses: number;
  loan: number;
  onClose: () => void;
}

export default function FinancePanel({
  cash,
  entranceRevenue,
  rideRevenue,
  shopRevenue,
  income,
  expenses,
  loan,
  onClose,
}: FinancePanelProps) {
  const gt = useGT();
  return (
    <div className="absolute top-20 right-6 z-50 w-72">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <T>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Finance</div>
              <div className="text-lg font-semibold">Park Ledger</div>
            </div>
          </T>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close finance panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <T><span>Cash on Hand</span></T>
            <span className="font-semibold">${cash.toLocaleString()}</span>
          </div>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Income</div></T>
            <div className="flex items-center justify-between">
              <T><span>Admissions</span></T>
              <span>${entranceRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <T><span>Ride Tickets</span></T>
              <span>${rideRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <T><span>Shops & Stalls</span></T>
              <span>${shopRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <T><span>Total Income</span></T>
              <span>${income.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-2">
            <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expenses</div></T>
            <div className="flex items-center justify-between font-semibold">
              <T><span>Total Expenses</span></T>
              <span>${expenses.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <T><span>Outstanding Loan</span></T>
            <span>${loan.toLocaleString()}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
