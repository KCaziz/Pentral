import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LockClosedIcon, KeyIcon, LockOpenIcon, ShieldCheckIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar"

import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"

export default function Password() {
    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        newPasswordConfirm: "",
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [user, setUser] = useState("");
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
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        if (formData.newPassword !== formData.newPasswordConfirm) {
            setErrorMessage("Les mots de passe ne correspondent pas.");
            return;
        }

        try {
            const res = await fetch(`http://localhost:5000/api/users/${userId}/password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    old_password: formData.currentPassword,
                    new_password: formData.newPassword,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMessage("Mot de passe mis à jour avec succès ✅");
                setFormData({ currentPassword: "", newPassword: "", newPasswordConfirm: "" });
                setTimeout(() => navigate("/logout")); // redirige après succès
            } else {
                setErrorMessage(data.error || "Erreur lors de la mise à jour.");
            }
        } catch (err) {
            setErrorMessage("Erreur réseau.");
        }
    };
    if (!user) {
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
                {/* Header simplifié et élégant */}
                <header className="flex h-16 items-center px-6 border-b border-amber-200">
                    <div className="flex items-center gap-3">
                        <SidebarTrigger className="hover:text-amber-500 transition-colors" />
                        <Separator orientation="vertical" className="h-6 bg-amber-200" />
                        <h1 className="text-xl font-extrabold text-amber-400 italic">Mot de passe</h1>
                    </div>
                </header>

                {/* Contenu principal */}
                <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
                    <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* En-tête de carte */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 border-b border-amber-100">
                            <div className="flex flex-col items-center">
                                <KeyIcon className="h-10 w-10 text-amber-600 mb-3" />
                                <h2 className="text-2xl font-bold text-gray-800 text-center">Modifier le mot de passe</h2>
                                <p className="text-gray-500 text-sm mt-1">Pour votre sécurité, choisissez un mot de passe robuste</p>
                            </div>
                        </div>

                        {/* Messages d'état */}
                        {errorMessage && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                                <ExclamationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                                {errorMessage}
                            </div>
                        )}
                        {successMessage && (
                            <div className="mx-6 mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-start">
                                <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                                {successMessage}
                            </div>
                        )}

                        {/* Formulaire */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Mot de passe actuel */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 flex items-center">
                                    <LockClosedIcon className="h-4 w-4 text-amber-500 mr-2" />
                                    Mot de passe actuel
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            {/* Nouveau mot de passe */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 flex items-center">
                                    <LockOpenIcon className="h-4 w-4 text-amber-500 mr-2" />
                                    Nouveau mot de passe
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                        required
                                        placeholder="Au moins 8 caractères"
                                    />
                                </div>
                            </div>

                            {/* Confirmation */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 flex items-center">
                                    <ShieldCheckIcon className="h-4 w-4 text-amber-500 mr-2" />
                                    Confirmer le nouveau mot de passe
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        name="newPasswordConfirm"
                                        value={formData.newPasswordConfirm}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                        required
                                        placeholder="Retapez votre nouveau mot de passe"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4">
                                <Link
                                    to="/settings"
                                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                                    Retour au compte
                                </Link>

                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                                >
                                    Mettre à jour
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
