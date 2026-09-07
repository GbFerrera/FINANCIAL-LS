"use client"

import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, endOfYear } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type ReportDateRangeFieldProps = {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  className?: string
  label?: string
}

export function ReportDateRangeField({
  value,
  onChange,
  className,
  label = "Período",
}: ReportDateRangeFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full justify-start text-left font-normal",
              !value?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd/MM/yyyy", { locale: ptBR })} –{" "}
                  {format(value.to, "dd/MM/yyyy", { locale: ptBR })}
                </>
              ) : (
                format(value.from, "dd/MM/yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione o período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="border-b border-border p-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() =>
                  onChange({
                    from: startOfMonth(new Date()),
                    to: endOfMonth(new Date()),
                  })
                }
              >
                Mês atual
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() =>
                  onChange({
                    from: startOfMonth(subMonths(new Date(), 1)),
                    to: endOfMonth(subMonths(new Date(), 1)),
                  })
                }
              >
                Mês anterior
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() =>
                  onChange({
                    from: subDays(new Date(), 30),
                    to: new Date(),
                  })
                }
              >
                Últimos 30 dias
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() =>
                  onChange({
                    from: startOfYear(new Date()),
                    to: endOfYear(new Date()),
                  })
                }
              >
                Este ano
              </Button>
            </div>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function defaultReportDateRange(): DateRange {
  return {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }
}

export function dateRangeToApi(value: DateRange | undefined) {
  return {
    start: value?.from ? format(value.from, "yyyy-MM-dd") : "",
    end: value?.to ? format(value.to, "yyyy-MM-dd") : "",
  }
}
