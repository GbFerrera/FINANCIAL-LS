"use client"

import { Bell, Clock, Mail, MessageCircle, MoreHorizontal, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type ReminderTemplateItem = {
  id: string
  name: string
  subject: string
  daysBeforeDue: number
  daysAfterDue: number
  sendTime: string
  whatsAppPauseSeconds: number
  isActive: boolean
  sendEmail: boolean
  sendWhatsApp: boolean
  whatsAppPixButton?: boolean
  whatsAppInstance?: { label: string } | null
  group: { name: string }
  _count?: { sendLogs: number }
}

function formatWhen(t: ReminderTemplateItem) {
  const parts: string[] = []
  if (t.daysBeforeDue > 0) parts.push(`${t.daysBeforeDue}d antes`)
  parts.push("vencimento")
  if (t.daysAfterDue > 0) parts.push(`${t.daysAfterDue}d após`)
  return parts.join(" → ")
}

function TemplateChannels({ template }: { template: ReminderTemplateItem }) {
  const channels: string[] = []
  if (template.sendEmail) channels.push("E-mail")
  if (template.sendWhatsApp) channels.push("WhatsApp")
  if (template.whatsAppPixButton) channels.push("Pix")

  if (channels.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex items-center gap-2">
      {template.sendEmail && (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/30"
          title="E-mail"
        >
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      )}
      {template.sendWhatsApp && (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/30"
          title={
            template.whatsAppInstance?.label
              ? `WhatsApp · ${template.whatsAppInstance.label}`
              : "WhatsApp"
          }
        >
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      )}
      {template.whatsAppPixButton && (
        <Badge variant="outline" className="h-7 px-2 text-[10px] font-normal">
          Pix
        </Badge>
      )}
    </div>
  )
}

function TemplateActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TemplateRowMobile({
  template,
  onEdit,
  onDelete,
}: {
  template: ReminderTemplateItem
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                template.isActive ? "bg-foreground/70" : "bg-muted-foreground/40"
              )}
            />
            <p className="truncate font-medium text-foreground">{template.name}</p>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{template.subject}</p>
        </div>
        <TemplateActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Grupo</p>
          <p className="mt-0.5 font-medium text-foreground">{template.group.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Horário</p>
          <p className="mt-0.5 font-medium tabular-nums text-foreground">
            {formatWhen(template)} · {template.sendTime ?? "09:00"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Canais</p>
          <div className="mt-1">
            <TemplateChannels template={template} />
          </div>
        </div>
        <div>
          <p className="text-muted-foreground">Envios</p>
          <p className="mt-0.5 font-medium tabular-nums text-foreground">
            {template._count?.sendLogs ?? 0}
          </p>
        </div>
      </div>
      {!template.isActive && (
        <Badge variant="outline" className="mt-3 text-[10px] font-normal">
          Inativo
        </Badge>
      )}
    </div>
  )
}

type Props = {
  templates: ReminderTemplateItem[]
  onCreate: () => void
  onEdit: (template: ReminderTemplateItem) => void
  onDelete: (id: string) => void
}

export function ReminderTemplateList({ templates, onCreate, onEdit, onDelete }: Props) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Templates</CardTitle>
        <CardDescription>
          Um template por grupo — define mensagem, canais e quando enviar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhum template ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie o primeiro lembrete automático para seus assinantes.
            </p>
            <Button className="mt-4" size="sm" onClick={onCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo template
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[28%]">Template</TableHead>
                    <TableHead className="w-[16%]">Grupo</TableHead>
                    <TableHead className="w-[14%]">Canais</TableHead>
                    <TableHead className="w-[22%]">Quando</TableHead>
                    <TableHead className="w-[10%] text-right">Envios</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id} className="group">
                      <TableCell className="align-top">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              t.isActive ? "bg-foreground/70" : "bg-muted-foreground/35"
                            )}
                            title={t.isActive ? "Ativo" : "Inativo"}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-foreground">{t.name}</p>
                              {!t.isActive && (
                                <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {t.subject}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-foreground">{t.group.name}</TableCell>
                      <TableCell className="align-top">
                        <TemplateChannels template={t} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-1.5 text-sm">
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-foreground">{formatWhen(t)}</p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              às {t.sendTime ?? "09:00"}
                              {t.sendWhatsApp ? ` · pausa ${t.whatsAppPauseSeconds ?? 10}s` : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right tabular-nums text-sm text-foreground">
                        {t._count?.sendLogs ?? 0}
                      </TableCell>
                      <TableCell className="align-top">
                        <TemplateActions onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2 md:hidden">
              {templates.map((t) => (
                <TemplateRowMobile
                  key={t.id}
                  template={t}
                  onEdit={() => onEdit(t)}
                  onDelete={() => onDelete(t.id)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
