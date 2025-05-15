import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export function SignupForm({ className, ...props }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:5000/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        navigate("/login");
      } else {
        setError(data.message || "Une erreur est survenue.");
      }
    } catch (err) {
      setError("Erreur serveur.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription>
            Remplissez les informations pour vous inscrire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              {/* company */}
              {/* <div className="grid gap-2">
                <Label htmlFor="company">Compagnies</Label>
                <Input
                  id="company"
                  value={formData.company}
                  placeholder="Company Name"
                  onChange={handleChange}
                  required
                />
              </div> */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full">
                S'inscrire
              </Button>
              <Button variant="outline" className="w-full" disabled>
                avec Google (à venir)
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              <Link
              to="/login"
              >
              Déjà un compte ?{" "}
              <span className="underline underline-offset-4">
                Connexion
              </span>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
