"use client"

import { useState } from "react"

export function PixCopyKeyClient(props: { keyValue: string; keyTypeLabel?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.keyValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-slate-900">Chave Pix</h1>
      {props.keyTypeLabel ? (
        <p className="mt-1 text-sm text-slate-500">{props.keyTypeLabel}</p>
      ) : null}
      <p className="mt-4 break-all rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800">
        {props.keyValue}
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-6 w-full rounded-lg bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-800"
      >
        {copied ? "Copiado!" : "Copiar chave Pix"}
      </button>
      <p className="mt-4 text-center text-xs text-slate-500">
        Cole no app do banco em Pix → Chave Pix.
      </p>
    </div>
  )
}
