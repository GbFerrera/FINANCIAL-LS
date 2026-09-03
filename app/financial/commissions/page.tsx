'use client'

import { LoadingAnimation, LoadingInline, LoadingScreen } from '@/components/ui/loading-animation'
 import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { DollarSign, Calendar as CalendarIcon, User as UserIcon, Clock, Wallet, Calculator, CreditCard } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatsCard } from "@/components/ui/stats-card"

interface AggregatedProfile {
  userId: string
  name: string
  email: string
  avatar?: string | null
  role: string
  hasFixedSalary: boolean
  fixedSalary: number | null
  hourRate: number
  minutesCompleted: number
  variablePay: number
  totalPay: number
  bonusPerTask?: number
  bonusCount?: number
  bonusTotal?: number
}

interface UserProfile {
   profile: {
     userId: string
     hasFixedSalary: boolean
     fixedSalary: number | null
     hourRate: number
   }
   summary: {
     minutesCompleted: number
     variablePay: number
     fixedSalary: number | null
     hasFixedSalary: boolean
     hourRate: number
     totalPay: number
     bonusPerTask?: number
     bonusCount?: number
     bonusTotal?: number
   }
   tasks: Array<{
     id: string
     title: string
     projectName: string | null
     minutes: number
     hasBonus?: boolean
    completedAt?: string | null
    date?: string | null
   }>
 }
 
interface UserCommissionRowProps {
  user: AggregatedProfile
  onUpdate: () => void
  canEdit?: boolean
}

function UserCommissionRow({ user, onUpdate, canEdit = true }: UserCommissionRowProps) {
  const [hasFixedSalary, setHasFixedSalary] = useState(user.hasFixedSalary)
  const [fixedSalary, setFixedSalary] = useState(user.fixedSalary?.toString() || "")
  const [hourRate, setHourRate] = useState(user.hourRate.toString())
  const [loading, setLoading] = useState(false)

  const currentFixedSalary = hasFixedSalary ? (parseFloat(fixedSalary.replace(",", ".")) || 0) : 0
  const serverVariablePay = (user as any).variablePay ?? 0
  const bonusPerTask = (user as any).bonusPerTask || 0
  const bonusCount = (user as any).bonusCount || 0
  const bonusTotal = (user as any).bonusTotal ?? (bonusPerTask * bonusCount)
  const totalPay = (user as any).totalPay ?? (serverVariablePay + currentFixedSalary)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const body = {
        hasFixedSalary,
        fixedSalary: fixedSalary !== "" ? parseFloat(fixedSalary.replace(",", ".")) : null,
        hourRate: hourRate !== "" ? parseFloat(hourRate.replace(",", ".")) : 0
      }
      const res = await fetch(`/api/commissions/${user.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
   return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Comissões</h2>
          <p className="text-muted-foreground">
            Gerencie salários e acompanhe os ganhos da equipe
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[240px]">
                <div className="flex items-center gap-2">
                  {selectedUserId === "all" ? (
                    <>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <span className="truncate">Todos os Colaboradores</span>
                    </>
                  ) : (
                    <>
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={users.find((u) => u.userId === selectedUserId)?.avatar || undefined}
                        />
                        <AvatarFallback>
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">
                        {users.find((u) => u.userId === selectedUserId)?.name || "Selecione..."}
                      </span>
                    </>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                {(session?.user.role === "ADMIN" || commissionAccess === "ALL_EDIT") && (
                  <SelectItem value="all">Todos os Colaboradores</SelectItem>
                )}
                {((commissionAccess === "OWN_READ" || commissionAccess === "OWN_EDIT") ? users.filter(u => u.userId === session?.user.id) : users).map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                        {format(date.to, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      format(date.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    <span>Selecione o período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          {selectedUserId !== "all" && <TabsTrigger value="settings">Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {selectedUserId === "all" ? (
            <div className="flex flex-col gap-4">
              {users.map((user) => (
                <UserCommissionRow 
                  key={user.userId} 
                  user={user} 
                  onUpdate={loadUsers} 
                  canEdit={
                    session?.user.role === "ADMIN" ||
                    commissionAccess === "ALL_EDIT" ||
                    (commissionAccess === "OWN_EDIT" && user.userId === session?.user.id)
                  }
                />
              ))}
            </div>
          ) : (
            userData && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatsCard
                    title="Minutos Concluídos"
                    value={userData.summary.minutesCompleted}
                    icon={Clock}
                    color="blue"
                  />
                  <StatsCard
                    title="Valor Hora"
                    value={formatCurrency(userData.summary.hourRate)}
                    icon={Calculator}
                    color="blue"
                  />
                  <StatsCard
                    title="Bônus/Tarefa"
                    value={formatCurrency((userData.summary as any).bonusPerTask ?? 0)}
                    icon={DollarSign}
                    color="blue"
                  />
                  <StatsCard
                    title="Salário Fixo"
                    value={
                      userData.summary.hasFixedSalary && userData.summary.fixedSalary !== null
                        ? formatCurrency(userData.summary.fixedSalary)
                        : "—"
                    }
                    icon={Wallet}
                    color="blue"
                  />
                  <StatsCard
                    title="Total a Pagar"
                    value={formatCurrency(userData.summary.totalPay)}
                    icon={DollarSign}
                    color="blue"
                    description="Fixo + Variável"
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Tarefas Concluídas</CardTitle>
                    <CardDescription>
                      Lista de tarefas finalizadas no período selecionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userData.tasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-muted p-4 mb-4">
                          <CreditCard className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">Nenhuma tarefa encontrada</h3>
                        <p className="text-muted-foreground max-w-sm mt-2">
                          Não há registros de tarefas concluídas para este colaborador no período selecionado.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tarefa</TableHead>
                            <TableHead>Projeto</TableHead>
                            <TableHead>Minutos</TableHead>
                            <TableHead>Bônus</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userData.tasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">{task.title}</TableCell>
                              <TableCell>{task.projectName || "—"}</TableCell>
                              <TableCell>{task.minutes} min</TableCell>
                              <TableCell>{task.hasBonus ? 'Sim' : '—'}</TableCell>
                              <TableCell>{formatDate(task.date || task.completedAt)}</TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const rate = task.hasBonus ? (userData.summary as any).bonusPerTask ?? 0 : userData.summary.hourRate
                                  return formatCurrency((task.minutes / 60) * rate)
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Financeiras</CardTitle>
              <CardDescription>
                Defina as regras de remuneração para {users.find(u => u.userId === selectedUserId)?.name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2 border p-4 rounded-md">
                <Checkbox
                  id="hasFixedSalary"
                  checked={hasFixedSalary}
                  onCheckedChange={(v) => setHasFixedSalary(!!v)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="hasFixedSalary"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Possui salário fixo?
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Ative se o colaborador recebe um valor fixo mensal além ou em vez das comissões.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Salário Fixo (Mensal)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-9"
                      value={fixedSalary}
                      onChange={(e) => setFixedSalary(e.target.value)}
                      placeholder="0,00"
                      disabled={!hasFixedSalary}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Valor Hora (60 min)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-9"
                      value={hourRate}
                      onChange={(e) => setHourRate(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Valor Bônus por Tarefa</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="pl-9"
                      value={bonusPerTask}
                      onChange={(e) => setBonusPerTask(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveConfig} size="lg" disabled={!(session?.user.role === "ADMIN" || commissionAccess === "ALL_EDIT" || (commissionAccess === "OWN_EDIT" && selectedUserId === session?.user.id))}>
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
