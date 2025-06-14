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
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
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
        <header className="flex h-16 items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6 bg-primary" />
            <h1 className="text-lg sm:text-xl font-extrabold text-primary italic">Projets</h1>
          </div>
        </header>

        <div className="relative mx-1 sm:mx-2 rounded-xl sm:rounded-2xl shadow-md sm:shadow-xl border border-yellow-900 p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4 px-1 sm:px-2">
            <select
              className="px-2 py-1 sm:px-3 sm:py-2 rounded-md bg-slate-700 text-white italic border border-slate-600 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500  sm:w-auto"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              <option value="creation">Par date de création</option>
              <option value="name">Par nom</option>
              <option value="scans">Par nombre de scans</option>
              <option value="company">Par entreprise</option>
            </select>
          </div>

          <Card className="mx-0 sm:mx-2 h-full overflow-x-auto max-w-full bg-transparent shadow-none border-none">
            <div className="space-y-0">

              {/* ✅ En-tête version desktop */}
              <div className="hidden sm:block p-2">
                <div className="grid grid-cols-12 gap-2 py-3 bg-gradient-to-r from-rose-500 to-red-800 rounded-lg text-white font-bold tracking-wide shadow-lg items-center text-sm">
                  <div className="col-span-3 pl-4 sm:pl-6">{TABLE_HEAD[0]}</div>
                  <div className="col-span-2 text-center">{TABLE_HEAD[1]}</div>
                  <div className="col-span-2 text-center">{TABLE_HEAD[2]}</div>
                  <div className="col-span-2 text-center">{TABLE_HEAD[3]}</div>
                  <div className="col-span-3 pr-4 sm:pr-6 text-right">{TABLE_HEAD[4]}</div>
                </div>
              </div>

              {/* ✅ En-tête version mobile */}
              <div className="block sm:hidden p-2">
                <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-rose-500 to-red-800 rounded-lg text-white font-bold tracking-wide shadow-lg text-xs">
                  <div className="flex-1">{TABLE_HEAD[0]}</div>
                  <div className="col-span-2 ml-[50%] text-center">{TABLE_HEAD[3]}</div>
                  <div className="flex-1 text-right">{TABLE_HEAD[4]}</div>
                </div>
              </div>

              {/* Liste des projets - version responsive */}
              <div className="grid grid-cols-1 gap-1 sm:gap-2">
                {sortedRows.map(({ id, name, company, date, scans }) => (
                  <div
                    key={id}
                    className="bg-gradient-to-r from-white to-red-50 border border-amber-100 rounded-lg sm:rounded-xl shadow-sm sm:shadow-md hover:shadow-md sm:hover:shadow-lg transition-all duration-300 mx-0 sm:mx-2"
                  >
                    <div className="grid grid-cols-12 items-center p-3 sm:p-5 gap-2 sm:gap-4">
                      {/* Nom du projet - toujours visible */}
                      <div className="col-span-7 sm:col-span-3 flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <UserCircleIcon className="h-4 w-4 sm:h-6 sm:w-6 text-red-600" />
                        </div>
                        <div className="text-slate-800 font-medium sm:font-semibold text-sm sm:text-base truncate">
                          {name}
                        </div>
                      </div>

                      {/* Entreprise - caché sur mobile */}
                      <div className="hidden sm:flex sm:col-span-2 items-center text-slate-600 text-sm sm:text-base">
                        <BuildingOfficeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 mr-1 sm:mr-2" />
                        <span className="truncate">{company}</span>
                      </div>

                      {/* Date - caché sur mobile */}
                      <div className="hidden sm:flex sm:col-span-2 items-center text-slate-600 text-sm sm:text-base">
                        <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 mr-1 sm:mr-2" />
                        <span className="truncate">{date}</span>
                      </div>

                      {/* Nombre de scans */}
                      <div className="col-span-3 sm:col-span-2 flex justify-center">
                        <div className="bg-red-100 text-red-700 text-xs sm:text-sm font-medium sm:font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full flex items-center shadow-inner">
                          <EyeIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                          {scans}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 sm:col-span-3 flex justify-end gap-1 sm:gap-2 pr-1 sm:pr-2">
                        <button
                          onClick={() => navigate(`/project-dashboard/${id}`)}
                          className="p-1 sm:p-2 bg-red-100 rounded-md sm:rounded-lg hover:bg-red-200 transition"
                          title="Ouvrir"
                        >
                          <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm("Supprimer ce projet et toutes ses données ?")) {
                              deleteProject(id);
                            }
                          }}
                          className="p-1 sm:p-2 bg-red-100 rounded-md sm:rounded-lg hover:bg-red-200 transition"
                          title="Supprimer"
                        >
                          <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Version mobile - infos supplémentaires */}
                    <div className="sm:hidden px-3 pb-3 pt-1 text-sm text-gray-600">
                      <div className="flex items-center mb-1">
                        <BuildingOfficeIcon className="h-4 w-4 text-red-400 mr-2" />
                        {company}
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 text-red-400 mr-2" />
                        {date}
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
