import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || "").trim()
    const id = (searchParams.get("id") || "").trim()
    const idsParam = (searchParams.get("ids") || "").trim()
    const limitParam = searchParams.get("limit")
    const limit = clamp(parseInt(limitParam || "10", 10), 1, 50)

    const ids = idsParam
      ? Array.from(
          new Set(
            idsParam
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          )
        )
      : []

    const where: any = {}

    if (id) {
      where.id = id
    } else if (ids.length > 0) {
      where.id = { in: ids }
    } else if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ]
    }

    const clients = await prisma.client.findMany({
      where,
      take: id || ids.length > 0 ? undefined : limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
      },
    })

    return NextResponse.json({ clients })
  } catch (error) {
    console.error("Erro ao buscar opções de clientes:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
