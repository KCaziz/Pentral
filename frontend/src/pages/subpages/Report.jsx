import { DocumentIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
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

function Report() {
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
        <h1 className="text-xl font-extrabold text-amber-400 italic">Rapports</h1>
      </div>
    </header>
        <Card className="mx-1  h-full overflow-x-auto max-w-full bg-transparent ">
          <div className="overflow-x-auto rounded-2xl shadow-xl border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            {/* Tri */}
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

            <table className="w-full table-auto text-sm text-amber-100">
              <thead>
                <tr className="bg-gradient-to-r from-amber-400 to-yellow-600 text-white uppercase text-xs tracking-wider">
                  {TABLE_HEAD.map((head) => (
                    <th key={head} className="p-4 text-left rounded-t">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ Titre, command, creation, fin, target, report_url, id }, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <tr
                      key={id}
                      className={`transition-all duration-200 ${isEven ? "bg-slate-800/70" : "bg-slate-700/60"
                        } hover:bg-orange-900/40 hover:shadow-md`}
                    >
                      <td className="p-4 font-bold text-amber-200">{Titre}</td>
                      <td className="p-4 font-bold  text-white text-center">                       
                        <div className="px-3 py-2 bg-gray-700 text-center font-bold rounded-md font-mono text-sm text-gray-300 overflow-x-auto max-w-xs">
                          <code className="truncate ">{command}</code>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-white">{creation}</td>
                      <td className="p-4 font-semibold text-white">{fin}</td>
                      <td className="p-4 font-semibold text-white">{target}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <a
                            href={`http://127.0.0.1:5000${report_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Voir rapport"
                            className="hover:text-amber-400"
                          >
                            <DocumentIcon className="h-5 w-5" />
                          </a>
                          <a
                            href={`http://127.0.0.1:5000${report_url}/dl`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Télécharger"
                            className="hover:text-amber-400"
                          >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 text-right text-xs text-amber-400 italic">
              {sortedRows.length} scans affichés
            </div>
          </div>

        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default Report