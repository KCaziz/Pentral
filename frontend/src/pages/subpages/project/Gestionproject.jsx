import { Card, Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrashIcon, PencilIcon, BuildingOfficeIcon, CalendarIcon, EyeIcon, UserCircleIcon } from "@heroicons/react/24/outline";

import { AppSidebar } from "@/components/app-sidebar"
import { Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"


function Gestionproject() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [sortKey, setSortKey] = useState("creation");
  const navigate = useNavigate();

  const TABLE_HEAD = ["Nom", "Entreprise", "Date création", "Nombre de scans", "Action"];
  const TABLE_ROWS = projects.map(proj => ({
    name: proj.name,
    company: proj.company,
    date: proj.created,
    scans: proj.scansCount,
    id: proj.id
  }));
  const sortedRows = [...TABLE_ROWS].sort((a, b) => {
    if (sortKey === "scans") return b.scans - a.scans;
    return (a[sortKey] || "").localeCompare(b[sortKey] || "");
  });

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

    const loadProjects = async () => {
      setLoading(true);
      const projectsData = await fetchProjects(userId);
      setProjects(projectsData);
      setLoading(false);
    };

    loadProjects();
  }, [])


  const fetchProjects = async (userId) => {
    try {
      const projectsRes = await fetch(`http://127.0.0.1:5000/api/projects/${userId}`);
      const projectsData = await projectsRes.json();

      if (!projectsRes.ok) throw new Error(projectsData.error);

      // Récupérer les détails des scans en parallèle
      const projectsWithScans = await Promise.all(
        projectsData.map(async project => {
          const scansCount = project.scans?.length || 0;
          return {
            name: project.name,
            company: project.company || "Personnel",
            created: new Date(project.created_at).toLocaleDateString('fr-FR'),
            scansCount,
            id: project._id
          };
        })
      );

      return projectsWithScans;
    } catch (error) {
      console.error("Erreur:", error);
      return [];
    }
  };

  const deleteProject = async (projectId) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error("Échec de la suppression");
      }

      // Mettre à jour l'état local
      setProjects(projects.filter(p => p.id !== projectId));

    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de la suppression");
    }
  };

  if (!user || !projects) {
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
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        {/* <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
          </div>
          <img src={cloudSvg} alt="cloud" className=" ml-auto mb-10  size-32" />
          <img src={cloudSvg} alt="cloud" className=" ml-[50%] mt-20 size-32" />

        </header> */}
              <header className="flex h-16 items-center px-6 ">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="hover:text-amber-500 transition-colors" />
        <Separator orientation="vertical" className="h-6 bg-amber-200" />
        <h1 className="text-xl font-extrabold text-amber-400 italic">Projets</h1>
      </div>
    </header>
        <div className="relative mx-1 rounded-2xl shadow-xl border border-yellow-900 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
          <div className="flex justify-between items-center mb-4 px-2">
            {/* <h2 className="text-xl italic font-extrabold text-amber-400">Projets  </h2> */}
            <select
              className="px-3 py-2 rounded-md bg-slate-700 text-amber-200 border border-slate-600 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              <option value="creation">Par date de création</option>
              <option value="name">Par nom</option>
              <option value="scans">Par nombre de scans</option>
              <option value="company">Par entreprise</option>
            </select>
          </div>
          <Card className="mx-2  h-full overflow-x-auto max-w-full bg-transparent">
            <div className="space-y-2">
              <div className="p-2"> 
                <div className="grid grid-cols-12 gap-4 py-3 
        bg-gradient-to-r from-amber-400 to-orange-500 
        rounded-lg text-white font-bold tracking-wide shadow items-center">

                  <div className="col-span-3 pl-6 flex items-center">
                    {TABLE_HEAD[0]}
                  </div>

                  <div className="col-span-2 flex items-center">
                    {TABLE_HEAD[1]}
                  </div>

                  <div className="col-span-2 flex items-center">
                    {TABLE_HEAD[2]}
                  </div>

                  <div className="col-span-2 flex justify-center">
                    {TABLE_HEAD[3]}
                  </div>

                  <div className="col-span-3 pr-6 flex justify-end">
                    {TABLE_HEAD[4]}
                  </div>
                </div>
              </div>

              {/* Liste des projets */}
              <div className="grid grid-cols-1 gap-2">
                {sortedRows.map(({ id, name, company, date, scans }) => (
                  <div
                    key={id}
                    className="bg-white border border-amber-100 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 mx-2" 
                  >
                    <div className="grid grid-cols-12 items-center p-5 gap-4">
                      <div className="col-span-3 flex items-center gap-3 pl-2">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <UserCircleIcon className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="text-slate-800 font-semibold">{name}</div>
                      </div>

                      <div className="col-span-2 flex items-center text-slate-600">
                        <BuildingOfficeIcon className="h-5 w-5 text-orange-400 mr-2" />
                        {company}
                      </div>

                      <div className="col-span-2 flex items-center text-slate-600">
                        <CalendarIcon className="h-5 w-5 text-orange-400 mr-2" />
                        {date}
                      </div>

                      <div className="col-span-2 flex justify-center">
                        <div className="bg-orange-100 text-orange-700 text-sm font-semibold px-3 py-1 rounded-full flex items-center shadow-inner">
                          <EyeIcon className="h-4 w-4 mr-1.5" />
                          {scans}
                        </div>
                      </div>

                      <div className="col-span-3 flex justify-end gap-2 pr-2"> 
                        <button
                          onClick={() => navigate(`/project-dashboard/${id}`)}
                          className="p-2 bg-orange-100 rounded-lg hover:bg-orange-200 transition"
                          title="Ouvrir"
                        >
                          <PencilIcon className="h-5 w-5 text-orange-600" />
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm("Supprimer ce projet et toutes ses données ?")) {
                              deleteProject(id);
                            }
                          }}
                          className="p-2 bg-red-100 rounded-lg hover:bg-red-200 transition"
                          title="Supprimer"
                        >
                          <TrashIcon className="h-5 w-5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
export default Gestionproject
