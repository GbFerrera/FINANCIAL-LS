import { decodePixCopyPageParam } from "@/lib/pix-copy-link"
import { PixCopyKeyClient } from "./pix-copy-key-client"

type PageProps = {
  searchParams: Promise<{ v?: string; t?: string }>
}

export default async function PixCopiarChavePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const keyValue = decodePixCopyPageParam(sp.v)
  const keyTypeLabel = decodePixCopyPageParam(sp.t) ?? undefined

  if (!keyValue) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center px-6 text-center text-sm text-slate-600">
        Link inválido ou expirado. Use o lembrete recebido por e-mail.
      </div>
    )
  }

  return <PixCopyKeyClient keyValue={keyValue} keyTypeLabel={keyTypeLabel} />
}
