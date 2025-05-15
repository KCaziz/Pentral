import { Card, Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

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


function Gestionproject() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  const TABLE_HEAD = ["Nom", "Entreprise", "Date création", "Nombre de scans", "Action"];
  const TABLE_ROWS = projects.map(proj => ({
    name: proj.name,
    company: proj.company,
    date: proj.created,
    scans: proj.scansCount,
    id: proj.id
  }));

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

  if (!projects || !user) return <p>Chargement...</p>

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
        <Card className="m-5  h-full  overflow-scroll rounded-xl shadow-sm">
  <table className=" w-full min-w-max table-auto text-left">
    <thead>
      <tr className="bg-primary">
        {TABLE_HEAD.map((head) => (
          <th key={head} className="p-4">
            <Typography
              variant="small"
              className="font-medium text-gray-700 font-sans"
            >
              {head}
            </Typography>
          </th>
        ))}
      </tr>
    </thead>
    <tbody className="font-sans">
      {TABLE_ROWS.map(({ id, name, company, date, scans }, index) => {
        const isEven = index % 2 === 0;
        const rowClasses = `p-4 ${isEven ? 'bg-yellow-50': 'bg-white' }`;

        return (
          <tr key={id} className="hover:bg-gray-100 transition-colors duration-150">
            <td className={`${rowClasses} rounded-l-lg`}>
              <Typography className="font-normal text-gray-800">
                {name}
              </Typography>
            </td>
            <td className={rowClasses}>
              <Typography className="font-normal text-gray-800">
                {company}
              </Typography>
            </td>
            <td className={rowClasses}>
              <Typography className="font-normal text-gray-800">
                {date}
              </Typography>
            </td>
            <td className={rowClasses}>
              <Typography className="font-normal text-gray-800">
                {scans}
              </Typography>
            </td>
            <td className={`${rowClasses} rounded-r-lg flex items-center`}>
              <Typography 
                as="a" 
                href="#" 
                className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
                onClick={(e) => { e.preventDefault(); navigate(`/project-dashboard/${id}`); }}
              >
                <PencilIcon className="p-1 h-6 w-6 text-blue-500 hover:bg-blue-500 hover:text-white rounded-md transition-colors" />
              </Typography>
              
              <Typography
                as="button"
                onClick={() => {
                  if (window.confirm("Supprimer ce projet et toutes ses données ?")) {
                    deleteProject(id);
                  }
                }}
                className="ml-3 font-medium text-red-600 hover:text-red-800 transition-colors"
              >
              <TrashIcon className="p-1 h-6 w-6 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors" />

              </Typography>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</Card>

      </SidebarInset>
    </SidebarProvider>
  );
}
export default Gestionproject
