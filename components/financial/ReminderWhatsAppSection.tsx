"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Plus, QrCode, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { LoadingAnimation } from "@/components/ui/loading-animation"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ReminderWhatsAppInstance = {
  id: string
  label: string
  instanceName: string
  status: string
  phone: string | null
  isDefault: boolean
  _count?: { reminderTemplates: number }
}

function statusBadge(status: string) {
  if (status === "CONNECTED") return <Badge className="bg-green-600">Conectado</Badge>
  if (status === "CONNECTING") return <Badge variant="secondary">Aguardando QR</Badge>
  return <Badge variant="outline">Desconectado</Badge>
}

function formatPhone(digits: string | null) {
  if (!digits) return "—"
  const d = digits.replace(/\D/g, "")
  if (d.length >= 12 && d.startsWith("55")) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  }
  return digits
}

type Props = {
  onInstancesChange?: (instances: ReminderWhatsAppInstance[]) => void
}

export function ReminderWhatsAppSection({ onInstancesChange }: Props) {
  const [instances, setInstances] = useState<ReminderWhatsAppInstance[]>([])
  const [evolutionConfigured, setEvolutionConfigured] = useState(true)
  const [evolutionVersion, setEvolutionVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [creating, setCreating] = useState(false)

  const [qrOpen, setQrOpen] = useState(false)
  const [qrInstance, setQrInstance] = useState<ReminderWhatsAppInstance | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrCodeRaw, setQrCodeRaw] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [managerUrl, setManagerUrl] = useState<string | null>(null)
  const [managerLoginUrl, setManagerLoginUrl] = useState<string | null>(null)
  const [qrDiagnosis, setQrDiagnosis] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/financial/whatsapp/instances")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Falha ao carregar")
      const list = data.instances || []
      setInstances(list)
      onInstancesChange?.(list)
      setEvolutionConfigured(data.evolutionConfigured !== false)
      setEvolutionVersion(data.evolutionVersion ?? null)
    } catch {
      toast.error("Erro ao carregar números WhatsApp")
    } finally {
      setLoading(false)
    }
  }, [onInstancesChange])

  useEffect(() => {
    void load()
  }, [load])

  const createInstance = async () => {
    if (!newLabel.trim()) {
      toast.error("Informe um nome para o número")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/financial/whatsapp/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Falha ao criar")
      toast.success("Número criado — escaneie o QR Code")
      setCreateOpen(false)
      setNewLabel("")
      await load()
      void openQr(data as ReminderWhatsAppInstance)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar")
    } finally {
      setCreating(false)
    }
  }

  const openQr = async (inst: ReminderWhatsAppInstance) => {
    setQrInstance(inst)
    setQrOpen(true)
    setQrCode(null)
    setQrCodeRaw(null)
    setPairingCode(null)
    setManagerUrl(null)
    setManagerLoginUrl(null)
    setQrDiagnosis(null)
    setQrLoading(true)
    try {
      const res = await fetch(`/api/financial/whatsapp/instances/${inst.id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Falha ao obter QR")
      setQrCode(data.qrCode || null)
      setQrCodeRaw(data.qrCodeRaw || null)
      setPairingCode(data.pairingCode || null)
      setManagerUrl(data.managerUrl || null)
      setManagerLoginUrl(data.managerLoginUrl || null)
      setQrDiagnosis(data.qrDiagnosis || null)
      if (data.evolutionVersion) setEvolutionVersion(data.evolutionVersion)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao obter QR")
    } finally {
      setQrLoading(false)
    }
  }

  const syncInstance = async (id: string) => {
    try {
      const res = await fetch(`/api/financial/whatsapp/instances/${id}?action=sync`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Falha ao sincronizar")
      toast.success("Status atualizado")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar")
    }
  }

  const deleteInstance = async (inst: ReminderWhatsAppInstance) => {
    if (!confirm(`Remover "${inst.label}"? Templates vinculados perderão o número.`)) return
    const res = await fetch(`/api/financial/whatsapp/instances/${inst.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Erro ao remover")
      return
    }
    toast.success("Número removido")
    await load()
  }

  const qrImageSrc =
    qrCode ||
    (qrCodeRaw
      ? `https://quickchart.io/qr?text=${encodeURIComponent(qrCodeRaw)}&size=280&margin=1`
      : null)

  return (
    <>
      {!evolutionConfigured && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">WhatsApp não configurado no servidor</CardTitle>
            <CardDescription>
              Defina <code className="text-xs">EVOLUTION_API_URL</code> e{" "}
              <code className="text-xs">EVOLUTION_API_KEY</code> ou rode{" "}
              <code className="text-xs">npm run evo:up</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {evolutionConfigured && evolutionVersion?.startsWith("2.2.") && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Serviço WhatsApp desatualizado ({evolutionVersion})</CardTitle>
            <CardDescription>
              Rode <code className="text-xs bg-muted px-1 rounded">npm run evo:upgrade</code> para o QR aparecer aqui.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card id="whatsapp-lembretes">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>WhatsApp</CardTitle>
            <CardDescription>Conecte números para enviar lembretes. Vincule cada template a um número abaixo.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!evolutionConfigured || loading}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar número
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando números…</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum número cadastrado.</p>
          ) : (
            instances.map((inst) => (
              <div
                key={inst.id}
                className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    {inst.label}
                    {statusBadge(inst.status)}
                    {inst.isDefault && <Badge variant="outline">Padrão</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatPhone(inst.phone)}
                    {inst._count?.reminderTemplates
                      ? ` · ${inst._count.reminderTemplates} template(s)`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {inst.status !== "CONNECTING" && inst.status !== "CONNECTED" && (
                    <Button variant="outline" size="sm" onClick={() => openQr(inst)}>
                      <QrCode className="h-4 w-4 mr-1" />
                      QR Code
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => syncInstance(inst.id)}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteInstance(inst)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo número WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome (ex.: Financeiro, Cobrança)</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Financeiro" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createInstance} disabled={creating}>
              Criar e mostrar QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar {qrInstance?.label}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrLoading ? (
              <LoadingAnimation size="lg" />
            ) : qrImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImageSrc} alt="QR Code WhatsApp" className="w-64 h-64 object-contain border rounded-lg" />
            ) : pairingCode ? (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Código de pareamento</p>
                <p className="text-2xl font-mono font-bold tracking-widest">{pairingCode}</p>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">QR indisponível pela API. Use o painel externo:</p>
                {managerLoginUrl && (
                  <Button variant="default" size="sm" asChild>
                    <a href={managerLoginUrl} target="_blank" rel="noreferrer">
                      Abrir login do painel
                    </a>
                  </Button>
                )}
                {managerUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={managerUrl} target="_blank" rel="noreferrer">
                      Abrir instância
                    </a>
                  </Button>
                )}
                {qrDiagnosis && (
                  <p className="text-xs text-destructive max-w-sm border border-destructive/30 rounded-md p-2 bg-destructive/5">
                    {qrDiagnosis}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              WhatsApp → Dispositivos conectados → Conectar dispositivo
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => qrInstance && void openQr(qrInstance)}
              disabled={qrLoading || !qrInstance}
            >
              Atualizar QR
            </Button>
            <Button onClick={() => setQrOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
