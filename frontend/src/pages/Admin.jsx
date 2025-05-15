import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import BackgroundClouds from "../components/BackgroundClouds";
import { Moon, Sun } from "lucide-react";

export default function AdminDashboard() {
    const [theme, setTheme] = useState("");
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [scans, setScans] = useState([]);
    const [message, setMessage] = useState("");

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("user_id");


    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

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

    const fetchAll = async () => {
        try {
            const [usersRes, projectsRes, scansRes] = await Promise.all([
                fetch(`http://localhost:5000/api/admin/users/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`http://localhost:5000/api/admin/projects/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`http://localhost:5000/api/admin/scans/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const scansData = await scansRes.json();

            setUsers(usersData || []);
            setProjects(projectsData || []);
            setScans(scansData || []);
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

    if (!user) {
        return <div>Chargement...</div>;
    }

    if (!user.is_admin) { return <div className="text-red-500">Accès refusé. Vous n'êtes pas administrateur.</div>; }


    return (
        <div>

            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex items-center border-b border-gray-500 pb-6 mb-6">
                    <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
                    <Button className="ml-auto bg-slate-300 hover:bg-yellow-800" onClick={() => { navigate("/admin/stats"); }}>
                        Statistiques
                    </Button>

                    <Button className="ml-auto bg-slate-300 hover:bg-yellow-800" onClick={() => { navigate("/logout"); localStorage.removeItem("token"); localStorage.removeItem("user_id"); }}>
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
                {message && <p className="text-yellow-500 mb-4">{message}</p>}

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Utilisateurs</h2>
                    <div className="space-y-2">
                        {users.map((u) => (
                            <div key={u._id} className="flex justify-between items-center bg-slate-800 p-3 rounded text-white">
                                <div>
                                    <p className="font-semibold">{u.username}</p>
                                    <p className="text-sm text-gray-300">{u.email}</p>
                                    {u.is_admin && <span className="text-primary font-bold">Admin</span>}
                                </div>
                                <Button variant="destructive" onClick={() => handleDelete("user", u._id)}>
                                    Supprimer
                                </Button>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Projets</h2>
                    <div className="space-y-2">
                        {projects.map((p) => (
                            <div key={p._id} className="flex justify-between items-center bg-slate-800 p-3 rounded text-white">
                                <div>
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-gray-300">Créé par {p.created_by}</p>
                                </div>
                                <Button variant="destructive" onClick={() => handleDelete("project", p._id)}>
                                    Supprimer
                                </Button>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Scans</h2>
                    <div className="space-y-2">
                        {scans.map((s) => (
                            <div key={s._id} className="flex justify-between items-center bg-slate-800 p-3 rounded text-white">
                                <div>
                                    <p className="font-semibold">{s.name || "Scan sans nom"}</p>
                                    <p className="text-sm text-gray-300">Status : {s.status}</p>
                                </div>
                                <Button variant="destructive" onClick={() => handleDelete("scan", s._id)}>
                                    Supprimer
                                </Button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
