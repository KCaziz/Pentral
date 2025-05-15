import { AppSidebar } from "@/components/app-sidebar"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

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
import { use, useEffect, useState } from "react"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"


export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nbProjects, setNbProjects] = useState(null);
  const [nbScans, setnbScans] = useState(null);
  const [scans, setScans] = useState([]);
  const [tempsMoyenMinutes, setTempsMoyenMinutes] = useState(0);
  const [tempsGagneEstimeMinutes, setTempsGagneEstimeMinutes] = useState(0);
  const [chart, setChart] = useState([]);
  const [nbscans_effectues, setNbscans_effectues] = useState(0);

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
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');

    const fetchProjects = async () => {
      try {
        const projectsRes = await fetch(`http://127.0.0.1:5000/api/projects/${userId}`);
        const projectsData = await projectsRes.json();

        if (!projectsRes.ok) throw new Error(projectsData.error);

        // Récupérer les détails des scans en parallèle
        setNbProjects(projectsData.length);

      }
      catch (error) {
        console.error("Erreur:", error);
        return [];
      }
    };
    fetchProjects();

    const fetchScans = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/get_scans_user/${userId}`, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erreur serveur");
        setScans(data);
        setnbScans(data.length);
      }
      catch (err) {
        console.error("Erreur fetchScans:", err.message);
        setError(err.message);
      }
    }
    fetchScans();
  }, [])

  useEffect(() => {
    if (scans.length > 0) {
      const stats = estimateTimeSaved(scans);
      setTempsMoyenMinutes(stats.averageSaved);
      setTempsGagneEstimeMinutes(stats.totalSavedMinutes);
      setNbscans_effectues(stats.scansCount);
      setChart(compterScansParJour(scans));
    }
  }, [scans]);

  // je ne suis pas sur de la justesse me des calculs
  function estimateTimeSaved(scans) {
    const finishedScans = scans.filter(scan => scan.finished_at);;

    if (finishedScans.length === 0) return { averageSaved: 0, totalSavedMinutes: 0 };

    const totalTimeSpent = finishedScans.reduce((acc, scan) => {
      const start = new Date(scan.started_at);
      const end = new Date(scan.finished_at);
      const diffMinutes = (end - start) / (1000 * 60); // conversion en minutes
      return acc + diffMinutes;
    }, 0);

    const averageHumanPentestTime = 240; // minutes (4h)
    const averageTimeSpent = totalTimeSpent / finishedScans.length;
    const averageSaved = averageHumanPentestTime - averageTimeSpent;

    const totalSavedMinutes = (averageHumanPentestTime * finishedScans.length) - totalTimeSpent;

    return {
      averageSaved: Math.round(averageSaved),
      totalSavedMinutes: Math.round(totalSavedMinutes),
      scansCount: finishedScans.length
    };
  };


  // compter les scans par jour
  const compterScansParJour = (scans) => {
    const counts = {};

    scans.forEach(scan => {
      const date = new Date(scan.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
      counts[date] = (counts[date] || 0) + 1;
    });

    // Transformer en tableau pour Recharts
    return Object.keys(counts).map(date => ({
      date,
      scans: counts[date]
    }));
  };

  if (!scans || !user) return <p>Chargement...</p>
  return (

    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2">
    <SidebarTrigger />
    <Separator orientation="vertical" className="h-4" />
  </div>
  {/* <img src={cloudSvg} alt="cloud" className=" ml-auto mb-10  size-32" />
  <img src={cloudSvg} alt="cloud" className=" ml-[50%] mt-20 size-32" /> */}

        </header>
        <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
          {/* Section cartes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            <div className="aspect-video flex flex-col justify-center items-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
              <p className="text-lg font-semibold">Nombre de projets</p>
              <p className="text-4xl font-bold">{nbProjects}</p>
            </div>

            <div className="aspect-video flex flex-col justify-center items-center rounded-xl bg-gradient-to-r from-green-400 to-emerald-600 text-white shadow-lg">
              <p className="text-lg font-semibold">Nombre de scans effectués</p>
              <p className="text-4xl font-bold">{nbScans ? nbScans : 0}</p>
            </div>

            <div className="aspect-video flex flex-col justify-center items-center rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg">
              <p className="text-lg font-semibold">Temps gagné</p>
              <p className="text-2xl font-bold">{(tempsGagneEstimeMinutes / 60).toFixed(1)} heures</p>
            </div>

            <div className="aspect-video flex flex-col justify-center items-center rounded-xl bg-gradient-to-r from-pink-400 to-red-500 text-white shadow-lg">
              <p className="text-lg font-semibold">Temps moyen par scan</p>
              <p className="text-2xl font-bold">{tempsMoyenMinutes.toFixed(1)} min</p>
            </div>

          </div>

          {/* Section graph */}
          <div className="min-h-[400px] flex-1 rounded-xl bg-black bg-opacity-50 p-6">
            <h2 className="text-center text-yellow-400 font-bold mb-4 text-xl">Scans par Jour</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                <XAxis dataKey="date" stroke="#ccc" />
                <YAxis allowDecimals={false} stroke="#ccc" />
                <Tooltip />
                <Bar dataKey="scans" fill="#00C49F" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
