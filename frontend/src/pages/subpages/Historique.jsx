import { ArrowDownTrayIcon, TrashIcon, GlobeAltIcon, EyeIcon, ChevronUpDownIcon, ArrowPathIcon, ExclamationTriangleIcon, DocumentTextIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { Card, IconButton, Typography, Tooltip, Button } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"
import { Activity, Italic } from "lucide-react";
import { ClockIcon, CheckCircleIcon } from "lucide-react";

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


  // Maintenant, on trie les scans par date (plus récent d'abord) et on prépare les lignes
  const TABLE_ROWS = scans
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // plus récents en haut
    .map(scan => ({
      Titre: scan.name,
      command: scan.commands_executed.length,
      creation: (scan.created_at), // conversion en "il y a X"
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
        <header className="flex h-16 items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6 bg-primary" />
            <h1 className="text-lg sm:text-xl font-extrabold text-primary italic">Historique</h1>
          </div>
        </header>

        <Card className="mx-1 h-full overflow-x-auto max-w-full bg-transparent">
          <div className="relative rounded-2xl shadow-xl border border-yellow-900 p-2 sm:p-4">
            <div className="flex justify-between items-center mb-4 px-1 sm:px-2">
              <select
                className="px-2 py-1 sm:px-3 sm:py-2 rounded-md text-white bg-slate-700 border border-black text-xs sm:text-sm italic"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="creation">Par date de création</option>
                <option value="Titre">Par titre</option>
                <option value="command">Par nombre de commandes</option>
              </select>
            </div>

            {/* Tableau avec thème sombre */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] table-auto text-left rounded-xl overflow-hidden shadow-2xl pl-0 ml-0">
                <thead className="bg-gradient-to-br from-rose-500 to-red-800 shadow-lg ">
                  <tr>
                    {TABLE_HEAD.map((head, index) => (
                      <th
                        key={head}
                        className={`border-l-0 p-3 sm:p-4 pt-4 sm:pt-5 ${index === 0 ? "rounded-tl-xl" : ""} ${index === TABLE_HEAD.length - 1 ? "rounded-tr-xl" : ""
                          }`}
                      >
                        <button
                          onClick={() => handleSort(head.toLowerCase())}
                          className="flex items-center justify-between w-full focus:outline-none"
                        >
                          <Typography
                            variant="small"
                            className="text-yellow-50 drop-shadow-lg text-xs sm:text-sm"
                          >
                            {head}
                          </Typography>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-700">
                  {sortedRows.map(({ Titre, command, creation, fin, target, report_url, id, status }) => {
                    const rowColorClass = {
                      waiting: 'bg-blue-800/80 hover:bg-blue-800/60 border-l-3 border-b-0 border-blue-400',
                      running: 'bg-yellow-800/80 hover:bg-yellow-800/60 border-l-3 border-b-0 border-yellow-400',
                      completed: 'bg-green-800/80 hover:bg-green-800/60 border-l-3 border-b-0 border-green-400',
                      error: 'bg-red-800/80 hover:bg-red-800/60 border-l-3 border-b-0 border-red-400',
                    }[status] || 'bg-gray-800/80 hover:bg-gray-800/60 border-l-3 border-b-0 border-gray-400';

                    const statusIcon = {
                      waiting: <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />,
                      running: <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />,
                      completed: <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />,
                      error: <ExclamationTriangleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />,
                    }[status];

                    return (
                      <tr
                        key={id}
                        className={`${rowColorClass} cursor-pointer transition-all duration-200 hover:bg-opacity-40 group`}
                        onClick={() => navigate(`/scan_no_user/${id}`)}
                      >
                        <td className="p-2 sm:p-4">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-700 shadow-md flex items-center justify-center">
                                <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                              </div>
                            </div>
                            <div>
                              <Typography
                                variant="small"
                                className="font-bold text-white group-hover:text-orange-400 transition-colors text-xs sm:text-sm"
                              >
                                {Titre}
                              </Typography>
                              {report_url && (
                                <a
                                  href={report_url}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center mt-1"
                                >
                                  <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                                  Télécharger
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-2 sm:p-4">
                          <div className="px-2 py-1 sm:px-3 sm:py-2 bg-gray-700 text-center font-bold rounded-md font-mono text-xs sm:text-sm text-gray-300 overflow-x-auto max-w-[120px] sm:max-w-xs">
                            <code className="truncate">{command}</code>
                          </div>
                        </td>

                        <td className="p-2 sm:p-4">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                            <Typography variant="small" className="font-normal text-gray-300 text-xs sm:text-sm">
                              {new Date(creation).toLocaleString()}
                            </Typography>
                          </div>
                        </td>

                        <td className="p-2 sm:p-4">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            {fin ? (
                              <>
                                <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                                <Typography variant="small" className="font-normal text-gray-300 text-xs sm:text-sm">
                                  {new Date(fin).toLocaleString()}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="small" className="font-normal text-gray-500 italic text-xs sm:text-sm">
                                En cours...
                              </Typography>
                            )}
                          </div>
                        </td>

                        <td className="p-2 sm:p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-200">
                            <GlobeAltIcon className="h-3 w-3 mr-1 text-orange-400" />
                            <span className="truncate max-w-[80px] sm:max-w-none">{target}</span>
                          </span>
                        </td>

                        <td className="p-2 sm:p-4">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            {statusIcon}
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${status === 'waiting' ? 'bg-blue-900/50 text-blue-200' :
                              status === 'running' ? 'bg-yellow-900/50 text-yellow-200' :
                                status === 'completed' ? 'bg-green-900/50 text-green-200' :
                                  'bg-red-900/50 text-red-200'
                              }`}>
                              {status}
                            </span>
                          </div>
                        </td>

                        <td className="p-2 sm:p-4">
                          <div className="flex space-x-1 sm:space-x-2 ">
                            {/* <Tooltip content="Supprimer"> */}
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm("Supprimer ce projet et toutes ses données ?")) {
                                    deleteScan(id);
                                  }
                                }}
                                // className="p-1 sm:p-2 rounded-lg bg-gray-700 shadow hover:bg-red-900/50 transition-colors "
                                className="hover:bg-red-900/50 transition-colors"
                                variant="primary"
                              >
                                <TrashIcon className="h-4 w-4 text-red-400 hover:text-white transition-colors" />
                              </Button>
                            {/* </Tooltip> */}

                            {/* <Tooltip content="Voir les détails"> */}
                              <Button
                                onClick={() => navigate(`/scan_no_user/${id}`)}
                                // className="p-1 sm:p-2 rounded-lg bg-gray-700 shadow hover:bg-blue-900/50 transition-colors"
                                className="hover:bg-blue-900/50 transition-colors"
                                variant="outline"
                              >
                                <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 hover:text-white transition-colors" />
                              </Button>
                            {/* </Tooltip> */}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-right text-xs text-red-400 italic">
              {sortedRows.length} scans affichés
            </div>
          </div>
        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Historique