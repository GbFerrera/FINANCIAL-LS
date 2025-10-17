import { NextRequest, NextResponse } from 'next/server'

// Esta é uma rota simples para verificar se o WebSocket está funcionando
// O WebSocket real será inicializado no servidor Next.js

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'WebSocket endpoint ativo',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    // Aqui podemos processar eventos que chegam via HTTP
    // e repassar para o WebSocket se necessário
    
    return NextResponse.json({ 
      success: true,
      type,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao processar evento' },
      { status: 500 }
    )
  }
}
