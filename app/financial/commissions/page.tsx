 "use client"
 
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
   }
   tasks: Array<{
     id: string
     title: string
     projectName: string | null
     minutes: number
    completedAt?: string | null
    date?: string | null
   }>
 }
 
 interface UserCommissionRowProps {
  user: AggregatedProfile
  onUpdate: () => void
}

function UserCommissionRow({ user, onUpdate }: UserCommissionRowProps) {
  const [hasFixedSalary, setHasFixedSalary] = useState(user.hasFixedSalary)
  const [fixedSalary, setFixedSalary] = useState(user.fixedSalary?.toString() || "")
  const [hourRate, setHourRate] = useState(user.hourRate.toString())
  const [loading, setLoading] = useState(false)

  const currentHourRate = parseFloat(hourRate.replace(",", ".")) || 0
  const currentFixedSalary = hasFixedSalary ? (parseFloat(fixedSalary.replace(",", ".")) || 0) : 0
  const variablePay = (user.minutesCompleted / 60) * currentHourRate
  const totalPay = variablePay + currentFixedSalary

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
      if (!res.ok) throw new Error("Falha ao salvar configurações")
      toast.success("Configurações salvas")
      onUpdate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-background">
                <AvatarImage src={user.avatar || undefined} />
                <AvatarFallback>
                  <UserIcon className="h-6 w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-0.5">
                <h3 className="text-lg font-semibold leading-none">{user.name}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
            <div className="flex gap-8 text-right">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Minutos concluídos</p>
                <p className="text-xl font-bold">{user.minutesCompleted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Variável (estimada)</p>
                <p className="text-xl font-bold text-green-500">{formatCurrency(variablePay)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total (estimado)</p>
                <p className="text-xl font-bold">{formatCurrency(totalPay)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr_auto] items-end border-t pt-6">
            <div className="flex items-center gap-2 pb-3">
              <Checkbox 
                id={`fixed-${user.userId}`} 
                checked={hasFixedSalary} 
                onCheckedChange={(checked) => setHasFixedSalary(!!checked)} 
              />
              <label 
                htmlFor={`fixed-${user.userId}`} 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Salário Fixo
              </label>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Valor do Salário Fixo (R$)
              </label>
              <Input 
                value={fixedSalary} 
                onChange={(e) => setFixedSalary(e.target.value)}
                disabled={!hasFixedSalary}
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Valor de 60 minutos (R$)
              </label>
              <Input 
                value={hourRate} 
                onChange={(e) => setHourRate(e.target.value)}
                className="bg-muted/50"
              />
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CommissionsPage() {
   const { data: session, status } = useSession()
   const router = useRouter()
   const [users, setUsers] = useState<AggregatedProfile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("all")
  const [date, setDate] = useState<DateRange | undefined>()
  const [loading, setLoading] = useState<boolean>(true)
  const [userData, setUserData] = useState<UserProfile | null>(null)
  const [hasFixedSalary, setHasFixedSalary] = useState<boolean>(false)
  const [fixedSalary, setFixedSalary] = useState<string>("")
  const [hourRate, setHourRate] = useState<string>("")

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
      return
    }
    initDefaults()
  }, [session, status])

  useEffect(() => {
    if (!date?.from || !date?.to) return
    loadUsers()
    if (selectedUserId && selectedUserId !== "all") {
      fetchUserData()
    } else {
      setUserData(null)
    }
  }, [selectedUserId, date])

  const initDefaults = () => {
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    setDate({
      from,
      to: today,
    })
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (date?.from) params.set("from", format(date.from, "yyyy-MM-dd"))
      if (date?.to) params.set("to", format(date.to, "yyyy-MM-dd"))

      const res = await fetch(`/api/commissions?${params.toString()}`)
      if (!res.ok) throw new Error("Falha ao carregar colaboradores")
      const data = await res.json()
      const profiles: AggregatedProfile[] = data.profiles || []
      setUsers(profiles)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar colaboradores")
    } finally {
      if (selectedUserId === "all") setLoading(false)
    }
  }

  const fetchUserData = async () => {
    if (selectedUserId === "all") return
    try {
      setLoading(true)
      if (!date?.from || !date?.to) {
        setLoading(false)
        return
      }
      const params = new URLSearchParams({
        from: format(date.from, "yyyy-MM-dd"),
        to: format(date.to, "yyyy-MM-dd"),
      })
      const res = await fetch(`/api/commissions/${selectedUserId}?` + params.toString())
      if (!res.ok) throw new Error("Falha ao carregar dados de comissão")
      const data: UserProfile = await res.json()
      setUserData(data)
      setHasFixedSalary(!!data.profile.hasFixedSalary)
      setFixedSalary(data.profile.fixedSalary != null ? String(data.profile.fixedSalary) : "")
      setHourRate(String(data.profile.hourRate || 0))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar dados de comissão")
    } finally {
      setLoading(false)
    }
  }
 
  const saveConfig = async () => {
    try {
      setLoading(true)
      const body = {
        hasFixedSalary,
        fixedSalary: fixedSalary !== "" ? parseFloat(fixedSalary) : null,
        hourRate: hourRate !== "" ? parseFloat(hourRate) : 0
      }
      const res = await fetch(`/api/commissions/${selectedUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error("Falha ao salvar configurações")
      toast.success("Configurações salvas")
      await fetchUserData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações")
    } finally {
      setLoading(false)
    }
  }
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", {
       style: "currency",
       currency: "BRL",
       minimumFractionDigits: 2,
       maximumFractionDigits: 2
     }).format(value)
   }
 
  const formatDate = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return "—"
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
    if (!(d instanceof Date) || isNaN(d.getTime())) return "—"
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = String(d.getFullYear())
    return `${day}/${month}/${year}`
  }
 
   if (status === "loading" || loading) {
     return (
       <div className="flex items-center justify-center h-64">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
       </div>
     )
   }
 
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
                {session?.user.role === "ADMIN" && (
                  <SelectItem value="all">Todos os Colaboradores</SelectItem>
                )}
                {users.map((u) => (
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
                              <TableCell>{formatDate(task.date || task.completedAt)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency((task.minutes / 60) * userData.summary.hourRate)}
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
              </div>

              <div className="flex justify-end">
                <Button onClick={saveConfig} size="lg">
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
