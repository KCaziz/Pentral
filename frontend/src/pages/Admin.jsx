import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from "recharts";
// import { useNavigate } from "react-router-dom";
import { ChevronDown, Moon, Sun, Users, FolderOpen, ScanLine, BarChart3, LogOut, Trash2, Shield, Mail, Calendar, Activity, Hourglass, ShieldMinus, Sigma, HelpCircle } from "lucide-react";

export default function AdminDashboard() {
    const [theme, setTheme] = useState("");
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [scans, setScans] = useState([]);
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState("users");
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalProjects: 0,
        totalScans: 0,
        activeScans: 0
    });
    const [statsadv, setStatsadv] = useState({});
    const [scanSort, setScanSort] = useState("date");
    const [userSort, setUserSort] = useState("username");
    const [projectSort, setProjectSort] = useState("date");
    const [userCache, setUserCache] = useState({});
    const [totalTimeSpent, setTotalTimeSpent] = useState(0);
    const [tempsMoyenMinutes, setTempsMoyenMinutes] = useState(0);
    const [tempsGagneEstimeMinutes, setTempsGagneEstimeMinutes] = useState(0);

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("user_id");

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // const navigate = useNavigate();

    useEffect(() => {
        const userId = localStorage.getItem('user_id');
        setTheme(localStorage.getItem("vite-ui-theme") || "light");


        const fetchUser = async () => {
            try {
                // if (localStorage.getItem("vite-ui-theme") === "light") {
                //     document.documentElement.classList.add("dark");
                //     localStorage.setItem("vite-ui-theme", "dark")
                //     window.location.reload();
                // }
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

    }, [])

    useEffect(() => {
        fetchAll();
    }, []);

    const resolveUserName = async (userId) => {
        if (userCache[userId]) return userCache[userId]; // Retourne directement s’il est déjà en cache

        try {
            const res = await fetch(`http://localhost:5000/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            const username = data.username || data.email || userId;
            setUserCache(prev => ({ ...prev, [userId]: username }));
            return username;
        } catch (err) {
            console.error("Erreur résolution user :", err);
            return "Inconnu";
        }
    };


    const fetchAll = async () => {
        try {
            const [usersRes, projectsRes, scansRes, adv] = await Promise.all([
                fetch(`http://localhost:5000/api/admin/users/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`http://localhost:5000/api/admin/projects/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`http://localhost:5000/api/admin/scans/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`http://localhost:5000/api/admin/stats/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const scansData = await scansRes.json();
            const advsData = await adv.json();

            console.log("Utilisateurs chargés :", advsData);


            setUsers(usersData || []);
            setProjects(projectsData || []);
            setScans(scansData || []);
            setStatsadv(advsData || {});

            // Calculate stats
            setStats({
                totalUsers: usersData?.length || 0,
                totalProjects: projectsData?.length || 0,
                totalScans: scansData?.length || 0,
                activeScans: scansData?.filter(s => s.status === 'active')?.length || 0
            });
        } catch (err) {
            console.error(err);
            setMessage("Erreur de chargement.");
        }
    };

    useEffect(() => {
        if (scans.length > 0) {
            const stats = estimateTimeSaved(scans);
            setTempsMoyenMinutes(stats.averageSpeed);
            setTempsGagneEstimeMinutes(stats.totalSavedMinutes);
            setTotalTimeSpent(stats.totalTimeSpent);
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


            const durationSeconds = Math.abs(new Date(scan.finished_at) - new Date(scan.started_at)) / 1000 / 60;

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


    function compterScansParMois(scans) {
        const counts = {};


        scans.forEach(scan => {
            if (scan.created_at && scan.finished_at) { // Ignore les scans non finie
                const date = new Date(scan.created_at);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                counts[monthKey] = (counts[monthKey] || 0) + 1;
            }
        });

        return Object.keys(counts).map(key => ({ mois: key, scans: counts[key] }));
    }
    const compterScansParStatut = (scans) => {
        const statuts = scans.reduce((acc, scan) => {
            acc[scan.status] = (acc[scan.status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statuts).map(([statut, nombre]) => ({ statut, nombre }));
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm("Supprimer cet élément ?")) return;

        let url = "";
        switch (type) {
            case "user":
                url = `http://localhost:5000/api/users/${id}`;
                break;
            case "project":
                url = `http://localhost:5000/api/projects/${id}`;
                break;
            case "scan":
                url = `http://localhost:5000/api/scans/${id}`;
                break;
        }

        try {
            const res = await fetch(url, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                fetchAll();
            } else {
                setMessage(data.error || "Erreur");
            }
        } catch (err) {
            console.error(err);
            setMessage("Erreur réseau.");
        }
    };

    const toggleTheme = () => {
        const newTheme = localStorage.getItem("vite-ui-theme") === "dark" ? "light" : "dark";
        localStorage.setItem("vite-ui-theme", newTheme);
        window.dispatchEvent(new Event("storage"));
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        setTheme(newTheme);
    };

    const handleLogout = () => {
        // navigate("/logout");
        localStorage.removeItem("token");
        localStorage.removeItem("user_id");
        // Simulate navigation
        window.location.href = "/logout";
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <Activity className="w-8 h-8 text-red-400 " />
                    </div>
                </div>
            </div>
        );
    }


    if (!user.is_admin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-slate-900 flex items-center justify-center">
                <div className="bg-red-900/50  border border-red-500/30 rounded-2xl p-8 text-center">
                    <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <div className="text-red-200 text-xl font-semibold">Accès refusé</div>
                    <div className="text-red-300 mt-2">Vous n'êtes pas administrateur.</div>
                </div>
            </div>
        );
    }

    const StatCard = ({ icon: Icon, title, value, color, delay, onClick, tooltip }) => (
        <div
            className={`relative bg-gradient-to-br ${color}  border border-white/20 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 hover:shadow-rose-500/20 ${onClick ? 'cursor-pointer' : ''}`}
            style={{ animationDelay: `${delay}ms` }}
            onClick={onClick}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-white/90 text-sm font-medium">{title}</p>
                    <p className="text-white text-3xl font-bold mt-1">{value}</p>
                </div>
                <div className="bg-white/30 backdrop-blur-sm rounded-full p-3">
                    <Icon className="w-8 h-8 text-white" />
                </div>
            </div>
            {tooltip && (
                <div className="absolute top-2 right-2 group">
                    <HelpCircle className="w-4 h-4 text-white/60 hover:text-white" />
                    <div className="absolute hidden group-hover:block w-48 p-2 bg-slate-800/90 text-white text-xs rounded-md shadow-lg -right-2 top-6 z-10">
                        {tooltip}
                    </div>
                </div>
            )}
        </div>
    );


    const TabButton = ({ id, label, icon: Icon, isActive, onClick }) => (
        <button
            onClick={() => onClick(id)}
            className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${isActive
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );

    const DataCard = ({ item, type, onDelete }) => {
        const [showDetails, setShowDetails] = useState(false);

        const getStatusColor = (status) => {
            switch (status) {
                case 'active':
                case 'running': return 'text-amber-400 bg-amber-900/20';
                case 'completed': return 'text-green-400 bg-green-900/20';
                case 'error': return 'text-red-400 bg-red-900/20';
                case 'waiting': return 'text-blue-400 bg-blue-900/20';
                // case 'cancelled': return 'text-gray-400 bg-gray-900/20';
                default: return 'text-gray-400 bg-gray-900/20';
            }
        };

        useEffect(() => {
            if (type === "project" && item.created_by) {
                resolveUserName(item.created_by);
            }
            if (type === "scan" && item.launched_by) {
                resolveUserName(item.launched_by);
            }
        }, [item]);



        return (
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40  border border-white/20 rounded-xl p-6 hover:from-slate-700/50 hover:to-slate-800/50 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg hover:shadow-rose-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        {type === 'user' && (
                            <>
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center">
                                        <span className="text-white font-semibold">{item.username?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold text-lg">{item.username}</p>
                                        {item.is_admin && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-red-rose-500 to-red-600 text-white">
                                                <Shield className="w-3 h-3" />
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center text-gray-300 text-sm gap-2">
                                    <Mail className="w-4 h-4" />
                                    <span>{item.email}</span>
                                </div>
                            </>
                        )}

                        {type === 'project' && (
                            <>
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-400 rounded-xl flex items-center justify-center">
                                        <FolderOpen className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-white font-semibold text-lg">{item.name}</p>
                                </div>
                                {item.description && (
                                    <p className="text-gray-300 text-sm italic mb-2">"{item.description}"</p>
                                )}
                                <p className="text-gray-300 text-sm">Créé par : {userCache[item.created_by] || "Chargement..."}</p>
                                <p className="text-gray-300 text-sm">Scans associés : {item.scans?.length || 0}</p>
                                <p className="text-gray-300 text-sm">Entreprise : {item.company || "Personnel"}</p>
                                <p className="text-gray-400 text-sm mt-2">le : {new Date(item.created_at).toLocaleDateString()}</p>
                            </>
                        )}


                        {type === 'scan' && (
                            <>
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-red-600 rounded-xl flex items-center justify-center">
                                        <ScanLine className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-white font-semibold text-lg">{item.name || "Scan sans nom"}</p>
                                </div>

                                <div className="flex items-center flex-wrap gap-2 text-sm mb-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                    {item.type && (
                                        <span className="px-2 py-1 rounded-full bg-rose-600/10 text-rose-400 text-xs">
                                            Type : {item.type}
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-300 text-sm"> Lancé par : {userCache[item.launched_by] || "Chargement..."}</p>

                                {item.target && (
                                    <p className="text-gray-300 text-sm">Cible : {item.target}</p>
                                )}

                                {(item.started_at && item.finished_at) && (
                                    <p className="text-gray-300 text-sm">
                                        Durée : {Math.round((new Date(item.finished_at) - new Date(item.started_at)) / 60000)} min
                                    </p>
                                )}

                                {item.report_url && (
                                    <a
                                        href={`http://127.0.0.1:5000${item.report_url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-rose-400 text-sm font-medium hover:text-rose-300 hover:underline"
                                    >
                                        Voir Rapport
                                    </a>
                                )}

                                <p className="text-gray-400 text-sm mt-2">
                                    Créé le : {new Date(item.created_at).toLocaleDateString()}
                                </p>
                                <button
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="mt-2 text-rose-400 text-sm font-medium hover:text-rose-300 hover:underline flex items-center gap-1"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                                    Détails
                                </button>
                                {showDetails && (
                                    <div className="mt-3 text-gray-300 text-sm space-y-2">
                                        <p><span className="font-semibold">Type :</span> {item.type || "Inconnu"}</p>
                                        <p><span className="font-semibold">Itérations :</span> {item.iterations || 3}</p>
                                        <p><span className="font-semibold  p-1">Commandes exécutées :</span> {item.commands_executed?.length ? item.commands_executed.map(c => c.command).join(", ") : "Aucune commande"}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(type, item._id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-rose-600/20 hover:text-red-400 text-gray-300"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    };


    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-gray-900">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-rose-500/10 rounded-full blur-5xl "></div>
                <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-red-500/10 rounded-full blur-5xl " style={{ animationDelay: '1.5s' }}></div>
            </div>

            <div className="relative z-10 p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-rose-400 to-red-500 bg-clip-text text-transparent">
                            Dashboard Admin
                        </h1>
                        <p className="text-gray-400 mt-3">Bienvenue, {user.username}</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* <Button
                            onClick={toggleTheme}
                            variant="outline"
                            size="icon"
                            className="text-gray-300 border-gray-300/20 hover:bg-rose-500/10 hover:text-white"
                        >
                            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                        </Button> */}

                        <Button
                            onClick={handleLogout}
                            variant="outline"
                            className="text-gray-300 bg-slate-800 border-gray-300/20 hover:bg-rose-500/20 hover:text-red-400"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            <span>Déconnexion</span>
                        </Button>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-gray-300">
                        {message}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    <StatCard
                        icon={Users}
                        title="Total utilisateurs"
                        value={stats.totalUsers}
                        color="from-rose-500/20 to-slate-900/20"
                        delay={0}
                        onClick={() => { setActiveTab('users'); setUserSort('username'); window.scrollTo(0, 400); }}
                        tooltip="Nombre total d’utilisateur inscrits sur la plateforme."
                    />
                    <StatCard
                        icon={FolderOpen}
                        title="Projets"
                        value={stats.totalProjects}
                        color="from-rose-600/20 to-slate-900/20"
                        delay={100}
                        onClick={() => { setActiveTab('projects'); setProjectSort('date'); window.scrollTo(0, 400); }}
                        tooltip={"Nombre total de projets créés."}
                    />
                    <StatCard
                        icon={ScanLine}
                        title="Scans"
                        value={stats.totalScans}
                        color="from-rose-400/20 to-slate-900/20"
                        delay={200}
                        onClick={() => { setActiveTab('scans'); setScanSort('name'); window.scrollTo(0, 400); }}
                        tooltip="Nombre total de scans effectués."
                    />
                    {statsadv && (
                        <>
                            <StatCard
                                icon={ShieldMinus}
                                title="Scans terminés"
                                value={statsadv.completedScanCount}
                                color="from-rose-700/20 to-slate-900/20"
                                delay={300}
                                onClick={() => { setActiveTab('scans'); setScanSort('completed'); window.scrollTo(0, 400); }}
                                tooltip="Nombre de scans ayant atteint le statut 'terminé'."
                            />
                            <StatCard
                                icon={Sigma}
                                title="Durée totale scans"
                                value={statsadv.totalScansDuration}
                                color="from-rose-800/20 to-slate-900/20"
                                delay={400}
                                tooltip="Somme des durées de tous les scans terminés."
                            />
                            <StatCard
                                icon={Hourglass}
                                title="Durée moyenne scan"
                                value={statsadv?.avgScanDuration || "N/A"}
                                color="from-rose-900/20 to-slate-900/20"
                                delay={500}
                                tooltip="Durée moyenne d’un scan basé sur les scans terminés."
                            />
                        </>
                    )}
                </div>

                {/* Navigation Tabs */}
                <div className="flex flex-wrap gap-2 mb-8 bg-slate-800/20  p-3 rounded-2xl border border-white/20">
                    <TabButton
                        id="users"
                        label="Utilisateurs"
                        icon={Users}
                        isActive={activeTab === "users"}
                        onClick={setActiveTab}
                    />
                    <TabButton
                        id="projects"
                        label="Projets"
                        icon={FolderOpen}
                        isActive={activeTab === "projects"}
                        onClick={setActiveTab}
                    />
                    <TabButton
                        id="scans"
                        label="Scans"
                        icon={ScanLine}
                        isActive={activeTab === "scans"}
                        onClick={setActiveTab}
                    />
                    <TabButton
                        id="statistiques"
                        label="Statistiques"
                        icon={BarChart3}
                        isActive={activeTab === "statistiques"}
                        onClick={setActiveTab}
                    />
                </div>

                {/* Content Sections */}
                <div className="space-y-8">
                    {activeTab === "users" && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <Users className="w-6 h-6 mr-3 text-rose-400" />
                                Utilisateurs ({users.length})
                            </h2>
                            <div className="flex justify-end">
                                <select
                                    className="px-4 py-2 rounded-lg bg-slate-800/50 text-gray-300 border border-slate-700/50 text-sm focus:ring-rose-500 focus:border-rose-500"
                                    value={userSort}
                                    onChange={(e) => setUserSort(e.target.value)}
                                >
                                    <option value="username">Trier par nom</option>
                                    <option value="email">Trier par email</option>
                                </select>
                            </div>

                            {users.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Aucun utilisateur trouvé</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[...users]
                                        .sort((a, b) => {
                                            if (userSort === "username") {
                                                return (a.username || "").localeCompare(b.username || "");
                                            }
                                            if (userSort === "email") {
                                                return (a.email || "").localeCompare(b.email || "");
                                            }
                                            return 0;
                                        })
                                        .map((u) => (
                                            <DataCard key={u._id} item={u} type="user" onDelete={handleDelete} />
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "projects" && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <FolderOpen className="w-6 h-6 mr-3 text-rose-400" />
                                Projets ({projects.length})
                            </h2>
                            <div className="flex justify-end">
                                <select
                                    className="px-4 py-2 rounded-lg bg-slate-800/50 text-gray-300 border border-slate-700/50 text-sm focus:ring-rose-500 focus:border-rose-500"
                                    value={projectSort}
                                    onChange={(e) => setProjectSort(e.target.value)}
                                >
                                    <option value="name">Trier par nom</option>
                                    <option value="date">Trier par date</option>
                                </select>
                            </div>

                            {projects.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Aucun projet trouvé</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[...projects]
                                        .sort((a, b) => {
                                            if (projectSort === "name") {
                                                return (a.name || "").localeCompare(b.name || "");
                                            }
                                            if (projectSort === "date") {
                                                return new Date(b.created_at) - new Date(a.created_at);
                                            }
                                            return 0;
                                        })
                                        .map((p) => (
                                            <DataCard key={p._id} item={p} type="project" onDelete={handleDelete} />
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "scans" && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <ScanLine className="w-6 h-6 mr-3 text-rose-400" />
                                Scans ({scans.length})
                            </h2>
                            <div className="flex justify-end gap-4">
                                <select
                                    className="px-4 py-2 rounded-lg bg-slate-800/50 text-gray-300 border border-slate-700/50 text-sm focus:ring-rose-500 focus:border-rose-500"
                                    value={scanSort}
                                    onChange={(e) => setScanSort(e.target.value)}
                                >
                                    <option value="date">Trier par date</option>
                                    <option value="name">Trier par nom</option>
                                    <option value="running">Trier par en cours</option>
                                    <option value="waiting">Trier par en attente</option>
                                    <option value="completed">Trier par terminé</option>
                                    <option value="error">Trier par échoué</option>
                                </select>
                            </div>
                            {scans.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <ScanLine className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Aucun scan trouvé</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[...scans]
                                        .sort((a, b) => {
                                            if (scanSort === "name") {
                                                return (a.name || "").localeCompare(b.name || "");
                                            }
                                            // if (scanSort === "status") {
                                            //     return (a.status || "").localeCompare(b.status || "");
                                            // }
                                            if (scanSort === "date") {
                                                return new Date(b.created_at) - new Date(a.created_at);
                                            }
                                            if (scanSort === "running") {
                                                return a.status === "running" ? -1 : 1;
                                            }
                                            if (scanSort === "waiting") {
                                                return a.status === "waiting" ? -1 : 1;
                                            }
                                            if (scanSort === "completed") {
                                                return a.status === "completed" ? -1 : 1;
                                            }
                                            if (scanSort === "error") {
                                                return a.status === "error" ? -1 : 1;
                                            }
                                            // if (scanSort === "cancelled") {
                                            //     return a.status === "cancelled" ? -1 : 1;
                                            // }
                                            return 0;
                                        })
                                        .map((s) => (
                                            <DataCard key={s._id} item={s} type="scan" onDelete={handleDelete} />
                                        ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "statistiques" && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <BarChart3 className="w-6 h-6 mr-3 text-rose-400" />
                                Statistiques
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-800/30  rounded-2xl shadow-lg border border-white/20">
                                    <h3 className="text-xl font-semibold text-white mb-4">Scans par mois</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart
                                            data={compterScansParMois(scans)}
                                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                            barCategoryGap={10}
                                        >
                                            <XAxis
                                                dataKey="mois"
                                                stroke="#ffffff"
                                                tick={{ fill: "#ffffff", fontSize: 12 }}
                                            />
                                            <YAxis
                                                stroke="#ffffff"
                                                tick={{ fill: "#ffffff", fontSize: 12 }}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: 8 }}
                                                itemStyle={{ color: "#ffffff" }}
                                                cursor={{ fill: "rgba(255, 255, 255, 0.1)" }}
                                            />
                                            <Bar
                                                dataKey="scans"
                                                fill="#f43f5e"
                                                radius={[8, 8, 0, 0]}
                                                barSize={30}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="p-6 bg-slate-800/30  rounded-2xl shadow-lg border border-white/20">
                                    <h3 className="text-xl font-semibold text-white mb-4">Répartition des statuts des scans</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart
                                            data={compterScansParStatut(scans)}
                                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                            barCategoryGap={10}
                                        >
                                            <XAxis
                                                dataKey="statut"
                                                stroke="#ffffff"
                                                tick={{ fill: "#ffffff", fontSize: 12 }}
                                            />
                                            <YAxis
                                                stroke="#ffffff"
                                                tick={{ fill: "#ffffff", fontSize: 12 }}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: 8 }}
                                                itemStyle={{ color: "#ffffff" }}
                                                cursor={{ fill: "rgba(255, 255, 255, 0.1)" }}
                                            />
                                            <Bar
                                                dataKey="nombre"
                                                fill="#f43f5e"
                                                radius={[8, 8, 0, 0]}
                                                barSize={30}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}