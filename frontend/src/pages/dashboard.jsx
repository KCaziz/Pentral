import { AppSidebar } from "@/components/app-sidebar"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { use, useEffect, useState } from "react"
import { Activity } from "lucide-react";


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
      setTempsMoyenMinutes(stats.averageSpeed);
      setTempsGagneEstimeMinutes(stats.totalSavedMinutes);
      setNbscans_effectues(stats.scansCount);
      setChart(compterScansParJour(scans));
    }
  }, [scans]);

function estimateTimeSaved(scans) {
  const finishedScans = scans.filter(scan => scan.started_at && scan.finished_at);

  if (finishedScans.length === 0) {
    return {
      averageSpeed: 0,
      totalSavedMinutes: 0,
      scansCount: 0
    };
  }

  const averageHumanPentestTime = 120; // minutes (estimation manuelle)

  let totalTimeSpent = 0;

  for (const scan of finishedScans) {
    const start = new Date(scan.started_at);
    const end = new Date(scan.finished_at);

    const diffMinutes = (start-end) / (1000 * 60);
    console.log(diffMinutes);
    

    // Ignorer les valeurs négatives ou absurdes
    if (!isNaN(diffMinutes) && diffMinutes > 0 && diffMinutes < 600) {
      totalTimeSpent += diffMinutes;
    }
  }

  const validScanCount = finishedScans.length;
  const averageTimeSpent = totalTimeSpent / validScanCount;

  const totalHumanTime = validScanCount * averageHumanPentestTime;
  const totalSavedMinutes = totalHumanTime - totalTimeSpent;

  return {
    averageSpeed: Math.round(averageTimeSpent),
    totalSavedMinutes: Math.max(0, Math.round(totalSavedMinutes)),
    scansCount: validScanCount
  };
}


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

  function compterScansParMois(scans) {
    const counts = {};

    scans.forEach(scan => {
      const date = new Date(scan.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      counts[monthKey] = (counts[monthKey] || 0) + 1;
    });

    return Object.keys(counts).map(key => ({ mois: key, scans: counts[key] }));
  }


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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 items-center px-6 border-b border-amber-100">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-4 h-6 bg-amber-300" />
            <h2 className="text-xl font-extrabold text-amber-400 italic">Dashboard Utilisateur</h2>
          </header>

          <div className="flex flex-col gap-8 p-6">
            {/* Cartes statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-xl bg-gradient-to-r from-amber-700 to-orange-600 p-5 shadow-lg" title="Nombre total de projets que vous avez créés.">
                <p className="text-sm text-slate-100">Projets</p>
                <p className="text-3xl font-bold">{nbProjects}</p>
              </div>

              <div className="rounded-xl bg-gradient-to-r from-yellow-600 to-orange-500 p-5 shadow-lg" title="Total de scans que vous avez exécutés.">
                <p className="text-sm text-slate-100">Scans</p>
                <p className="text-3xl font-bold">{nbScans || 0}</p>
              </div>

              <div className=" group relative rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 p-5 shadow-lg" >
                <p className="flex text-sm text-slate-100">Temps gagné  <InformationCircleIcon className="h-4 w-4 pl-1 text-black cursor-help" />
                <div className="z-4 absolute hidden group-hover:block w-64 p-2 left-8 top-20 bg-gray-300 border border-amber-200 rounded-lg shadow-lg text-xs text-gray-600">
                  Temps totale gagné par rapport à un pentest manuel estimé à 2h par scan.
                </div>
                </p>

                <p className="text-2xl font-bold">{(tempsGagneEstimeMinutes / 60).toFixed(1)} h</p>
              </div>

              <div className="group relative rounded-xl bg-gradient-to-r from-green-600 to-emerald-800 p-5 shadow-lg">
                <p className="text-sm text-slate-100 flex">Durée moyenne  <InformationCircleIcon className="h-4 w-4 pl-1 text-black cursor-help" />

                <div className="z-4 absolute hidden group-hover:block w-64 p-2 left-8 top-20 bg-gray-300 border border-amber-200 rounded-lg shadow-lg text-xs text-gray-600">
                  Durée moyenne d'exécution d'un scan.
                </div>

                </p>
                <p className="text-2xl font-bold">{tempsMoyenMinutes} min</p>

              </div>
            </div>
            {/* Graphique mensuel */}
            <div className="rounded-xl p-6 bg-slate-800 border border-slate-600 shadow">
              <h3 className="text-xl font-bold text-amber-400 mb-4 text-center">Scans par mois</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compterScansParMois(scans)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="mois" stroke="#cbd5e1" />
                  <YAxis stroke="#cbd5e1" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", borderColor: "#facc15", color: "#fef3c7" }}
                    labelStyle={{ color: "#fcd34d" }}
                  />
                  <Bar dataKey="scans" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>

  )
}
