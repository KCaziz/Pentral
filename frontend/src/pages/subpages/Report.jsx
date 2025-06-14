import { DocumentIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Card, IconButton, Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"
import { Activity } from "lucide-react";
import { useTheme } from "../../components/theme-provider";

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"

function Report() {
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scans, setScans] = useState([]);
  const [sortKey, setSortKey] = useState("creation");
  const { theme } = useTheme();
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
    "Actions",
  ];

  const TABLE_ROWS = scans

    .filter(scan => scan.finished_at && (scan.hasOwnProperty('report_url') &&
      scan.report_url !== null &&
      scan.report_url !== undefined &&
      scan.report_url !== "")
    )

    .map(scan => ({
      Titre: scan.name,
      command: scan.commands_executed.length,
      creation: new Date(scan.created_at).toLocaleString('fr-FR'),
      fin: new Date(scan.finished_at).toLocaleString('fr-FR'),
      target: scan.target,
      report_url: scan.report_url,
      id: scan._id,
    }));

  const sortedRows = [...TABLE_ROWS].sort((a, b) => {
    if (sortKey === "command") return b.command - a.command;
    return (a[sortKey] || "").localeCompare(b[sortKey] || "");
  });


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
        <header className="flex h-12 sm:h-16 items-center px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4 sm:h-6 bg-primary" />
            <h1 className="text-lg sm:text-xl font-extrabold text-primary italic bg-gradient-to-r from-rose-600 to-red-700 bg-clip-text text-transparent">Rapports</h1>
          </div>
        </header>
        <Card className="mx-2 sm:mx-4 my-4 h-full overflow-hidden bg-transparent ">
          <div className="overflow-x-auto rounded-2xl bg-background shadow-inner border border-gray-200/50 p-4 sm:p-6">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
              <select
                className="px-4 py-2.5 rounded-xl text-white bg-slate-700 italic border border-gray-300 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all duration-200 hover:shadow-xl sm:w-auto"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="creation">Par date de création</option>
                <option value="Titre">Par titre</option>
                <option value="command">Par nombre de commandes</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200/50">
              <table className="w-full min-w-[800px] table-auto text-sm rounded-2xl overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-rose-500 via-rose-600 to-red-700 text-white">
                    {TABLE_HEAD.map((head, index) => (
                      <th key={head} className={`p-3 sm:p-4 text-left font-semibold tracking-wide text-xs sm:text-sm uppercase ${index === 0 ? "rounded-tl-2xl" : ""} ${index === TABLE_HEAD.length - 1 ? "rounded-tr-2xl" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-white/90">{head}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 ">
                  {sortedRows.map(({ Titre, command, creation, fin, target, report_url, id }, index) => {
                    const isEven = index % 2 === 0;
                    return (
                      <tr
                        key={id}
                        className={`transition-all duration-200  ${isEven ? "bg-red-50" : "bg-red-100"} hover:bg-red-200 cursor-pointer`}
                      >
                        {/* Titre */}
                        <td className="p-3 sm:p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                              <DocumentIcon className="h-5 w-5 text-rose-600" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 group-hover:text-rose-700 transition-colors text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                                {Titre}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">Rapport d'analyse</p>
                            </div>
                          </div>
                        </td>

                        {/* Commande */}
                        <td className="p-3 sm:p-4">
                          <div className="px-3 py-2 bg-gradient-to-r from-gray-800 to-gray-900 text-center font-bold rounded-xl font-mono text-xs sm:text-sm text-gray-100 overflow-x-auto max-w-[120px] sm:max-w-xs shadow-lg group-hover:shadow-xl transition-shadow">
                            <code className="truncate text-green-400">{command}</code>
                          </div>
                        </td>

                        {/* Date création */}
                        <td className="p-3 sm:p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="font-semibold text-gray-700 text-xs sm:text-sm">
                              <span className="hidden sm:inline">{creation}</span>
                              <span className="sm:hidden">{creation.split(' ')[0]}</span>
                            </span>
                          </div>
                        </td>

                        {/* Date fin */}
                        <td className="p-3 sm:p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="font-semibold text-gray-700 text-xs sm:text-sm">
                              <span className="hidden sm:inline">{fin}</span>
                              <span className="sm:hidden">{fin?.split(' ')[0]}</span>
                            </span>
                          </div>
                        </td>

                        {/* Target */}
                        <td className="p-3 sm:p-4">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-200 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
                            <span className="truncate max-w-[80px] sm:max-w-none">{target}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3 sm:p-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <a
                              href={`http://127.0.0.1:5000${report_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Voir rapport"
                              className="group/icon p-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-500 hover:to-indigo-600 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110"
                            >
                              <DocumentIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 group-hover/icon:text-white transition-colors" />
                            </a>
                            <a
                              href={`http://127.0.0.1:5000${report_url}/dl`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Télécharger"
                              className="group/icon p-2.5 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-500 hover:to-emerald-600 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 group-hover/icon:text-white transition-colors" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>


            <div className="text-sm text-gray-500 italic font-medium text-right">
              <span className="text-rose-600 font-bold">{sortedRows.length}</span> rapports disponibles
            </div>
          </div>

        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Report