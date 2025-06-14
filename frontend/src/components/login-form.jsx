import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"

export function LoginForm({ className, ...props }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")

    try {
      const response = await fetch("http://127.0.0.1:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()


      if (response.ok) {
        // Stocker le token JWT (tu peux aussi utiliser cookies)
        localStorage.setItem("token", data.token)
        localStorage.setItem("user_id", data.user_id)
        if (data.is_admin === true) {
          navigate("/admin")
        }
        else if (data.is_admin === false) {
          navigate("/dashboard")
        }
      } else {
        setError(data.message || "Erreur de connexion.")
      }
    } catch (err) {
      console.error(err)
      setError("Une erreur est survenue.")
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>
            Entrer votre mail et mot de passe pour vous connecter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="m@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Mot de passe</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button variant="secondary" className="w-full">
                Se connecter
              </Button>
              <Button variant="outline" className="w-full" disabled>
                avec Google (à venir)
              </Button>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="mt-4 text-center text-sm">
              Vous n&apos;avez pas de compte ?{" "}
              <Link to="/signup" className="underline underline-offset-4">
                Créer
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
