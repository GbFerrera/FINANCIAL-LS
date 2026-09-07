import { cn } from "@/lib/utils"

interface CurrencyAmountProps {
  value: number
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

export function CurrencyAmount({ value, size = "lg", className }: CurrencyAmountProps) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  const commaIndex = formatted.lastIndexOf(",")
  const main = commaIndex >= 0 ? formatted.slice(0, commaIndex) : formatted
  const cents = commaIndex >= 0 ? formatted.slice(commaIndex) : ",00"

  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap leading-none", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight tabular-nums text-foreground",
          size === "xl" && "text-2xl md:text-3xl",
          size === "lg" && "text-lg md:text-xl",
          size === "md" && "text-base",
          size === "sm" && "text-xs"
        )}
      >
        {main}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums text-muted-foreground",
          size === "xl" && "text-lg md:text-xl",
          size === "lg" && "text-sm md:text-base",
          size === "md" && "text-sm",
          size === "sm" && "text-[10px]"
        )}
      >
        {cents}
      </span>
    </span>
  )
}

export function formatCurrencyParts(value: number) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

  const commaIndex = formatted.lastIndexOf(",")
  return {
    main: commaIndex >= 0 ? formatted.slice(0, commaIndex) : formatted,
    cents: commaIndex >= 0 ? formatted.slice(commaIndex) : ",00",
    full: formatted,
  }
}
