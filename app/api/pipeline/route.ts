import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Se um projeto específico for solicitado
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true
            }
          },
          milestones: {
            include: {
              tasks: {
                include: {
                  assignee: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true
                    }
                  },
                  comments: {
                    include: {
                      author: {
                        select: {
                          id: true,
                          name: true,
                          avatar: true
                        }
                      }
                    },
                    orderBy: {
                      createdAt: 'desc'
                    }
                  },
                  timeEntries: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true
                        }
                      }
                    }
                  }
                },
                orderBy: {
                  createdAt: 'asc'
                }
              }
            },
            orderBy: {
              order: 'asc'
            }
          }
        }
      });

      if (!project) {
        return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
      }

      return NextResponse.json(project);
    }

    // Buscar todos os projetos com suas milestones e tarefas
    const projects = await prisma.project.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true
          }
        },
        milestones: {
          include: {
            tasks: {
              include: {
                assignee: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: {
            tasks: true,
            milestones: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calcular estatísticas para cada projeto
    const projectsWithStats = projects.map(project => {
      const totalTasks = project.milestones.reduce((acc, milestone) => acc + milestone.tasks.length, 0);
      const completedTasks = project.milestones.reduce((acc, milestone) => 
        acc + milestone.tasks.filter(task => task.status === 'COMPLETED').length, 0
      );
      const inProgressTasks = project.milestones.reduce((acc, milestone) => 
        acc + milestone.tasks.filter(task => task.status === 'IN_PROGRESS').length, 0
      );
      const todoTasks = project.milestones.reduce((acc, milestone) => 
        acc + milestone.tasks.filter(task => task.status === 'TODO').length, 0
      );

      const completedMilestones = project.milestones.filter(milestone => milestone.status === 'COMPLETED').length;
      const totalMilestones = project.milestones.length;

      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...project,
        stats: {
          totalTasks,
          completedTasks,
          inProgressTasks,
          todoTasks,
          completedMilestones,
          totalMilestones,
          progress
        }
      };
    });

    return NextResponse.json(projectsWithStats);

  } catch (error) {
    console.error('Erro ao buscar dados da esteira:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}