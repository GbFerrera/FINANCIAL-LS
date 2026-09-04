import { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔐 Tentativa de login:', { email: credentials?.email })
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Credenciais inválidas')
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user) {
          console.log('❌ Usuário não encontrado:', credentials.email)
          return null
        }

        console.log('👤 Usuário encontrado:', { id: user.id, email: user.email, role: user.role })

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        console.log('🔑 Senha válida:', isPasswordValid)

        if (!isPasswordValid) {
          console.log('❌ Senha incorreta')
          return null
        }

        console.log('✅ Login bem-sucedido')
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.avatar || undefined,
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.picture = user.image
      }
      if (trigger === 'update' && session?.user?.image) {
        token.picture = session.user.image
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.image = (token.picture as string) || undefined
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Função para verificar permissões
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.CLIENT]: 0,
    [UserRole.TEAM]: 1,
    [UserRole.ADMIN]: 2,
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

// Middleware para verificar autenticação
export function requireAuth(requiredRole: UserRole = UserRole.TEAM) {
  return (handler: any) => {
    return async (req: any, res: any) => {
      const session = await getServerSession(req, res, authOptions)
      
      if (!session) {
        return res.status(401).json({ error: "Não autorizado" })
      }
      
      if (!hasPermission(session.user.role, requiredRole)) {
        return res.status(403).json({ error: "Permissão insuficiente" })
      }
      
      return handler(req, res)
    }
  }
}

// Tipos para TypeScript
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      image?: string
      avatar?: string
    }
  }
  
  interface User {
    role: UserRole
    avatar?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    id: string
    picture?: string
  }
}