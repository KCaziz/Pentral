import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

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
        return <div className="text-center py-8">Chargement...</div>;
    }

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
                    <img src={cloudSvg} alt="cloud" className=" ml-[50%] mb-10 size-32" />

                </header>

                <div className="flex">
                    <div className="w-full">
                        <div className="min-h-screen flex pt-5 justify-center ">
                            <div className=" p-8 rounded-lg shadow-lg w-full max-w-xl">
                                <h2 className="text-2xl font-bold mb-6 text-center">Modifier le mot de passe</h2>

                                {errorMessage && <p className="text-red-500 mb-4 text-center">{errorMessage}</p>}
                                {successMessage && <p className="text-green-500 mb-4 text-center">{successMessage}</p>}

                                <form onSubmit={handleSubmit}>
                                    <div className="mb-4">
                                        <label className="block font-semibold mb-2">Mot de passe actuel</label>
                                        <input
                                            type="password"
                                            name="currentPassword"
                                            value={formData.currentPassword}
                                            onChange={handleInputChange}
                                            className="w-full border-gray-300 p-3 rounded-md focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="block font-semibold mb-2">Nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            name="newPassword"
                                            value={formData.newPassword}
                                            onChange={handleInputChange}
                                            className="w-full border-gray-300 p-3 rounded-md focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="block font-semibold mb-2">Confirmer le nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            name="newPasswordConfirm"
                                            value={formData.newPasswordConfirm}
                                            onChange={handleInputChange}
                                            className="w-full border-gray-300 p-3 rounded-md focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <Button type="submit" variant="outline" className="w-auto px-4 py-2 bg-primary hover:bg-yellow-500">
                                            Confirmer
                                        </Button>
                                        <Link to="/settings">
                                            <Button variant="ghost" >
                                                Compte
                                            </Button>
                                        </Link>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

            </SidebarInset>
        </SidebarProvider>
    );
}
