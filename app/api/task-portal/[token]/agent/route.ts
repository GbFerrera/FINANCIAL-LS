import { NextRequest, NextResponse } from 'next/server'
import { findSharedTask, renderTaskAgentMarkdown } from '@/lib/task-share'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const task = await findSharedTask(token)

    if (!task) {
      return NextResponse.json({ error: 'Link inválido ou desativado' }, { status: 404 })
    }

    const markdown = renderTaskAgentMarkdown(task)

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Erro task-portal agent GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
