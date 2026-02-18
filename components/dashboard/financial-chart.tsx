"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react"

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
  const [selectedPeriod, setSelectedPeriod] = useState('6m')
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expenses)))
  
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0)
  const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0)
  const totalProfit = totalIncome - totalExpenses
  const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0

  return (
    <div className="bg-card shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg leading-6 font-medium text-card-foreground">
            Visão Financeira
          </h3>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="block w-32 pl-3 pr-10 py-2 text-base border-input bg-background text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
          >
            <option value="3m">3 meses</option>
            <option value="6m">6 meses</option>
            <option value="12m">12 meses</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Receita Total</p>
                <p className="text-lg font-semibold text-green-900 dark:text-green-100">{formatCurrency(totalIncome)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Despesas Total</p>
                <p className="text-lg font-semibold text-red-900 dark:text-red-100">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>
          </div>
          
          <div className={`${totalProfit >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'} p-4 rounded-lg`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className={`h-6 w-6 ${totalProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`} />
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${totalProfit >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'}`}>Lucro Líquido</p>
                <p className={`text-lg font-semibold ${totalProfit >= 0 ? 'text-blue-900 dark:text-blue-100' : 'text-red-900 dark:text-red-100'}`}>
                  {formatCurrency(totalProfit)}
                </p>
                <p className={`text-xs ${totalProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  Margem: {profitMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Mês</span>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span>Receita</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span>Despesas</span>
              </div>
            </div>
          </div>
          
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between text-sm font-medium text-card-foreground">
                <span>{item.month}</span>
                <span className={totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {formatCurrency(item.profit)}
                </span>
              </div>
              
              <div className="space-y-1">
                {/* Income bar */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-16">Receita</span>
                  <div className="flex-1 bg-secondary rounded-full h-4 relative">
                    <div 
                      className="bg-green-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${(item.income / maxValue) * 100}%` }}
                    />
                    <span className="absolute right-2 top-0 text-xs text-white font-medium leading-4">
                      {formatCurrency(item.income)}
                    </span>
                  </div>
                </div>
                
                {/* Expenses bar */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-16">Despesas</span>
                  <div className="flex-1 bg-secondary rounded-full h-4 relative">
                    <div 
                      className="bg-red-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${(item.expenses / maxValue) * 100}%` }}
                    />
                    <span className="absolute right-2 top-0 text-xs text-white font-medium leading-4">
                      {formatCurrency(item.expenses)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button className="w-full bg-primary/10 text-primary py-2 px-4 rounded-md hover:bg-primary/20 transition-colors">
            Ver relatório completo
          </button>
        </div>
      </div>
    </div>
  )
}