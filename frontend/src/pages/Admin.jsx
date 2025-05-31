import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from "recharts";
// import { useNavigate } from "react-router-dom";
import { Moon, Sun, Users, FolderOpen, ScanLine, BarChart3, LogOut, Trash2, Shield, Mail, Calendar, Activity, Hourglass, ShieldMinus, Sigma } from "lucide-react";

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

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900 flex items-center justify-center">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-yellow-200 border-t-yellow-600 rounded-full animate-spin"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <Activity className="w-8 h-8 text-yellow-400 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Chargement...</div>
            </div>
        );
    }

    if (!user.is_admin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-slate-900 flex items-center justify-center">
                <div className="bg-red-900/50 backdrop-blur-lg border border-red-500/30 rounded-2xl p-8 text-center">
                    <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <div className="text-red-200 text-xl font-semibold">Accès refusé</div>
                    <div className="text-red-300 mt-2">Vous n'êtes pas administrateur.</div>
                </div>
            </div>
        );
    }

    const StatCard = ({ icon: Icon, title, value, color, delay }) => (
        <div
            className={`bg-gradient-to-br ${color} backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-2xl transform hover:scale-105 transition-all duration-300 hover:shadow-yellow-500/25`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-white/80 text-sm font-medium">{title}</p>
                    <p className="text-white text-3xl font-bold mt-1">{value}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                    <Icon className="w-8 h-8 text-white" />
                </div>
            </div>
        </div>
    );

    const TabButton = ({ id, label, icon: Icon, isActive, onClick }) => (
        <button
            onClick={() => onClick(id)}
            className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${isActive
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg shadow-yellow-500/25'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );

    const DataCard = ({ item, type, onDelete }) => {
        const getStatusColor = (status) => {
            switch (status) {
                case 'active': return 'text-green-400 bg-green-900/30';
                case 'completed': return 'text-orange-400 bg-orange-900/30';
                case 'failed': return 'text-red-400 bg-red-900/30';
                default: return 'text-gray-400 bg-gray-900/30';
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
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:from-slate-700/60 hover:to-slate-600/60 transition-all duration-300 group hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        {type === 'user' && (
                            <>
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-900 rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">
                                            {item.username?.charAt(0)?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold text-lg">{item.username}</p>
                                        {item.is_admin && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                                                <Shield className="w-3 h-3 mr-1" />
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center text-gray-300 text-sm">
                                    <Mail className="w-4 h-4 mr-2" />
                                    {item.email}
                                </div>
                            </>
                        )}

                        {type === 'project' && (
                            <>
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-900 to-amber-500 rounded-full flex items-center justify-center">
                                        <FolderOpen className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-white font-semibold text-lg">{item.name}</p>
                                </div>
                                {item.description && (
                                    <p className="text-gray-400 text-sm italic mb-1">"{item.description}"</p>
                                )}
                                <p className="text-gray-300 text-sm">Créé par : {userCache[item.created_by] || "Chargement..."}</p>
                                <p className="text-gray-400 text-sm">Scans liés : {item.scans?.length || 0}</p>
                                <p className="text-gray-500 text-xs mt-1">Créé le : {new Date(item.created_at).toLocaleDateString()}</p>
                            </>
                        )}


                        {type === 'scan' && (
                            <>
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                                        <ScanLine className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-white font-semibold text-lg">{item.name || "Scan sans nom"}</p>
                                </div>

                                <div className="flex items-center flex-wrap gap-2 text-sm mb-1">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                    {item.type && (
                                        <span className="px-2 py-1 rounded-full bg-yellow-900/30 text-yellow-300 text-xs">
                                            Type : {item.type}
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-100 text-sm"> Lancé par : {userCache[item.launched_by] || "Chargement..."}</p>


                                {item.target && (
                                    <p className="text-gray-300 text-sm">Cible : {item.target}</p>
                                )}

                                {(item.started_at && item.finished_at) && (
                                    <p className="text-gray-400 text-sm">
                                        Durée : {Math.round((new Date(item.finished_at) - new Date(item.started_at)) / 60000)} min
                                    </p>
                                )}

                                {item.report_url && (
                                    <a
                                        href={item.report_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 text-sm underline hover:text-yellow-400"
                                    >
                                        Voir rapport
                                    </a>
                                )}

                                <p className="text-gray-500 text-xs mt-1">
                                    Créé le : {new Date(item.created_at).toLocaleDateString()}
                                </p>
                            </>
                        )}


                        {type === 'statistiques' && (
                            <>
                                <div className="flex items-center space-x-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-900 rounded-full flex items-center justify-center">
                                        <ScanLine className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="text-white font-semibold text-lg">{item.name || "Scan sans nom"}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(type, item._id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-red-500/20 hover:text-red-400 text-gray-400"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-600 to-slate-900">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-grey-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                            Dashboard Admin
                        </h1>
                        <p className="text-gray-400 mt-2">Bienvenue, {user.username}</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* <Button
                            onClick={() => {
                                // navigate("/admin/stats");
                                window.location.href = "/admin/stats";
                            }}
                            className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white border-0 shadow-lg shadow-yellow-500/25"
                        >
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Statistiques
                        </Button> */}

                        <Button
                            onClick={toggleTheme}
                            variant="info"
                            size="icon"
                            className="text-white hover:text-white hover:bg-white/10"
                        >
                            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                        </Button>

                        <Button
                            onClick={handleLogout}
                            variant="ghost"
                            className="text-white hover:text-red-400 hover:bg-red-500/10"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Déconnexion
                        </Button>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl text-yellow-300">
                        {message}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <StatCard
                        icon={Users}
                        title="Utilisateurs"
                        value={stats.totalUsers}
                        color="from-yellow-600/20 to-slate-800/20"
                        delay={0}
                    />
                    <StatCard
                        icon={FolderOpen}
                        title="Projets"
                        value={stats.totalProjects}
                        color="from-yellow-800/20 to-slate-800/20"
                        delay={100}
                    />
                    <StatCard
                        icon={ScanLine}
                        title="Scans"
                        value={stats.totalScans}
                        color="from-amber-400/20 to-slate-800/20"
                        delay={200}
                    />
                    {statsadv && (
                        <><StatCard
                            icon={ShieldMinus}
                            title="Scans terminés"
                            value={statsadv.completedScanCount}
                            color="from-amber-800/20 to-slate-800/20"
                            delay={300} />

                            <StatCard
                            icon={Sigma}
                            title="Durée totale scans"
                            value={statsadv.TotalScansDuration}
                            color="from-amber-800/20 to-slate-800/20"
                            delay={400} />
                            
                            <StatCard
                                icon={Hourglass}
                                title="Durée moyenne scan"
                                value={statsadv?.avgScanDuration || "N/A"}
                                color="from-amber-800/20 to-slate-800/20"
                                delay={300} />
                        </>
                    )}

                </div>

                {/* Navigation Tabs */}
                <div className="flex space-x-2 mb-8 bg-slate-800/30 backdrop-blur-lg p-2 rounded-2xl border border-white/10">
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
                        label="statistiques"
                        icon={BarChart3}
                        isActive={activeTab === "statistiques"}
                        onClick={setActiveTab}
                    />
                </div>

                {/* Content Sections */}
                <div className="space-y-6">
                    {activeTab === "users" && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <Users className="w-6 h-6 mr-3 text-yellow-400" />
                                Utilisateurs ({users.length})
                            </h2>
                            <div className="flex justify-end">
                                <select
                                    className="mb-2 px-3 py-1 rounded-md bg-slate-800 text-white border border-slate-600 text-sm"
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
                                <div className="grid gap-4">
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
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <FolderOpen className="w-6 h-6 mr-3 text-amber-500" />
                                Projets ({projects.length})
                            </h2>
                            <div className="flex justify-end">
                                <select
                                    className="mb-2 px-3 py-1 rounded-md bg-slate-800 text-white border border-slate-600 text-sm"
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
                                <div className="grid gap-4">
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
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <ScanLine className="w-6 h-6 mr-3 text-orange-400" />
                                Scans ({scans.length})
                            </h2>
                            <div className="flex justify-end">
                                <select
                                    className="mb-2 px-3 py-1 rounded-md bg-slate-800 text-grey-700 border border-slate-600 text-sm"
                                    value={scanSort}
                                    onChange={(e) => setScanSort(e.target.value)}
                                >
                                    <option value="date">Trier par date</option>
                                    <option value="name">Trier par nom</option>
                                    <option value="status">Trier par statut</option>
                                </select>
                            </div>
                            {scans.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <ScanLine className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Aucun scan trouvé</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {[...scans]
                                        .sort((a, b) => {
                                            if (scanSort === "name") {
                                                return (a.name || "").localeCompare(b.name || "");
                                            }
                                            if (scanSort === "status") {
                                                return (a.status || "").localeCompare(b.status || "");
                                            }
                                            if (scanSort === "date") {
                                                return new Date(b.created_at) - new Date(a.created_at);
                                            }
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
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white flex items-center">
                                <BarChart3 className="w-6 h-6 mr-3 text-orange-500" />
                                statistiques
                            </h2>
                            <div className="p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-xl shadow-md text-white mt-5">
                                <h3 className="text-xl mb-4">Scans par jour</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart
                                        data={statsadv.scansByDay}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                        barCategoryGap={10}
                                    >
                                        <XAxis
                                            dataKey="date"
                                            stroke="#d1a855"
                                            tick={{ fill: "#eab308", fontSize: 12 }}
                                        />
                                        <YAxis
                                            stroke="#d1a855"
                                            tick={{ fill: "#eab308", fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: 8 }}
                                            itemStyle={{ color: "#facc15" }}
                                            cursor={{ fill: "rgba(255, 186, 8, 0.1)" }}
                                        />
                                        <Bar
                                            dataKey="count"
                                            fill="#f59e0b"
                                            radius={[8, 8, 0, 0]}
                                            barSize={30}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}