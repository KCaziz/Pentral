import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { PlusCircleIcon, UserCircleIcon, BuildingOfficeIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"
function AddProject() {
  const [name, setName] = useState("")
  const [company, setCompany] = useState("") // tu peux l'ajouter plus tard
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate()

  useEffect(() => {
    const userId = localStorage.getItem('user_id');

    const fetchUser = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/users/${userId}`, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Erreur serveur");

        setUser(data);
      } catch (err) {
        console.error("Erreur fetchUser:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    } else {
      setLoading(false);
      setError("Aucun ID utilisateur trouvé");
    }
  }, [])


  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage("")
    setError("")

    const created_by = localStorage.getItem("user_id")

    if (!created_by) {
      setError("Utilisateur non trouvé.")
      return
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          created_by,
          // team_id: teamId,
          company,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const projectId = data.project_id; // Accès correct à la propriété
        console.log("ID du projet créé:", projectId);

        // Stockage et redirection
        localStorage.setItem("current_project", projectId);

        setMessage("Projet créé avec succès")
        setName("")
        setCompany("")
        navigate(`/project-dashboard/${projectId}`);
      } else {
        setError(data.error || "Erreur lors de la création du projet")
      }
    } catch (err) {
      setError("Erreur réseau ou serveur.")
      console.error(err)
    }
  }

  return (
    <div className=" mx-1  h-full overflow-x-auto max-w-full bg-transparent">
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 items-center px-6  backdrop-blur-sm border-b border-amber-100">
            <div className="flex items-center gap-3">
              <SidebarTrigger className=" hover:text-amber-800 transition-colors" />
              <Separator orientation="vertical" className="h-6 bg-amber-200" />
              <h2 className="text-xl font-extrabold text-amber-400 italic w-full">Ajout Projet</h2>
            </div>
            <img src={cloudSvg} alt="cloud" className="ml-[0rem] -mt-[5rem] size-32 " />
            <img src={cloudSvg} alt="cloud" className="ml-[10rem]  mt-[70rem] size-32 " />
            {/* <img src={cloudSvg} alt="cloud" className="ml-[10rem]  mt-[40rem] size-32 hidden md:block" /> */}
            <img src={cloudSvg} alt="cloud" className="ml-[20em] mt-[20rem] size-32 hidden md:block" />

          </header>


          <main className="min-h-[calc(100vh-15rem)] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-gradient-to-b from-amber-50 to-orange-200 rounded-xl shadow-lg overflow-hidden border border-amber-100">
              {/* En-tête de carte */}
              <div className="bg-amber-50 p-6 border-b border-amber-200">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <PlusCircleIcon className="h-6 w-6 text-amber-500" />
                  Créer un nouveau projet
                </h2>
                <p className="text-gray-500 mt-1">Remplissez les détails de votre nouveau projet</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
                <div>
                  <label htmlFor="project-name" className="block text-sm font-bold text-gray-700 mb-1">
                    Nom du projet <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="project-name"
                      type="text"
                      placeholder="Mon Super Projet"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                      required
                    />
                    <UserCircleIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-bold text-gray-700 mb-1">
                    Nom de la compagnie
                  </label>
                  <div className="relative">
                    <input
                      id="company"
                      type="text"
                      placeholder="Facultatif"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                    />
                    <BuildingOfficeIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                </div>

                {/* Bouton de soumission */}
                <div className="mt-6">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 rounded-lg font-semibold shadow-md hover:from-amber-600 hover:to-orange-600 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                  >
                    Créer le projet
                    <ArrowRightIcon className="h-5 w-5 inline-block ml-2" />
                  </button>
                </div>
              </form>

              {/* Messages de feedback */}
              {message && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-start">
                  <CheckCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-start">
                  <ExclamationCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default AddProject
