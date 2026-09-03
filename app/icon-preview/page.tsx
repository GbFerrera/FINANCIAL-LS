import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const variants = [
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Checklist',
    src96: '/icons8-tasks-96.png',
    src180: '/icons8-tasks-96.png',
    active: false,
  },
  {
    id: 'code',
    label: 'Code (ativo)',
    description: 'Janela de código — favicon e PWA',
    src96: '/icon-code-96.png',
    src180: '/icon-code-180.png',
    active: true,
  },
] as const

const sizes = [
  { label: 'Aba do browser', px: 32 },
  { label: 'Favicon', px: 96 },
  { label: 'PWA / iOS', px: 180 },
] as const

function PreviewTile({
  src,
  px,
  bg,
}: {
  src: string
  px: number
  bg: 'light' | 'dark'
}) {
  return (
    <div
      className={
        bg === 'light'
          ? 'flex items-center justify-center rounded-lg border bg-[#f4f4f5] p-4'
          : 'flex items-center justify-center rounded-lg border bg-[#18181b] p-4'
      }
    >
      <Image src={src} alt="" width={px} height={px} unoptimized className="shrink-0" />
    </div>
  )
}

export default function IconPreviewPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Escolher favicon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Favicon e PWA estão usando o ícone <strong>Code</strong>. Compare com Tasks se quiser trocar de novo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {variants.map((variant) => (
          <Card key={variant.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{variant.label}</CardTitle>
                {variant.active ? <Badge variant="secondary">Ativo</Badge> : null}
              </div>
              <CardDescription>{variant.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sizes.map((size) => {
                const src = size.px <= 96 ? variant.src96 : variant.src180
                return (
                  <div key={size.label} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {size.label} · {size.px}px
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <PreviewTile src={src} px={size.px} bg="light" />
                      <PreviewTile src={src} px={size.px} bg="dark" />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
