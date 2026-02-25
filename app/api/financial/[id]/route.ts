import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { FinancialType, RecurringType, Prisma } from '@prisma/client'

const projectDistributionSchema = z.object({
  projectId: z.string().min(1, 'ID do projeto é obrigatório'),
  projectName: z.string().min(1, 'Nome do projeto é obrigatório'),
  amount: z.number().positive('Valor deve ser positivo')
})

// Schema de validação para atualização de entrada financeira
const updateFinancialEntrySchema = z.object({
  type: z.nativeEnum(FinancialType).optional(),
  category: z.string().min(1, 'Categoria é obrigatória').optional(),
  description: z.string().min(1, 'Descrição é obrigatória').optional(),
  amount: z.number().positive('Valor deve ser positivo').optional(),
  date: z.string().datetime('Data inválida').optional(),
  isRecurring: z.boolean().optional(),
  recurringType: z.string().nullable().optional().transform(val => {
    if (!val || val === '') return null;
    return val as RecurringType;
  }).refine(val => val === null || Object.values(RecurringType).includes(val as RecurringType), {
    message: "Tipo de recorrência inválido"
  }),
  projectId: z.string().nullable().optional(),
  projectDistributions: z.array(projectDistributionSchema).nullable().optional(),
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

    const finalAmount = validatedData.amount ?? existingEntry.amount

    if (validatedData.projectDistributions && validatedData.projectDistributions.length > 0) {
      if (validatedData.projectId) {
        return NextResponse.json(
          { error: 'Não é possível ter projeto único e distribuição de projetos ao mesmo tempo' },
          { status: 400 }
        )
      }
      const projectIds = validatedData.projectDistributions.map(d => d.projectId)
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        include: { client: true }
      })
      if (projects.length !== projectIds.length) {
        return NextResponse.json(
          { error: 'Um ou mais projetos não foram encontrados' },
          { status: 404 }
        )
      }
      const totalDistributed = validatedData.projectDistributions.reduce((sum, dist) => sum + dist.amount, 0)
      if (Math.abs(totalDistributed - finalAmount) > 0.01) {
        return NextResponse.json(
          { error: `A soma das distribuições (${totalDistributed}) deve ser igual ao valor total (${finalAmount})` },
          { status: 400 }
        )
      }
      const firstProjectClientId = projects[0].clientId
      if (existingEntry.paymentId) {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: existingEntry.paymentId },
            data: {
              amount: finalAmount,
              description: validatedData.description ?? existingEntry.description,
            }
          }),
          prisma.paymentProject.deleteMany({
            where: { paymentId: existingEntry.paymentId }
          }),
          prisma.paymentProject.createMany({
            data: validatedData.projectDistributions.map(d => ({
              paymentId: existingEntry.paymentId!,
              projectId: d.projectId,
              amount: d.amount
            }))
          })
        ])
      } else {
        const payment = await prisma.payment.create({
          data: {
            amount: finalAmount,
            description: validatedData.description ?? existingEntry.description,
            paymentDate: validatedData.date ? new Date(validatedData.date) : existingEntry.date,
            method: 'BANK_TRANSFER',
            status: 'COMPLETED',
            clientId: firstProjectClientId,
            paymentProjects: {
              create: validatedData.projectDistributions.map(d => ({
                projectId: d.projectId,
                amount: d.amount
              }))
            }
          }
        })
        existingEntry.paymentId = payment.id
      }
    } else if (validatedData.projectDistributions && validatedData.projectDistributions.length === 0) {
      if (existingEntry.paymentId) {
        await prisma.$transaction([
          prisma.paymentProject.deleteMany({
            where: { paymentId: existingEntry.paymentId }
          }),
          prisma.payment.delete({
            where: { id: existingEntry.paymentId }
          })
        ])
        existingEntry.paymentId = null
      }
    }

    if (validatedData.projectId && existingEntry.paymentId) {
      await prisma.$transaction([
        prisma.paymentProject.deleteMany({
          where: { paymentId: existingEntry.paymentId }
        }),
        prisma.payment.delete({
          where: { id: existingEntry.paymentId }
        })
      ])
      existingEntry.paymentId = null
    }

    const updateData: Prisma.FinancialEntryUncheckedUpdateInput = {}
    if (validatedData.type !== undefined) updateData.type = validatedData.type
    if (validatedData.category !== undefined) updateData.category = validatedData.category
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount
    if (validatedData.date !== undefined) updateData.date = new Date(validatedData.date)
    if (validatedData.isRecurring !== undefined) updateData.isRecurring = validatedData.isRecurring
    if (validatedData.recurringType !== undefined) updateData.recurringType = validatedData.recurringType
    if (validatedData.projectId !== undefined) updateData.projectId = validatedData.projectId

    // Se isRecurring for false, limpar recurringType
    if (validatedData.isRecurring === false) {
      updateData.recurringType = null
    }
    if (validatedData.projectDistributions && validatedData.projectDistributions.length > 0) {
      updateData.projectId = null
      updateData.paymentId = existingEntry.paymentId
    }
    if (validatedData.projectDistributions && validatedData.projectDistributions.length === 0) {
      updateData.paymentId = null
    }
    if (existingEntry.paymentId && !validatedData.projectDistributions && validatedData.projectId) {
      updateData.paymentId = null
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
