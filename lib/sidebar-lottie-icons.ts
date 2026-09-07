import dashboardAnimation from '@/public/animate/dashboard.json'
import projectsAnimation from '@/public/animate/projects.json'
import pipelineAnimation from '@/public/animate/pipeline.json'
import marketingAnimation from '@/public/animate/marketing.json'
import clientsAnimation from '@/public/animate/clients.json'
import financialAnimation from '@/public/animate/financial.json'
import teamAnimation from '@/public/animate/team.json'
import spyAnimation from '@/public/animate/spy.json'
import reportsAnimation from '@/public/animate/reports.json'
import configAnimation from '@/public/animate/config.json'
import homeAnimation from '@/public/animate/home.json'
import penAnimation from '@/public/animate/pen.json'
import workspaceAnimation from '@/public/animate/workspace.json'
import dashboardGAnimation from '@/public/animate/dashboard-g.json'
import spacesAnimation from '@/public/animate/spaces.json'
import chatAnimation from '@/public/animate/chat.json'

export const SIDEBAR_LOTTIE_ICONS = {
  dashboard: dashboardAnimation,
  projects: projectsAnimation,
  pipeline: pipelineAnimation,
  chat: chatAnimation,
  marketing: marketingAnimation,
  clients: clientsAnimation,
  financial: financialAnimation,
  team: teamAnimation,
  supervisor: spyAnimation,
  reports: reportsAnimation,
  settings: configAnimation,
  home: homeAnimation,
  pen: penAnimation,
  workspace: workspaceAnimation,
  dashboardG: dashboardGAnimation,
  spaces: spacesAnimation,
} as const

export type SidebarLottieKey = keyof typeof SIDEBAR_LOTTIE_ICONS
