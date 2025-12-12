import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { FinancialType, RecurringType } from '@prisma/client'

// Schema de validação para atualização de entrada financeira
const updateFinancialEntrySchema = z.object({
  type: z.nativeEnum(FinancialType).optional(),
  category: z.string().min(1, 'Categoria é obrigatória').optional(),
  description: z.string().min(1, 'Descrição é obrigatória').optional(),
  amount: z.number().positive('Valor deve ser positivo').optional(),
  date: z.string().datetime('Data inválida').optional(),
  isRecurring: z.boolean().optional(),
  recurringType: z.nativeEnum(RecurringType).optional(),
  projectId: z.string().optional(),
  addAttachments: z.array(z.object({
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string(),
    filename: z.string().optional()
  })).optional(),
  removeAttachmentIds: z.array(z.string()).optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// GET - Buscar entrada financeira por ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const entry = await prisma.financialEntry.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            client: {
              select: {
                id: true,
                name: true,
                company: true,
              }
            }
          }
        },
        attachments: true
      }
    })

    if (!entry) {
      return NextResponse.json(
        { error: 'Entrada financeira não encontrada' },
        { status: 404 }
      )
    }

    // Transformar para o frontend
    const transformedEntry = {
      id: entry.id,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      date: entry.date.toISOString(),
      isRecurring: entry.isRecurring,
      recurringType: entry.recurringType,
      projectId: entry.projectId,
      project: entry.project ? {
        id: entry.project.id,
        name: entry.project.name,
        status: entry.project.status,
        client: entry.project.client
      } : null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      attachments: (entry.attachments || []).map(a => ({
        id: a.id,
        filename: a.filename,
        originalName: a.originalName,
        size: a.size,
        url: a.url
      }))
    }

    return NextResponse.json(transformedEntry)
  } catch (error) {
    console.error('Erro ao buscar entrada financeira:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar entrada financeira
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateFinancialEntrySchema.parse(body)

    // Verificar se a entrada existe e buscar informações do pagamento relacionado
    const existingEntry = await prisma.financialEntry.findUnique({
      where: { id: params.id },
      include: {
        payment: {
          include: {
            paymentProjects: true
          }
        }
      }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Entrada financeira não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o projeto existe (se fornecido)
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId }
      })

      if (!project) {
        return NextResponse.json(
          { error: 'Projeto não encontrado' },
          { status: 404 }
        )
      }
    }

    // Validar recurringType se isRecurring for true
    const isRecurring = validatedData.isRecurring ?? existingEntry.isRecurring
    if (isRecurring && !validatedData.recurringType && !existingEntry.recurringType) {
      return NextResponse.json(
        { error: 'Tipo de recorrência é obrigatório para entradas recorrentes' },
        { status: 400 }
      )
    }

    // Validar data se fornecida
    if (validatedData.date) {
      const entryDate = new Date(validatedData.date)
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
      
      if (entryDate > oneYearFromNow) {
        return NextResponse.json(
          { error: 'Data não pode ser superior a um ano no futuro' },
          { status: 400 }
        )
      }
    }

    // Preparar dados para atualização
    const updateData: any = { ...validatedData }
    delete updateData.addAttachments
    delete updateData.removeAttachmentIds
    if (validatedData.date) {
      updateData.date = new Date(validatedData.date)
    }

    // Se isRecurring for false, limpar recurringType
    if (validatedData.isRecurring === false) {
      updateData.recurringType = null
    }

    const updatedEntry = await prisma.financialEntry.update({
      where: { id: params.id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            client: {
              select: {
                id: true,
                name: true,
                company: true,
              }
            }
          }
        },
        attachments: true
      }
    })

    if (validatedData.removeAttachmentIds && validatedData.removeAttachmentIds.length > 0) {
      await prisma.financialAttachment.deleteMany({
        where: {
          id: { in: validatedData.removeAttachmentIds },
          financialEntryId: params.id
        }
      })
    }

    if (validatedData.addAttachments && validatedData.addAttachments.length > 0) {
      await prisma.financialAttachment.createMany({
        data: validatedData.addAttachments.map(a => ({
          filename: a.filename || a.originalName,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: Math.round(a.size),
          url: a.url,
          financialEntryId: params.id
        }))
      })
    }

    const attachments = await prisma.financialAttachment.findMany({
      where: { financialEntryId: params.id }
    })

    // Transformar para o frontend
    const transformedEntry = {
      id: updatedEntry.id,
      type: updatedEntry.type,
      category: updatedEntry.category,
      description: updatedEntry.description,
      amount: updatedEntry.amount,
      date: updatedEntry.date.toISOString(),
      isRecurring: updatedEntry.isRecurring,
      recurringType: updatedEntry.recurringType,
      projectId: updatedEntry.projectId,
      project: updatedEntry.project ? {
        id: updatedEntry.project.id,
        name: updatedEntry.project.name,
        status: updatedEntry.project.status,
        client: updatedEntry.project.client
      } : null,
      createdAt: updatedEntry.createdAt.toISOString(),
      updatedAt: updatedEntry.updatedAt.toISOString(),
      attachments: attachments.map(a => ({
        id: a.id,
        filename: a.filename,
        originalName: a.originalName,
        size: a.size,
        url: a.url
      }))
    }

    return NextResponse.json(transformedEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar entrada financeira:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir entrada financeira
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se a entrada existe
    const existingEntry = await prisma.financialEntry.findUnique({
      where: { id: params.id }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Entrada financeira não encontrada' },
        { status: 404 }
      )
    }

    // Se a entrada está vinculada a um pagamento, excluir também os PaymentProject relacionados
    if (existingEntry.paymentId) {
      // Excluir todos os PaymentProject relacionados ao pagamento
      await prisma.paymentProject.deleteMany({
        where: {
          paymentId: existingEntry.paymentId
        }
      })

      // Excluir o pagamento relacionado
      await prisma.payment.delete({
        where: { id: existingEntry.paymentId }
      })
    }

    // Excluir a entrada financeira
    await prisma.financialEntry.delete({
      where: { id: params.id }
    })

    return NextResponse.json(
      { message: 'Entrada financeira e registros relacionados excluídos com sucesso' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao excluir entrada financeira:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
