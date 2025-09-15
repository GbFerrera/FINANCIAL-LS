"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Eye, EyeOff, Building2, Users, User } from "lucide-react"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Credenciais inválidas")
      } else {
        const session = await getSession()
        toast.success("Login realizado com sucesso!")
        
        // Redirecionar baseado no papel do usuário
        if (session?.user.role === "ADMIN") {
          router.push("/dashboard")
        } else if (session?.user.role === "TEAM") {
          router.push("/team")
        } else {
          router.push("/client")
        }
      }
    } catch (error) {
      toast.error("Erro ao fazer login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">SoftHouse Manager</h2>
            <p className="text-gray-600 mt-2">Faça login para acessar o sistema</p>
          </div>

          {/* Tipos de Acesso */}
          <div className="grid grid-cols-3 gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            <div className="flex flex-col items-center p-2 text-xs text-gray-600">
              <User className="h-4 w-4 mb-1" />
              <span>Admin</span>
            </div>
            <div className="flex flex-col items-center p-2 text-xs text-gray-600">
              <Users className="h-4 w-4 mb-1" />
              <span>Equipe</span>
            </div>
            <div className="flex flex-col items-center p-2 text-xs text-gray-600">
              <Building2 className="h-4 w-4 mb-1" />
              <span>Cliente</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Problemas para acessar?{" "}
              <a href="mailto:suporte@softhouse.com" className="text-indigo-600 hover:text-indigo-500">
                Entre em contato
              </a>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="bg-white rounded-lg shadow-md p-4 text-sm text-gray-600">
          <h3 className="font-medium mb-2">Credenciais de Demonstração:</h3>
          <div className="space-y-1">
            <p><strong>Admin:</strong> admin@softhouse.com / admin123</p>
            <p><strong>Equipe:</strong> dev@softhouse.com / dev123</p>
            <p><strong>Cliente:</strong> cliente@empresa.com / cliente123</p>
          </div>
        </div>
      </div>
    </div>
  )
}