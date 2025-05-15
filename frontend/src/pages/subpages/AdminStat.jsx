import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";


export default function AdminStatsDashboard() {
    const [theme, setTheme] = useState("");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
    const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("user_id");

  useEffect(() => {
    setTheme(localStorage.getItem("vite-ui-theme") || "light");
    const fetchStats = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/admin/stats/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur lors du chargement des statistiques.");
        setStats(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    fetchStats();
  }, []);

  if (error) return <div className="text-red-500 p-6">{error}</div>;
  if (!stats) return <div className="p-6">Chargement des statistiques...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
                <div className="flex items-center border-b border-gray-500 pb-4 mb-6">
                <h2 className="text-3xl font-bold mb-6">Statistiques</h2>
                <Button  className="ml-auto bg-slate-300 hover:bg-yellow-800" onClick={() => { navigate("/admin"); }}>
                    Dashboard
                </Button>
        
                <Button  className="ml-auto bg-slate-300 hover:bg-yellow-800" onClick={() => { navigate("/logout"); localStorage.removeItem("token"); localStorage.removeItem("user_id"); }}>
                  Déconnexion
                </Button>

                <Button
                className="ml-4"
              variant="ghost"
              size="icon"
              onClick={() => {
                const newTheme = localStorage.getItem("vite-ui-theme") === "dark" ? "light" : "dark";
                
                localStorage.setItem("vite-ui-theme", newTheme);
                window.dispatchEvent(new Event("storage")); 
                window.location.reload();                           
                 if (newTheme === "dark") {
                    document.documentElement.classList.add("dark");
                  } else {
                    document.documentElement.classList.remove("dark");
                  }                
              }}
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
                </div>
      

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-10">
        <StatCard label="Utilisateurs" value={stats.userCount} />
        <StatCard label="Projets" value={stats.projectCount} />
        <StatCard label="Scans totaux" value={stats.scanCount} />
        <StatCard label="Scans terminés" value={stats.completedScanCount} />
        <StatCard label="Durée moyenne scan" value={stats.avgScanDuration || "N/A"} />
      </div>

      <div className="p-4 bg-gray-800 rounded-xl shadow-md text-white">
        <h3 className="text-xl mb-4">Scans par jour</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.scansByDay}>
            <XAxis dataKey="date" stroke="#ccc" />
            <YAxis allowDecimals={false} stroke="#ccc" />
            <Tooltip />
            <Bar dataKey="count" fill="#facc15" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gradient-to-r from-gray-900  to-yellow-800 text-white p-4 rounded-xl shadow text-center ">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-yellow-500">{value}</p>
    </div>
  );
}
