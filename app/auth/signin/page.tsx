"use client"

import { useEffect, useRef, useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { Eye, EyeOff, Link as LinkIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const router = useRouter()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    const play = () => {
      video.play().catch(() => {})
    }

    play()
    video.addEventListener("loadeddata", play)
    return () => video.removeEventListener("loadeddata", play)
  }, [])

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

        if (session?.user.role === "ADMIN") {
          router.push("/dashboard")
        } else if (session?.user.role === "TEAM") {
          router.push("/team")
        } else {
          router.push("/client")
        }
      }
    } catch {
      toast.error("Erro ao fazer login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#eef0f4] lg:h-screen lg:p-2">
      {/* Vídeo — camada de fundo (continua atrás do formulário) */}
      <div className="absolute left-2 top-2 right-2 h-52 overflow-hidden rounded-2xl bg-[#0f1729] sm:h-64 lg:bottom-2 lg:right-[42%] lg:h-auto lg:rounded-l-3xl lg:rounded-r-none">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full scale-110 object-cover object-[62%_center]"
          aria-hidden
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Formulário — por cima, com curva na borda esquerda */}
      <div className="relative z-10 flex min-h-screen flex-col justify-end pt-56 sm:pt-64 lg:h-full lg:justify-center lg:pt-0 lg:pl-[44%] lg:pr-2">
        <div className="flex min-h-0 flex-1 items-center rounded-t-[1.75rem] bg-white px-8 py-10 sm:px-10 lg:min-h-[calc(100%-0px)] lg:rounded-[1.75rem] lg:rounded-l-[3rem] lg:px-14 lg:py-14 lg:shadow-[-18px_0_48px_rgba(15,23,41,0.09)]">
          <div className="w-full max-w-[400px] lg:mx-auto">
            <div className="mb-8 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <LinkIcon className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-[#1a1a1a]">
                Link System
              </span>
            </div>

            <div className="mb-8">
              <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-[#1a1a1a] sm:text-[2rem]">
                Bem-vindo de volta
              </h1>
              <p className="mt-2 text-sm text-[#737373]">
                Entre na sua conta para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#404040]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-12 rounded-xl border-[#e5e5e5] bg-[#fafafa] px-4 text-[#1a1a1a] shadow-none placeholder:text-[#a3a3a3] focus-visible:border-[#1a1a1a] focus-visible:ring-[#1a1a1a]/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#404040]">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-xl border-[#e5e5e5] bg-[#fafafa] px-4 pr-12 text-[#1a1a1a] shadow-none placeholder:text-[#a3a3a3] focus-visible:border-[#1a1a1a] focus-visible:ring-[#1a1a1a]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#a3a3a3] transition-colors hover:text-[#525252]"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-12 w-full rounded-xl text-base font-semibold shadow-none"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-[#737373]">
              Problemas para acessar?{" "}
              <a
                href="mailto:suporte@linksystem.tech"
                className="font-medium text-[#1a1a1a] underline-offset-4 hover:underline"
              >
                Fale com o suporte
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
