import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
              headers: { 'Access-Control-Allow-Origin': '*'},
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
        <div>
        <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />

            </div>
          </header>
        <div className="p-4 pb-[5em] border rounded w-full size-md md:w-3/4 lg:w-2/3 xl:w-1/2 mx-auto my-[3em]">
            <h2 className="text-xl font-bold mb-2">Créer un nouveau projet</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                    type="text"
                    placeholder="Nom du projet"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border p-2 rounded"
                    required
                />

                <input
                    type="text"
                    placeholder="Nom de la compagnie (laissez vide si pas de compagnie)"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="border p-2 rounded"

                />


                {/* select pour les équipes ici */}
                {/* <input
          type="text"
          placeholder="Team ID"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="border p-2 rounded"
        /> */}

                <button type="submit" className="mt-[5em] bg-blue-600 text-white p-2 rounded hover:bg-blue-700 ">
                    Créer le projet
                </button>
            </form>

            {message && <p className="text-green-600 mt-3">{message}</p>}
            {error && <p className="text-red-600 mt-3">{error}</p>}
        </div>

        </SidebarInset>
        </SidebarProvider>
        </div>
    )
}

export default AddProject
