import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"
import { Activity } from "lucide-react";
import { ArrowBigLeft } from "lucide-react";
import { io } from "socket.io-client";
const socket = io("http://127.0.0.1:5000");

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"
import anim from "@/assets/Animation.gif"

function Scan_user() {
  const [target, setTarget] = useState("");
  const [command, setCommand] = useState([]);
  const [command_affichage, setCommand_affichage] = useState([]);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const [user, setUser] = useState(null);
  const [scan, setScan] = useState(null);
  const [report, setReport] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [scan_project, setScan_project] = useState("");
  const [error, setError] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [llm_response, setLlm_response] = useState("");
  const [scanStatus, setScanStatus] = useState({ status: "idle", message: "" });

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

    const fetchScan = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/get_scan/${scanId}`, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erreur serveur");
        const scan = data[0];
        setScan(scan);
        setScan_project(scan.project_id);

        if (scan && Array.isArray(scan.commands_executed) && command.length === 0) {
          const newCommands = scan.commands_executed.map(cmd => cmd.command);
          setCommand((prevCommands) => {
            if (prevCommands.length === 0) {
              return newCommands;
            } else {
              return prevCommands;
            }

          });
        } else {
          console.warn("Pas de commandes exécutées ou scan vide:", scan);
        }

        if (scan.report_url != null) {
          setReport(scan.report_url);
          setOutput(null);
          setShowReport(true);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erreur fetchUser:", err.message);
        setError(err.message);
      }
    };
    fetchScan();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isPaused) { // Seulement si on n'est pas déjà en pause
        try {
          const res = await fetch("http://127.0.0.1:5000/get_response");
          const data = await res.json();
          if (data.status === "waiting") {
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
      sendCommand(command);
      command_affichage.push(command[command.length - 1]);
    } else {
      setShowInput(true);
    }
  };

  const sendCommand = async (cmd) => {
    console.log("Envoi de la réponse:", cmd);

    const lastCommand = Array.isArray(cmd)
      ? cmd[cmd.length - 1]?.command || cmd[cmd.length - 1] || cmd
      : cmd;

    console.log("Last command:", lastCommand);


    try {
      const response = await fetch(`http://127.0.0.1:5000/api/scans/${scanId}/add_command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: lastCommand,
          llm_response: llm_response,
        })
      });

      if (!response.ok) {
        throw new Error('Erreur serveur');
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error("Erreur lors de l'envoi de la réponse:", error);
      throw error; // Propager l'erreur pour la gérer plus haut
    }
  }


  const submitCustomCommand = () => {
    // Envoyer "n" et la commande personnalisée
    console.log("Custom command submitted:", customCommand);

    fetch("http://127.0.0.1:5000/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: "n", user_command: customCommand })
    });
    setCommand(prevCommands => {
      if (prevCommands.length === 0) return [command];
      return [...prevCommands.slice(0, -1), customCommand];
    }
    );
    setIsPaused(false);
    setShowInput(false);
    sendCommand(customCommand);
    command_affichage.push(customCommand);
    // setIsvalidating(true);
  };

  const getSocketId = () => socket.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    setLlm_response(""); // Réinitialiser les réponses précédentes

    try {
      // 1. D'abord établir la connexion streaming
      console.log("Initialisation du streaming...");
      socket.emit("start_llm_query", { target });

      // 2. Attendre que le streaming soit prêt avant de lancer la requête API
      socket.once("streaming_ready", async () => {
        console.log("Streaming prêt, lancement de la requête API...");

        const response = await fetch(`http://127.0.0.1:5000/api/scans/${scanId}/start_user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target, socket_id: getSocketId()  }),
        });

        const data = await response.json();
        setOutput(data.output || data.error);
        setLoading(false);
      });
    } catch (error) {
      setOutput("Erreur de connexion au serveur");
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
      setLlm_response((prev) => prev + data.token);
    });

    socket.on("llm_end", (data) => {
      console.log("Fin de stream:", data.final_text);
    });
    socket.on("scan_status", (data) => {
      console.log("Status scan:", data);
      setScanStatus({
        status: data.status,
        message: data.message,
        timestamp: data.timestamp,
        data: data.data
      });
    });

    return () => {
      socket.off("llm_response");
      socket.off("llm_end");
      socket.off("connect");
      socket.off("connect_error");
      socket.off("scan_status"); 
    };
  }, []);

  if (!user || !scan) {
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
        <header className="flex h-16 items-center justify-between px-6 bg-background border-b border-red-400/20">
          <div className="flex items-center gap-3">
            <SidebarTrigger />

            <div className="flex items-center gap-3">
              <a
                onClick={() => navigate(`/project-dashboard/${scan_project}`)}
                className="ml-0 inline-flex items-center justify-center p-2 rounded-full hover:bg-red-400/10 transition-colors"
                title="Retour au projet"
              >
                <ArrowBigLeft className="h-5 w-5 text-primary" />
              </a>

              <Separator orientation="vertical" className="h-6 bg-primary mr-6" />

              <h2 className="text-xl font-bold text-primary italic tracking-tight">
                Scan Avec Utilisateur
              </h2>

            </div>
          </div>
        </header>

        <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--background))] to-[hsl(var(--primary)/0.1)] flex flex-col items-center justify-center px-4 py-8">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 w-full max-w-7xl">

            <div className="bg-card rounded-lg shadow-lg w-full max-w-md h-[300px] overflow-auto font-mono text-green-400 whitespace-pre-wrap border border-border">
              <div className="sticky top-0 bg-card z-10 p-2 flex items-center mx-0 my-2 border-b border-border">
                <div className="h-3 w-3 bg-red-500 rounded-full "></div>
                <div className="h-3 w-3 bg-yellow-500 rounded-full "></div>
                <div className="h-3 w-3 bg-green-500 rounded-full "></div>
                <span className="ml-3 text-sm text-foreground">LLM Response</span>
              </div>
              {llm_response || <span className="text-muted-foreground text-sm ml-4">$ Waiting for response...</span>}
            </div>

            <div className="bg-card border border-border p-6 rounded-lg shadow-lg w-full max-w-md text-center">
              <h2 className="text-lg font-semibold text-primary text-center mb-4 p-8">
                Entrer une IP ou un domaine
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
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
                  {loading ? "Scan en cours..." : output ? "Terminé" : "Exécuter"}
                </button>
              </form>
              <div>
                {isPaused ? (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="text-lg font-semibold text-primary ">
                      Personnalisation
                    </h3>
                    <div>
                      {!showInput ? (
                        <div className="justify-center space-x-4">
                          <p className="text-yellow-700 mb-3">
                            Voulez-vous exécuter cette commande {command[command.length - 1]} ?
                          </p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => sendResponse("o")}
                              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                              Oui
                            </button>
                            <button
                              onClick={() => sendResponse("n")}
                              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                            >
                              Non
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col space-y-2 w-full max-w-md">
                          <><input
                            type="text"
                            value={customCommand}
                            onChange={(e) => setCustomCommand(e.target.value)}
                            className="border p-2 rounded"
                            placeholder="Entrez votre commande alternative" />
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={submitCustomCommand}
                                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                >
                                  Envoyer
                                </button>
                                <button
                                  onClick={() => {
                                    setShowInput(false);
                                    setIsPaused(false);
                                  }}
                                  className="bg-muted-foreground text-background px-4 py-2 rounded hover:bg-muted"
                                >
                                  Annuler
                                </button>
                            </div></>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                {loading &&  <Loading scanStatus={scanStatus} />}
              </div>
              {scan.report_url && (
                <div className="items-center justify-center">
                  {/* <iframe src={`http://127.0.0.1:5000/${scan.report_url}`} className="mt-3" width="100%" height="100%" title="Rapport PDF" /> */}
                  <a
                    href={`http://127.0.0.1:5000${scan.report_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-rose-400 text-background  font-semibold py-2 px-4 rounded-lg hover:bg-rose-600  transition duration-300 mt-3"
                  >
                    Consulter le rapport
                  </a>
                </div>
              )}
              
              {output && !loading &&(
                // <div className="mt-4 bg-background  p-4 rounded-lg max-h-96 overflow-y-auto">
                //   <div className="flex justify-between items-center mb-2">
                //     <h3 className="text-primary font-mono">Output:</h3>
                //     <button
                //       onClick={() => setOutput("")}
                //       className="text-muted-foreground hover:text-foreground"
                //     >
                //       × Clear
                //     </button>
                //   </div>
                //   <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap break-words">
                //     {typeof output === 'object' ? JSON.stringify(output, null, 2) : output}
                //   </pre>
                // </div>

                <a
                  href={`http://127.0.0.1:5000/${output}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-rose-400 text-background font-semibold py-2 px-4 rounded-lg hover:bg-rose-600 transition duration-300 mt-4"
                >
                  Consulter le rapport
                </a>
              )}
            </div>


            <div className="bg-card rounded-lg shadow-lg w-full max-w-sm font-mono text-green-400 border border-border h-[300px] overflow-auto">
              <div className="flex items-center p-2 border-b border-border">
                <div className="w-3 h-3 bg-red-500 rounded-full "></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full "></div>
                <div className="w-3 h-3 bg-green-500 rounded-full "></div>
                <span className="ml-3 text-sm text-foreground">Terminal</span>
              </div>

              <div className="px-4 pt-2">
 {command_affichage.length > 0 ? (
  <>
    <p className="text-muted-foreground mb-2">$ Commandes exécutées:</p>
    {command_affichage.map((cmd, index) => (
      <div key={index} className="mb-1">
        <span className="text-green-400">$</span> {cmd}
      </div>
    ))}
  </>
) : command.length > 0 ? (
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


function Loading({ scanStatus }) {
  return (
    <div className="flex flex-col items-center justify-center bg-opacity-0 mt-4">
      <img
        // src="http://a.top4top.net/p_1990j031.gif"
        // src="https://i.gifer.com/5Q0v.gif"
        src={anim}
        alt="Loading"
        className="w-48 h-48"
      />
    
      <div className="text-center space-y-2">
        {scanStatus.status ? (
          <p className="text-md font-medium text-forground transition-opacity duration-1000 opacity-100">
           {scanStatus.status} : {scanStatus.message}
          </p>
        )
        : (
          <p className="text-sm font-light text-forground animate-pulse">
            Chargement en cours...
          </p>
        )}
      </div>
    </div>
  );
}
export default Scan_user;
