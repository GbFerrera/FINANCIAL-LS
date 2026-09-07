"use client"

import { useState } from "react"
import { StatsCard } from "@/components/ui/stats-card"
import { CurrencyAmount, formatCurrencyParts } from "@/components/ui/currency-amount"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface FinancialData {
  month: string
  income: number
  expenses: number
  profit: number
}

interface FinancialChartProps {
  data: FinancialData[]
}

export function FinancialChart({ data }: FinancialChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("6m")

  const formatCurrency = (value: number, compact = false) => {
    if (compact) {
      return formatCurrencyParts(value).full
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expenses)), 1)

  const totalIncome = data.reduce((sum, d) => sum + d.income, 0)
  const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0)
  const totalProfit = totalIncome - totalExpenses
  const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0

  return (
    <Card className="@container/financial h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">Visão Financeira</CardTitle>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">3 meses</SelectItem>
            <SelectItem value="6m">6 meses</SelectItem>
            <SelectItem value="12m">12 meses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 @min-[22rem]/financial:grid-cols-2 @min-[42rem]/financial:grid-cols-3">
          <StatsCard title="Receita Total" value={<CurrencyAmount value={totalIncome} />} />
          <StatsCard title="Despesas Total" value={<CurrencyAmount value={totalExpenses} />} />
          <StatsCard
            title="Lucro Líquido"
            value={<CurrencyAmount value={totalProfit} />}
            description={`Margem: ${profitMargin.toFixed(1)}%`}
            className="col-span-1 @min-[22rem]/financial:col-span-2 @min-[42rem]/financial:col-span-1"
          />
        </div>

        <div className="space-y-4">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Mês</span>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-foreground/70" />
                <span>Receita</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span>Despesas</span>
              </div>
            </div>
          </div>

          {data.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex justify-between text-sm font-medium text-foreground">
                <span>{item.month}</span>
                <span className="tabular-nums text-muted-foreground">{formatCurrency(item.profit, true)}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted-foreground">Receita</span>
                  <div className="relative h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-foreground/80 transition-all duration-500"
                      style={{ width: `${(item.income / maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(item.income, true)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted-foreground">Despesas</span>
                  <div className="relative h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-muted-foreground/35 transition-all duration-500"
                      style={{ width: `${(item.expenses / maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(item.expenses, true)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="w-full rounded-md border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ver relatório completo
        </button>
      </CardContent>
    </Card>
  )
}