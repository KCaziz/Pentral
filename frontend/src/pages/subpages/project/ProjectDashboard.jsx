import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useParams } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { Activity } from "lucide-react"
import { InformationCircleIcon, PlusIcon } from "@heroicons/react/24/outline";

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
  const [iterations, setIterations] = useState(3);
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
    console.log("iterations", iterations);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newScanName, project_id: projectId, launched_by: user_id, type: type, iterations: iterations }),
      })

      const data = await res.json()
      console.log("data", data);
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

  if (!user || !project) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900 flex items-center justify-center">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Activity className="w-8 h-8 text-yellow-400 animate-pulse" />
        </div>
      </div>
    </div>;
  }

  return (
    <div className=" h-full overflow-x-auto max-w-full">

      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 w-full">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <h2 className="text-xl font-extrabold text-amber-400 italic w-full">Suivi Projet</h2>
            </div>
            <img src={cloudSvg} alt="cloud" className="ml-[0rem] mt-[5rem] size-32 hidden md:block" />
            <img src={cloudSvg} alt="cloud" className="ml-[10rem]  mt-[70rem] size-32 hidden md:block" />
            {/* <img src={cloudSvg} alt="cloud" className="ml-[10rem]  mt-[40rem] size-32 hidden md:block" /> */}
            <img src={cloudSvg} alt="cloud" className="ml-[20em] mt-[20rem] size-32 hidden md:block" />


          </header>
          <div className="p-6 w-full max-w-4xl mx-auto my-10 bg-gradient-to-br from-amber-50 to-amber-400  border border-amber-200 rounded-2xl shadow-sm space-y-10">

            {/* Titre projet */}
            <div className="">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Nom du projet : <span className="text-amber-600">{project.name || "Sans nom"}</span>
              </h2>
              <p className="text-sm text-gray-500">Résumé des scans et options de gestion.</p>
            </div>

            {/* Scans */}
            <div className="">
              <h3 className="text-lg font-semibold text-slate-700 mb-3">📂 Scans liés</h3>
              <ul className="space-y-4">
                {allScans.map((scan) => (
                  <li
                    key={scan._id}
                    className="p-4 border-l-4 bg-amber-50 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition"
                    style={{
                      borderColor: {
                        completed: "#22c55e",
                        running: "#eab308",
                        waiting: "#3b82f6",
                        error: "#ef4444"
                      }[scan.status] || "#94a3b8"
                    }}
                    onClick={() => {
                      let basePath =
                        scan.type === "user" ? "/scan_user"
                          : scan.type === "reason" ? "/scan_reason"
                            : "/scan_no_user";
                      navigate(`${basePath}/${scan._id}`);
                    }}
                  >
                    <div className="font-bold text-slate-800">{scan.name || "Scan sans nom"}</div>
                    <div className="text-sm text-slate-600">Type : {scan.type || "n/a"}</div>
                    <div className="text-sm text-slate-600">Iterations : {scan.iterations || "n/aaaa"}</div>

                    <div className="text-sm text-slate-600">Statut : <span className="font-semibold">{scan.status}</span></div>
                    <div className="text-xs text-gray-500">Créé le {new Date(scan.created_at).toLocaleDateString()}</div>

                    <ul className="mt-2 text-sm list-disc pl-5 text-gray-700">
                      {scan.commands_executed.map((cmd, idx) => (
                        <li key={idx}>{cmd.command}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              {/* Ajouter un scan */}
              <form onSubmit={handleAddScan} className="mt-6 bg-yellow-100 p-4 rounded-lg border border-yellow-200 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 ">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du scan</label>
                  <input
                    type="text"
                    placeholder="Ex: Scan initial"
                    value={newScanName}
                    onChange={(e) => setNewScanName(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-amber-400 focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Type de scan
                    <div className="group relative ml-1 inline-flex">
                      <InformationCircleIcon className="h-4 w-4 text-amber-500 cursor-help" />
                      <div className="absolute z-10 hidden group-hover:block w-64 p-2 -left-32 -top-32 bg-gray-300 border border-amber-200 rounded-lg shadow-lg text-xs text-gray-600">
                        <strong>Sans utilisateur:</strong> Exécution automatique complète<br />
                        <strong>Avec utilisateur:</strong> Confirmation requise pour chaque commande avec possibilité de personnalisation
                      </div>
                    </div>
                  </label>
                  <select
                    name="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="px-3 py-2 rounded border border-gray-300 focus:ring-amber-400 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="no_user">Sans utilisateur</option>
                    <option value="user">Avec utilisateur</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    Itérations
                    <div className="group relative ml-1 inline-flex">
                      <InformationCircleIcon className="h-4 w-4 text-amber-500 cursor-help" />
                      <div className="absolute z-10 hidden group-hover:block w-64 p-2 -left-32 -top-32 bg-gray-300 border border-amber-200 rounded-lg shadow-lg text-xs text-gray-600">
                        <strong>Nombre de commandes:</strong> de pentest que Pentral exécutera. Valeur recommandée entre 3 et 5 pour un bon équilibre entre couverture et performance.<br />
                        <span className="text-xs text-gray-500"> "Pas plus de 10 itérations pour éviter les pertes de contextes."</span>
                      </div>
                    </div>
                  </label>
                  <select
                    value={iterations}
                    onChange={(e) => setIterations(parseInt(e.target.value))}
                    className="px-3 pr-5 py-2  rounded border border-gray-300 focus:ring-amber-400 focus:border-amber-400 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    className="group relative inline-flex bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:from-amber-600 hover:to-orange-600 transition-all transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
                    <span>Ajouter</span>
                  </button>
                </div>

              </form>
            </div>

            {/* Partage Pas encore faites*/}
            {/* <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-3">🤝 Partager le projet</h3>
              <ul className="mb-3 list-disc ml-6 text-slate-700">
                {sharedWith.map((email, idx) => (
                  <li key={idx}>{email}</li>
                ))}
              </ul>

              <form onSubmit={handleShare} className="bg-yellow-50 p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Email de l'utilisateur"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border border-gray-300 focus:ring-green-400 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className=" bg-green-500 text-white px-3 py-2 rounded font-medium hover:bg-green-700 transition flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Partager
                </button>
              </form>
            </div> */}

            {/* Message */}
            {message && (
              <div className="p-3 text-sm bg-green-100 border border-green-300 rounded-lg text-green-800">
                {message}
              </div>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default ProjectDashboard
