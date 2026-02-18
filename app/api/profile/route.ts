import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  avatar: z.string().min(1).optional(),
  skillsMastered: z.array(z.string()).optional(),
  skillsReinforcement: z.array(z.string()).optional(),
  skillsInterests: z.array(z.string()).optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    } as any)
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (e) {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    const body = await request.json()
    const data = updateSchema.parse(body)
    const updateData: any = {}
    if (typeof data.avatar !== 'undefined') updateData.avatar = data.avatar
    if (typeof data.skillsMastered !== 'undefined') updateData.skillsMastered = data.skillsMastered
    if (typeof data.skillsReinforcement !== 'undefined') updateData.skillsReinforcement = data.skillsReinforcement
    if (typeof data.skillsInterests !== 'undefined') updateData.skillsInterests = data.skillsInterests
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    } as any)
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: e.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
