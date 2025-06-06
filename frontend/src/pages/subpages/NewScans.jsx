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

export default function NewScan() {
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
                    <img src={cloudSvg} alt="cloud" className=" ml-[50%] mt-20 size-32" />

                </header>
                <div className="flex">
                    <div className="w-full pb-10">
                        <div className="min-h-screen flex items-center justify-center">
                            <div className="p-8 rounded-lg w-full max-w-2xl">
                                <h2 className="text-2xl  font-bold mb-6 text-center">
                                    Choissisez votre Scan
                                </h2>

                                {message && <p className="text-yellow-500 mb-4 text-center">{message}</p>}

                                <div>
                                    <Link to="/">
                                        <Button className="w-full mb-4 bg-primary text-black" variant="outline">
                                    Scan Rapide
                                        </Button>
                                    </Link>
                                </div>
                                <div>
                                    Scan avec raisonnement 
                                </div>
                                <div>
                                    Scan avec raisonnement et controle des commandes
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
