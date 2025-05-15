import { DocumentIcon } from "@heroicons/react/24/solid";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Card, IconButton, Typography } from "@material-tailwind/react";
import React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"

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
    
    .filter(scan => scan.finished_at &&  (scan.hasOwnProperty('report_url') && 
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

  if (!user && !scans) { return <div>chargement...</div>; }
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
              {TABLE_ROWS.map(({ Titre, command, creation, fin, target, report_url, id }, index) => {
                const isEven = index % 2 === 0;
                const rowClasses = `p-4 ${isEven ? 'bg-yellow-50' : 'bg-white'}`;
                return (
                  <tr key={id}>
                    <td className={rowClasses}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-bold"
                      >
                        {Titre}
                      </Typography>
                    </td>
                    <td className={rowClasses}>
                      <Typography
                        variant="small"
                        className="font-normal text-gray-600"
                      >
                        {command}
                      </Typography>
                    </td>
                    <td className={rowClasses}>
                      <Typography
                        variant="small"
                        className="font-normal text-gray-600"
                      >
                        {creation}
                      </Typography>
                    </td>
                    <td className={rowClasses}>
                      <Typography
                        variant="small"
                        className="font-normal text-gray-600"
                      >
                        {fin}
                      </Typography>
                    </td>
                    <td className={rowClasses}>
                      <Typography
                        variant="small"
                        className="font-normal text-gray-600"
                      >
                        {target}
                      </Typography>
                    </td>
                    <td className={rowClasses}>
                      <div className="flex items-center gap-2">
                        <a
                          href={`http://127.0.0.1:5000/${report_url}`}
                          target="_blank"
                          rel="noopener noreferrer"

                        >
                          <IconButton variant="text" size="sm">
                            <DocumentIcon className="h-4 w-4 text-gray-900" />
                          </IconButton>
                        </a>
                        <a
                          href={`http://127.0.0.1:5000/${report_url}/dl`}
                          target="_blank"
                          rel="noopener noreferrer"

                        >
                          <IconButton variant="text" size="sm">
                            <ArrowDownTrayIcon
                              strokeWidth={3}
                              className="h-4 w-4 text-gray-900"
                            />
                          </IconButton>
                        </a>
                      </div>
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

export default Report