import { TrashIcon } from "@heroicons/react/24/outline";
import { Card, IconButton, Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"
import { Activity } from "lucide-react";

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"

function Gestionscans() {
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scans, setScans] = useState([]);
  const [sortKey, setSortKey] = useState("creation");

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

  const TABLE_ROWS = scans
    .map(scan => ({
      Titre: scan.name,
      command: scan.commands_executed.length,
      creation: scan.created_at,
      fin: scan.finished_at,
      target: scan.target,
      report_url: scan.report_url,
      status: scan.status,
      id: scan._id,
    }));
  const sortedRows = [...TABLE_ROWS].sort((a, b) => {
    if (sortKey === "command") return b.command - a.command;
    return (a[sortKey] || "").localeCompare(b[sortKey] || "");
  });

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


  if (!user || !scans) {
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
        <SidebarTrigger  />
        <Separator orientation="vertical" className="h-6 bg-primary" />
        <h1 className="text-xl font-extrabold text-primary italic">Scans</h1>
      </div>
    </header>
        <Card className="mx-1  h-full overflow-x-auto max-w-full bg-transparent ">
          <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-md bg-slate-900 p-4">
            <div className="flex justify-between items-center mb-4 px-2">
              {/* <h2 className="text-xl font-extrabold text-amber-400 italic">Scans</h2> */}
              <select
                className="px-3 py-2 rounded-md bg-slate-700 text-amber-200 border border-slate-600 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="creation">Par date de création</option>
                <option value="Titre">Par titre</option>
                <option value="command">Par nombre de commandes</option>
              </select>
            </div>

            <table className="w-full table-fixed text-sm text-amber-100 border-separate border-spacing-y-1">
              <thead>
                <tr className="uppercase text-xs bg-slate-800 border border-slate-700 text-amber-300">
                  {TABLE_HEAD.map((head) => (
                    <th key={head} className="p-3 text-left font-bold tracking-wide">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedRows.map(({ Titre, command, creation, fin, target, report_url, id, status }) => {
                  const rowColorClass = {
                    waiting: 'bg-blue-900/20 hover:bg-blue-900/30 border-l-4 ',
                    running: 'bg-yellow-900/20 hover:bg-yellow-900/30 border-l-4 ',
                    completed: 'bg-green-900/20 hover:bg-green-900/30 border-l-4',
                    error: 'bg-red-900/20 hover:bg-red-900/30 border-l-4',
                  }[status] || 'bg-gray-900/20 hover:bg-gray-900/30 border-l-4';

                  return (
                    <tr
                      key={id}
                      className={` hover:bg-yellow-900/40 hover:shadow-md hover:shadow-orange-500/10 transition-all rounded-xl ${rowColorClass} cursor-pointer`}
                      onClick={() => navigate(`/scan_no_user/${id}`)}
                    >
                      <td className="p-3 font-bold text-amber-200">{Titre}</td>
                      <td className="p-3 text-amber-100"> 
                        <div className="px-3 py-2 bg-gray-700 text-center font-bold rounded-md font-mono text-sm text-gray-300 overflow-x-auto max-w-xs">
                          <code className="truncate ">{command}</code>
                        </div>
                        </td>
                      <td className="p-3 font-semibold text-white">{new Date(creation).toLocaleString()}</td>
                      <td className="p-3 font-semibold text-white">{fin ? new Date(fin).toLocaleString() : "-"}</td>
                      <td className="p-3 font-semibold text-white">{target}</td>
                      <td className="p-3">
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full 
                ${{
                              waiting: 'bg-blue-900 text-blue-300',
                              running: 'bg-yellow-900 text-yellow-300',
                              completed: 'bg-green-900 text-green-300',
                              error: 'bg-red-900 text-red-300',
                            }[status] || 'bg-slate-700 text-slate-300'
                            }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Supprimer ce projet et toutes ses données ?")) {
                              deleteScan(id);
                            }
                          }}
                          className="hover:bg-red-600/20 p-1 rounded-md transition-all"
                          title="Supprimer"
                        >
                          <TrashIcon className="h-5 w-5 text-red-400 hover:text-red-200 transition-colors" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 text-right text-xs text-slate-400 italic">
              {sortedRows.length} scans listés
            </div>
          </div>

        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Gestionscans