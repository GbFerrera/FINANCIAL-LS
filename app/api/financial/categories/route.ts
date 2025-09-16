import { NextResponse } from 'next/server'

const categories = {
  INCOME: [
    'Pagamento de Cliente',
    'Consultoria',
    'Desenvolvimento',
    'Manutenção',
    'Licenciamento',
    'Outros'
  ],
  EXPENSE: [
    'Salários',
    'Infraestrutura',
    'Software/Licenças',
    'Marketing',
    'Escritório',
    'Viagem',
    'Impostos',
    'Outros'
  ]
}

export async function GET() {
  try {
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Erro ao buscar categorias:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}