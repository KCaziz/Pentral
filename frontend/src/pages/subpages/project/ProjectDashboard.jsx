import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useParams } from "react-router-dom"
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
function ProjectDashboard() {
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [sharedWith, setSharedWith] = useState([])
  const [newScanName, setNewScanName] = useState("")
  const [shareEmail, setShareEmail] = useState("")
  const [message, setMessage] = useState("")
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allScans, setAllScans] = useState([])
  const { projectId } = useParams();  
  const [type, setType] = useState("no_user");
  const user_id = localStorage.getItem('user_id');

  

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

    const fetchProject = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/get_project/${projectId}`, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
        const data = await res.json()        
        setProject(data)
        setSharedWith(data.shared_with || [])
      } catch (err) {
        console.error("Erreur chargement projet", err)
      }
    }

    fetchProject()
    fetchUser()
  }, [projectId])

  useEffect(() => {
    const loadScans = async () => {
      try {
        const scans = await fetchAllScans(); // Attendre la résolution de la Promise
        setAllScans(scans); // Mettre à jour l'état avec le tableau de scans
      } catch (error) {
        console.error("Erreur chargement scans:", error);
        setAllScans([]); // Mettre un tableau vide en cas d'erreur
      }
    };

    loadScans();
  }, []);

  const fetchAllScans = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/scans`, {
        method: "GET",
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  // Ajouter un scan
  const handleAddScan = async (e) => {
    e.preventDefault()
    console.log(type);
    
    try {
      const res = await fetch("http://127.0.0.1:5000/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newScanName, project_id: projectId, launched_by: user_id, type: type }),
      })

      const data = await res.json()
      if (res.ok) {
        const scans = await fetchAllScans();
        setAllScans(scans);
        setNewScanName("")
        setMessage("Scan ajouté ✅")
        
      } else {
        setMessage(data.error || "Erreur ajout scan")
      }
    } catch (err) {
      console.error(err)
      setMessage("Erreur réseau")
    }
  }

  // Partager le projet
  const handleShare = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: shareEmail }),
      })

      const data = await res.json()
      if (res.ok) {
        setSharedWith((prev) => [...prev, shareEmail])
        setShareEmail("")
        setMessage("Projet partagé")
      } else {
        setMessage(data.error || "Erreur de partage")
      }
    } catch (err) {
      console.error(err)
      setMessage("Erreur réseau")
    } 
  }

  if (!project || !user) return <p>Chargement...</p>  

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2">
    <SidebarTrigger />
    <Separator orientation="vertical" className="h-4" />
  </div>
  <img src={cloudSvg} alt="cloud" className=" ml-auto mb-10  size-32" />
  <img src={cloudSvg} alt="cloud" className=" ml-[50%] mt-20 size-32" />

        </header>
        <div className="p-4 border rounded w-full size-md md:w-3/4 lg:w-2/3 xl:w-1/2 mx-auto my-[3em] ">
          <h1 className="text-2xl font-bold mb-4"> project name : {project.name ? project.name : "Pas de nom pour ce projet"}</h1>

          <div className="mb-6">
            <h2 className="text-lg font-semibold">Scans</h2>
            <ul className="list-disc ml-6">
              {allScans.map((scan) => (
                <li key={scan._id} className="mb-4 p-4 border rounded hover:bg-yellow-900" 
                onClick={() => { 
                  let basePath;
                  if (scan.type === "user") {
                    basePath = "/scan_user";
                  } else if (scan.type === "reason") {
                    basePath = "/scan_reason";
                  } else {
                    basePath = "/scan_no_user"; 
                  }
                  navigate(`${basePath}/${scan._id}`);
                  }
                }>
                  <h2 className="font-bold">{scan.name || "Scan sans nom"}</h2>
                  <h5>Type: {scan.type || "Scan sans type"}</h5>
                  <p>Statut: {scan.status}</p>
                  <p>Créé le: {new Date(scan.created_at).toLocaleDateString()}</p>
                  <div>
                    Commandes exécutées:
                    <ul className="list-disc pl-5">
                      {scan.commands_executed.map((cmd, idx) => (
                        <li key={idx}>{cmd.command}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddScan} className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Nom du scan"
                value={newScanName}
                onChange={(e) => setNewScanName(e.target.value)}
                className="border p-2 rounded flex-1"
                required
              />
              <select name="type" id="type" value={type} onChange={(e) => setType(e.target.value)} className="pl-1">
                <option value="no_user">sans user</option>
                <option value="user">avec user</option>
              </select>
              <button className="bg-blue-600 text-white px-4 rounded">Ajouter</button>
            </form>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold">Partager le projet</h2>
            <ul className="list-disc ml-6">
              {sharedWith.map((email, idx) => (
                <li key={idx}>{email}</li>
              ))}
            </ul>

            <form onSubmit={handleShare} className="mt-4 flex gap-2">
              <input
                type="email"
                placeholder="Email de l'utilisateur"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="border p-2 rounded flex-1"
                required
              />
              <button className="bg-green-600 text-white px-4 rounded">Partager</button>
            </form>
          </div>

          {message && <p className="text-blue-700 mt-4">{message}</p>}
        </div>

      </SidebarInset>
    </SidebarProvider>
  )
}

export default ProjectDashboard
