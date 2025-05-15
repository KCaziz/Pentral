import { DocumentIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Card, IconButton, Typography } from "@material-tailwind/react";
import React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function Historique() {
const [user, setUser] = useState("");
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [scans, setScans] = useState([]);
const navigate = useNavigate();
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

    const fetchScans = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/get_scans_user/${userId}`, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erreur serveur");
        setScans(data);        
      }
      catch (err) {
        console.error("Erreur fetchScans:", err.message);
        setError(err.message);
      }
    }
    fetchScans();
  }, [])


const TABLE_HEAD = [
  "Titre",
  "Command Executée",
  "Date de création",
  "Date de fin",
  "Target",
  "Status",
  "Actions",
];
 
// Fonction pour convertir une date en "il y a X temps"
// function getTimeSince(dateString) {
//   const date = new Date(dateString);
//   const now = new Date();
//   const diffMs = now - date; // différence en millisecondes

//   const diffMinutes = Math.floor(diffMs / (1000 * 60));
//   const diffHours = Math.floor(diffMinutes / 60);
//   const diffDays = Math.floor(diffHours / 24);

//   if (diffDays > 0) {
//     return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
//   } else if (diffHours > 0) {
//     return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
//   } else if (diffMinutes > 0) {
//     return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
//   } else {
//     return `il y a quelques secondes`;
//   }
// }

// Maintenant, on trie les scans par date (plus récent d'abord) et on prépare les lignes
const TABLE_ROWS = scans
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // plus récents en haut
  .map(scan => ({
    Titre: scan.name,
    command: scan.commands_executed.length,
    creation: (scan.created_at), // conversion en "il y a X"
    fin: scan.finished_at ,
    target: scan.target,
    report_url: scan.report_url,
    status: scan.status,
    id: scan._id,
  }));


  const deleteScan = async (scanId) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/scans/${scanId}`, {
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
      setScans(scans.filter(p => p.id !== scanId));
      
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de la suppression");
    }
  };


  if (!user && !scans) {return <div>chargement...</div>; }
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
    <Card className="m-5  h-full  overflow-scroll">
      <table className="w-full min-w-max table-auto text-left text-black">
        <thead>
          <tr className="bg-primary">
            {TABLE_HEAD.map((head) => (
              <th key={head} className="p-4 pt-5">
                <Typography
                  variant="small"
                  color="blue-gray"
                  className="font-bold leading-none"
                >
                  {head}
                </Typography>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
  {TABLE_ROWS.map(({ Titre, command, creation, fin, target, report_url, id, status }) => {
    // Déterminer la classe de couleur en fonction du statut
    const rowColorClass = {
      waiting: 'bg-blue-50 hover:bg-blue-100',
      running: 'bg-yellow-50 hover:bg-yellow-100',
      completed: 'bg-green-50 hover:bg-green-100',
      error: 'bg-red-50 hover:bg-red-100',
    }[status] || 'bg-gray-50 hover:bg-gray-100';

    return (
      <tr 
        key={id} 
        className={`${rowColorClass} cursor-pointer transition-colors`}
        onClick={() => navigate(`/scan_no_user/${id}`)}
      >
        <td className="p-4" >
          <Typography
            variant="small"
            color="blue-gray"
            className="font-bold"
          >
            {Titre}
          </Typography>
        </td>
        <td className="p-4" >
          <Typography
            variant="small"
            className="font-normal text-gray-600"
          >
            {command}
          </Typography>
        </td>
        <td className="p-4" >
          <Typography
            variant="small"
            className="font-normal text-gray-600"
          >
            {new Date(creation).toLocaleString()}
          </Typography>
        </td>
        <td className="p-4" >
          <Typography
            variant="small"
            className="font-normal text-gray-600"
          >
            {fin ? new Date(fin).toLocaleString() : '-'}
          </Typography>
        </td>
        <td className="p-4" >
          <Typography
            variant="small"
            className="font-normal text-gray-600"
          >
            {target}
          </Typography>
        </td>
        <td className="p-4" >
          <Typography
            variant="small"
            className="font-bold"
          >
            {status}
          </Typography>
        </td>
        <td className="p-4" >
          <Typography
            as="button"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Supprimer ce projet et toutes ses données ?")) {
                deleteScan(id);
              }
            }}
            variant="small"
            color="red"
            className="font-medium cursor-pointer hover:text-red-700 transition-colors"
          >
            <TrashIcon className="h-5 w-5 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors" />
            
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

export default Historique