"use client"

import Image from "next/image"
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
    <div className="min-h-screen flex w-full">
      {/* Lado Esquerdo - Imagem */}
  <div className="hidden lg:flex w-1/2 relative bg-[#161f46]">
  <Image
    src="/login.png"
    alt="Login Visual"
    fill
    priority
    className="object-cover"
  />
  <div className="absolute inset-0 bg-black/10" />
</div>

      {/* Lado Direito - Formulário */}
      <div className="flex-1 flex items-center justify-center p-8 bg-card">
        <div className="max-w-md w-full space-y-8 bg-card p-10 rounded-2xl shadow-lg">
          <div className="text-center mb-8">
            
            <h2 className="text-3xl font-bold text-foreground">SoftHouse Manager</h2>
            <p className="text-muted-foreground mt-2">Faça login para acessar o sistema</p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#161f46] focus:border-transparent transition-colors"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#161f46] focus:border-transparent transition-colors pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#161f46] text-white py-3 px-4 rounded-lg hover:bg-[#1a212d] focus:ring-2 focus:ring-[#161f46] focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Problemas para acessar?{" "}
              <a href="mailto:suporte@softhouse.com" className="text-[#161f46] hover:text-[#1a212d] font-medium">
                Entre em contato
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}