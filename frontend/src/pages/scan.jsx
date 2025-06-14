import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"
import { ArrowBigLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator"
import { Activity } from "lucide-react";

import { io } from "socket.io-client";
const socket = io("http://127.0.0.1:5000"); // ou l’URL de ton backend Flask

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"

function Scan() {
  const [target, setTarget] = useState("");
  const [command, setCommand] = useState([]);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isvalidating, setIsvalidating] = useState(false);
  const [user_command, setUser_command] = useState("");
  const [user_response, setUser_response] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const [llm_response, setLlm_response] = useState("");
  const [initialCommand, setInitialCommand] = useState("");
  const [response, setResponse] = useState("");
  const [user, setUser] = useState(null);
  const [scan, setScan] = useState(null);
  const [report, setReport] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [scan_project, setScan_project] = useState("");
  const [error, setError] = useState(null);
  const [chargement, setChargement] = useState(false);
  const { scanId } = useParams();
  const navigate = useNavigate();

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
        setChargement(false);
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
    if (user_response) {
      submitValidation();
    }
  }, [user_response]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isPaused) { // Seulement si on n'est pas déjà en pause
        try {
          const res = await fetch("http://127.0.0.1:5000/get_response");
          const data = await res.json();
          if (data.status === "waiting") {
            console.log("data", data)
            if (data.llm_response) {
              setIsPaused(true);
            }
            setCommand(data.command);

          }
        } catch (error) {
          console.error("Erreur lors de la récupération du statut:", error);
        }
      }
    }, 2000); // Vérifie toutes les secondes

    return () => clearInterval(interval);
  }, [isPaused]); // Dépend de isPaused


  // Fonction pour envoyer la réponse de l'utilisateur
  const sendResponse = async (response) => {
    if (response === "o") {
      await fetch("http://127.0.0.1:5000/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: "o", user_command: "none" })
      });
      setIsPaused(false);
    } else {
      setShowInput(true);
    }
  };

  const submitCustomCommand = () => {
    // Envoyer "n" et la commande personnalisée
    console.log("Custom command submitted:", customCommand);

    fetch("http://127.0.0.1:5000/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: "n", user_command: customCommand })
    });
    setInitialCommand(command.at(-1));
    setCommand(prevCommands => {
      if (prevCommands.length === 0) return [command];
      return [...prevCommands.slice(0, -1), customCommand + " (en validation)"];
    }
    );
    setIsPaused(false);
    setIsvalidating(true);
  };


  const submitValidation = () => {
    fetch("http://127.0.0.1:5000/validation_response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: user_response, user_command: customCommand })
    });
    console.log("user response front:", user_response);
    if (user_response === "o") {
      setCommand(prevCommands => {
        if (prevCommands.length === 0) return [customCommand];
        return [...prevCommands.slice(0, -1), customCommand];
      });
    }
    else {
      setCommand(prevCommands => {
        if (prevCommands.length === 0) return [initialCommand];
        return [...prevCommands.slice(0, -1), initialCommand];
      });
    }

    setShowInput(false);
    setIsPaused(false);
    setIsvalidating(false);
    setCustomCommand('');
    setUser_response('');
    setLlm_response('');
    setUser_command('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponse(""); // Réinitialiser les réponses précédentes

    try {
      // 1. D'abord établir la connexion streaming
      console.log("Initialisation du streaming...");
      socket.emit("start_llm_query", { target });

      // 2. Attendre que le streaming soit prêt avant de lancer la requête API
      socket.once("streaming_ready", async () => {
        console.log("Streaming prêt, lancement de la requête API...");

        const response = await fetch("http://127.0.0.1:5000/api/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target }),
        });

        const data = await response.json();
        setOutput(data.output || data.error);
        setLoading(false);
      });
    } catch (error) {
      console.error("Erreur:", error);
      setOutput("Erreur de connexion au serveur");
      setLoading(false);
    }
  };
  useEffect(() => {
    console.log("Initialisation de WebSocket...");

    socket.on("connect", () => {
      console.log("Connecté via WebSocket");
    });

    socket.on("connect_error", (err) => {
      console.error("Erreur WebSocket:", err);
    });

    socket.on("llm_response", (data) => {
      console.log("Token reçu");
      setResponse((prev) => prev + data.token);
    });

    socket.on("llm_end", (data) => {
      console.log("Fin de stream:", data.final_text);
    });

    return () => {
      socket.off("llm_response");
      socket.off("llm_end");
      socket.off("connect");
      socket.off("connect_error");
    };
  }, []);

  if (!user) {
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
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between px-6 bg-background border-b border-border">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <a
              onClick={() => navigate(`/project-dashboard/${scan_project}`)}
              className="p-2 rounded-full hover:bg-primary/10 transition-colors"
              title="Retour au projet"
            >
              <ArrowBigLeft className="h-5 w-5 text-primary" />
            </a>
            <Separator orientation="vertical" className="h-6 bg-primary/40 mr-4" />
            <h2 className="text-xl font-bold text-primary italic tracking-tight">Scan Rapide</h2>
          </div>
        </header>

        <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--background))] to-[hsl(var(--primary)/0.1)] flex flex-col items-center justify-center px-4 py-8">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 w-full max-w-7xl">

            <div className="bg-card rounded-lg shadow-lg w-full max-w-md h-[300px] overflow-auto font-mono text-green-400 whitespace-pre-wrap border border-border">
              <div className="flex items-center m-2 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-sm text-foreground">LLM Response</span>
              </div>
              <div className="p-4 whitespace-pre-wrap">
                {response || <span className="text-muted-foreground text-sm">$ Waiting for response...</span>}
              </div>
            </div>

            {/* Formulaire Scan */}
            <div className="bg-card border border-border p-6 rounded-lg shadow-lg w-full max-w-md text-center">
              <h2 className="text-lg font-semibold text-primary text-center mb-4 p-8">Entrer une IP ou un domaine</h2>
              <form onSubmit={handleSubmit} className=" flex flex-col space-y-4">
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="192.168.x.x ou example.com"
                  required
                  className="w-full p-2 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 rounded bg-primary text-background font-semibold hover:bg-primary/80 transition"
                >
                  {loading ? "Analyse en cours..." : "Exécuter"}
                </button>
              </form>

              {isPaused && (
                <div className="bg-muted p-4 rounded-lg space-y-4">
                  <h3 className="text-primary font-semibold">Personnalisation</h3>
                  {!showInput ? (
                    <>
                      <p className="text-muted-foreground">
                        Voulez-vous exécuter cette commande <strong>{command.at(-1)}</strong> ?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendResponse("o")}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => sendResponse("n")}
                          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                          Non
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={customCommand}
                        onChange={(e) => setCustomCommand(e.target.value)}
                        className="w-full p-2 rounded border border-border bg-background text-foreground"
                        placeholder="Entrez votre commande alternative"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={submitCustomCommand}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          Envoyer
                        </button>
                        <button
                          onClick={() => {
                            setShowInput(false);
                            setIsvalidating(false);
                            setCustomCommand('');
                            setUser_response('');
                            setIsPaused(true);
                          }}
                          className="bg-muted-foreground text-background px-4 py-2 rounded hover:bg-muted"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loading && <Loading />}
              {output && !loading && (
                <div className="bg-background border border-border mt-4 p-4 rounded-lg max-h-72 overflow-y-auto font-mono text-sm text-green-400">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-primary font-semibold">Output:</h3>
                    <button
                      onClick={() => setOutput("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      × Clear
                    </button>
                  </div>
                  <pre>{typeof output === 'object' ? JSON.stringify(output, null, 2) : output}</pre>
                </div>
              )}
            </div>

            <div className="bg-card rounded-lg shadow-lg w-full max-w-sm font-mono text-green-400 border border-border h-[300px] overflow-auto">
              <div className="flex items-center p-2 border-b border-border">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="ml-3 text-sm text-foreground">Terminal</span>
              </div>
              <div className="px-4 pt-2">
                {command.length > 0 ? (
                  <>
                    <p className="text-muted-foreground mb-2">$ Commandes exécutées:</p>
                    {command.map((cmd, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-green-400">$</span> {cmd}
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-muted-foreground">Aucune commande exécutée...</p>
                )}

                <div className="mt-2 flex items-center">
                  <span className="text-green-400 mr-2">$</span>
                  <span className="animate-pulse">_</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center bg-opacity-0 mt-4">
      <img
        // src="http://a.top4top.net/p_1990j031.gif"
        src="https://i.gifer.com/5Q0v.gif"
        alt="Loading"
        className="w-32 h-32"
      />
      <span className="text-xl font-semibold text-black mt-2">Loading...</span>
    </div>
  );
}

export default Scan;
