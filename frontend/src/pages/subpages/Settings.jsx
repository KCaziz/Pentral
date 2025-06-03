import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { UserCircleIcon, IdentificationIcon, EnvelopeIcon, KeyIcon, TrashIcon } from "@heroicons/react/24/outline";

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

export default function UserSettings() {
    const [user, setUser] = useState({ username: "", email: "" });
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const userId = localStorage.getItem("user_id");

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/users/${userId}`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Erreur serveur");
                setUser(data);
            } catch (err) {
                setMessage("Erreur lors du chargement.");
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [userId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUser((prevUser) => ({ ...prevUser, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const res = await fetch(`http://localhost:5000/api/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(user),
            });

            const data = await res.json();
            if (res.ok) {
                setMessage("Profil mis à jour avec succès ✅");
            } else {
                setMessage(data.error || "Erreur lors de la mise à jour.");
            }
        } catch (err) {
            setMessage("Erreur réseau.");
        }
    };

    function handleDeleteAccount() {
        const userId = localStorage.getItem("user_id");

        const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.");

        if (!confirmDelete) return;

        fetch(`http://localhost:5000/api/users/${userId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    alert("Compte supprimé avec succès.");
                    localStorage.removeItem("token");
                    localStorage.removeItem("user_id");
                    navigate("/login");
                } else {
                    alert(data.error || "Erreur lors de la suppression.");
                }
            })
            .catch((err) => {
                console.error("Erreur réseau :", err);
                alert("Une erreur est survenue.");
            });
    }


    if (loading) {
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
 <div className="relative overflow-hidden">
  {/* Arrière-plan avec nuages positionnés de manière plus harmonieuse */}
  <div className="absolute inset-0 -z-10">
    <img src={cloudSvg} alt="cloud" className="absolute top-20 left-10 size-32 opacity-40" />
    <img src={cloudSvg} alt="cloud" className="absolute top-1/4 right-20 size-40 opacity-30" />
    <img src={cloudSvg} alt="cloud" className="absolute bottom-1/3 left-1/4 size-36 opacity-25" />
    <img src={cloudSvg} alt="cloud" className="absolute bottom-20 right-10 size-28 opacity-35" />
  </div>

  {/* Header simplifié */}
  <header className="flex h-16 items-center px-6  backdrop-blur-sm border-b border-amber-100">
    <div className="flex items-center gap-3">
      <SidebarTrigger className=" hover:text-amber-800 transition-colors" />
      <Separator orientation="vertical" className="h-6 bg-amber-200" />
      <h2 className="text-xl font-extrabold text-amber-400 italic">Paramétres</h2>
    </div>
  </header>

  {/* Contenu principal */}
  <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
    <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg overflow-hidden border border-amber-100">
      {/* En-tête de carte */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 border-b border-amber-200">
        <div className="flex items-center justify-center space-x-3">
          <UserCircleIcon className="h-8 w-8 text-amber-600" />
          <h2 className="text-2xl font-bold text-gray-800">Profil Utilisateur</h2>
        </div>
        {message && (
          <div className="mt-3 p-2 bg-amber-100 text-amber-800 rounded text-center text-sm">
            {message}
          </div>
        )}
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="space-y-4">
          {/* Champ Nom d'utilisateur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <IdentificationIcon className="h-4 w-4 text-amber-500 mr-2" />
              Nom d'utilisateur
            </label>
            <div className="relative">
              <input
                type="text"
                name="username"
                value={user.username}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                required
              />
            </div>
          </div>

          {/* Champ Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <EnvelopeIcon className="h-4 w-4 text-amber-500 mr-2" />
              Adresse Email
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={user.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="justify-center items-center text-center">
          <button
            type="submit"
            className="justify-center px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
          >
            Enregistrer les modifications
          </button>
        </div>

        <div className="space-y-3 justify-center items-center text-center mt-4">
            <Link
              to="/password"
              className="inline-flex items-center text-sm text-amber-600 hover:text-amber-800 hover:underline mx-3"
            >
              <KeyIcon className="h-4 w-4 mx-1" />
              Modifier le mot de passe
            </Link>
            
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="inline-flex items-center text-sm text-red-600 hover:text-red-800 hover:underline"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Supprimer le compte
            </button>
          </div>
      </form>
    </div>
  </main>
</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
