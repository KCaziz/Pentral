import { AppSidebar } from "@/components/app-sidebar"
import TimeSavedChart from "../components/TimeSavedChart";
import ScanTimeByTypeChart from "../components/ScanTimeByTypeChart";
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
  const [nbScansUser, setNbScansUser] = useState(0);
  const [nbScansNoUser, setNbScansNoUser] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [tempsParType, setTempsParType] = useState([]);

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
      setTotalTimeSpent(stats.totalTimeSpent);
      setChart(compterScansParJour(scans));
      const type = compterScansParType(scans);
      setNbScansUser(type.nbScansUser);
      setNbScansNoUser(type.nbScansNoUser);
      setTempsParType(compterTempsParType(scans));


    }
  }, [scans]);
  
function estimateTimeSaved(scans) {
  const finishedScans = scans.filter(
    scan => scan.started_at && scan.finished_at && scan.status === "completed"
  );

  if (finishedScans.length === 0) {
    return {
      averageSpeed: 0,
      totalSavedMinutes: 0,
      scansCount: 0,
      totalTimeSpent: 0
    };
  }

  const averageHumanPentestTime = 120; // minutes
  let totalTimeSpent = 0;

  for (const scan of finishedScans) {
    const start = new Date(scan.started_at);
    const end = new Date(scan.finished_at);
    console.log(end, start);
    

    const durationSeconds = Math.abs(new Date(scan.finished_at) - new Date(scan.started_at)) / 1000 /60;

    console.log(durationSeconds);
    

    if (!isNaN(durationSeconds) && durationSeconds > 0) {
      totalTimeSpent += durationSeconds;
    }
  }

  const validScanCount = finishedScans.length;
  const averageTimeSpent = totalTimeSpent / validScanCount;
  const totalHumanTime = validScanCount * averageHumanPentestTime;
  const totalSavedMinutes = totalHumanTime - totalTimeSpent;

  return {
    averageSpeed: Math.round(averageTimeSpent),
    totalSavedMinutes: Math.max(0, Math.round(totalSavedMinutes)),
    scansCount: validScanCount,
    totalTimeSpent: Math.round(totalTimeSpent)
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

  // Compter les scans par statut
  const compterScansParStatut = (scans) => {
    const counts = { waiting: 0, running: 0, completed: 0, error: 0 };
    scans.forEach(scan => {
      counts[scan.status] = (counts[scan.status] || 0) + 1;
    });
    return Object.keys(counts).map(statut => ({
      statut: statut.charAt(0).toUpperCase() + statut.slice(1),
      nombre: counts[statut]
    }));
  };

  // Compter les scans par type
  const compterScansParType = (scans) => {
    let nbScansUser = 0;
    let nbScansNoUser = 0;

    scans.forEach(scan => {
      if (scan.type === 'user') {
        nbScansUser++;
      } else if (scan.type === 'no_user') {
        nbScansNoUser++;
      }
    });
    return {
      nbScansUser,
      nbScansNoUser
    };
  };

  const compterTempsParType = (scans) => {
    // Initialisation avec tous les types possibles
    const tempsParType = {
      user: 0,
      quick: 0,
      reason: 0,
      no_user: 0,
    };

    scans
      .filter(scan => scan.type && scan.started_at && scan.finished_at)
      .forEach(scan => {
        try {
          const start = new Date(scan.started_at);
          const end = new Date(scan.finished_at);
          const diffMinutes = (start - end) / (1000 * 60);
          // Vérification plus robuste
          if (!isNaN(diffMinutes) && diffMinutes > 0 && diffMinutes < 600) {
            // Vérifie que le type existe dans l'objet, sinon utilise 'other'
            const typeKey = tempsParType.hasOwnProperty(scan.type) ? scan.type : 'other';
            tempsParType[typeKey] += diffMinutes;

          }
        } catch (e) {
          console.error("Erreur de traitement pour le scan:", scan.id, e);
        }
      });

    // Conversion et formatage
    return Object.entries(tempsParType)
      .map(([type, minutes]) => ({
        type: type.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        temps: parseFloat((minutes / 60).toFixed(2)) // Heures avec 2 décimales
      }))
      .filter(item => item.temps > 0); // Filtre les types sans temps
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 items-center px-6 border-b border-border">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-4 h-6 bg-primary" />
            <h2 className="text-xl font-extrabold text-primary italic">Dashboard Utilisateur</h2>
          </header>


          <div className="flex flex-col gap-12 p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <a href="gestionproject">
                <div className="rounded-xl bg-gradient-to-r from-pink-500/70 to-rose-600/70 p-6 border border-rose-500/20 shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform duration-200" title="Nombre total de projets que vous avez créés.">
                  <p className="text-base text-gray-200 font-semibold">Projets</p>
                  <p className="text-5xl font-extrabold text-white">{nbProjects || 0}</p>
                </div>
              </a>
              <a href="/historique">
                <div className="rounded-xl bg-gradient-to-r from-pink-600/70 to-rose-500/70 p-6 border border-rose-500/20 shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform duration-200" title="Total de scans que vous avez exécutés.">
                  <p className="text-base text-gray-200 font-semibold">Scans</p>
                  <p className="text-5xl font-extrabold text-white">{nbScans || 0}</p>
                </div>
              </a>
              {/* <div className="group relative rounded-xl bg-gradient-to-r from-rose-500/70 to-red-500/70 p-6 border border-rose-500/20 shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform duration-200">
                <p className="flex items-center text-base text-gray-200 font-semibold">
                  Temps gagné
                  <InformationCircleIcon className="h-4 w-4 ml-1 text-white cursor-help" />
                  <div className="absolute hidden group-hover:block w-64 p-2 left-8 top-14 bg-slate-900/90 border border-rose-400/30 rounded-lg shadow-lg text-xs text-gray-200 z-10 transition-opacity duration-150">
                    Temps total gagné par rapport à un pentest manuel estimé à 2h par scan.
                  </div>
                </p>
                <p className="text-4xl font-extrabold text-white">{(tempsGagneEstimeMinutes / 60).toFixed(1)} h</p>
              </div> */}
              <div className="group relative rounded-xl bg-gradient-to-r from-rose-500/70 to-red-500/70 p-6 border border-rose-500/20 shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform duration-200">
                <p className="flex items-center text-base text-gray-200 font-semibold">
                  Durée totale scans
                  <InformationCircleIcon className="h-4 w-4 ml-1 text-white cursor-help" />
                  <div className="absolute hidden group-hover:block w-64 p-2 left-8 top-14 bg-slate-900/90 border border-rose-400/30 rounded-lg shadow-lg text-xs text-gray-200 z-10 transition-opacity duration-150">
                    Temps total passé sur les scans, y compris les scans sans utilisateur.
                  </div>
                </p>
                <p className="text-4xl font-extrabold text-white">{(totalTimeSpent / 60).toFixed(1)} h</p>
              </div>
              <div className="group relative rounded-xl bg-gradient-to-r from-red-600/70 to-orange-900/70 p-6 border border-rose-500/20 shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform duration-200">
                <p className="flex items-center text-base text-gray-200 font-semibold">
                  Durée moyenne d'un scan
                  <InformationCircleIcon className="h-4 w-4 ml-1 text-white cursor-help" />
                  <div className="absolute hidden group-hover:block w-64 p-2 left-8 top-14 bg-slate-900/90 border border-rose-400/30 rounded-lg shadow-lg text-xs text-gray-200 z-10 transition-opacity duration-150">
                    Durée moyenne d'exécution d’un scan, basé sur les scans terminés.
                  </div>
                </p>
                <p className="text-4xl font-extrabold text-white">{tempsMoyenMinutes} min</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-8 rounded-xl bg-slate-900/60 border border-white/10 shadow-md hover:bg-slate-900/70 transition-background duration-200">
                <h3 className="text-2xl font-semibold text-rose-400 mb-4 text-center">Scans par mois</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compterScansParMois(scans)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="mois"
                      stroke="hsl(var(--foreground))"
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                        border: "none",
                        borderRadius: 8
                      }}
                    />
                    <Bar
                      dataKey="scans"
                      fill="hsl(var(--thirdary))"
                      radius={[6, 6, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="p-8 rounded-xl bg-slate-900/60 border border-white/10 shadow-md hover:bg-slate-900/70 transition-background duration-200">
                <h3 className="text-2xl font-semibold text-rose-400 mb-4 text-center">Scans par statut</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compterScansParStatut(scans)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="statut" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                        border: "none",
                        borderRadius: 8
                      }}
                    />
                    <Bar
                      dataKey="nombre"
                      fill="hsl(var(--thirdary))"
                      radius={[6, 6, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <TimeSavedChart
                tempsMoyenMinutes={nbScansNoUser}
                nbscans_effectues={nbScansUser}
              />
              <ScanTimeByTypeChart scans={scans} />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
