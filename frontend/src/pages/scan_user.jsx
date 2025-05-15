import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@material-tailwind/react";
import { ArrowBigLeft } from "lucide-react";

import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import cloudSvg from "@/assets/japanese-style-cloud-svgrepo-com (2).svg"

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


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/scans/${scanId}/start_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target }),
      });

      const data = await response.json();
      setOutput(data.output || data.error);
      setLoading(false);
    } catch (error) {
      setOutput("Erreur de connexion au serveur");
    }
  };
  if (!user || !scan) return <p>Chargement...</p>


  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-black">
          <div className="flex items-center gap-2 text-white">
            <div className="mt-2">
              <SidebarTrigger />
              <a href="" className="mt-0 pt-0" onClick={() => navigate(`/project-dashboard/${scan_project}`)}>
                <Button variant="outline" className="m-2 mt-0 pt-0 text-white hover:bg-primary hover:text-white"> <ArrowBigLeft /> </Button>
              </a>
            </div>
            {/* <Separator orientation="vertical" className="h-4" /> */}
          </div>
          <img src={cloudSvg} alt="cloud" className=" ml-auto mb-10  size-32" />
          <img src={cloudSvg} alt="cloud" className=" ml-[50%] mb-10 size-32" />

        </header>
        <div className="h-screen flex items-center justify-center bg-gradient-to-b from-black to-yellow-300">

          <div className="bg-black bg-opacity-50 p-6 rounded-lg shadow-lg w-96 text-center">
            <h2 className="text-white text-lg font-semibold mb-4 p-10">
              Entrer une IP, CIDR ou un domaine
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="192.168.x.x ou 192.168.x.x/24 ou example.com"
                required
                className="p-2 rounded border border-gray-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-yellow-300"
              />

              {!loading ? (
                <button
                  type="submit"
                  className="bg-yellow-500 text-black font-semibold py-2 rounded-lg hover:bg-yellow-600 transition duration-300"
                >
                  Exécuter
                </button>) : (
                <p
                  className="bg-gray-500 text-white font-semibold py-2 rounded-lg "
                >
                  Exécuter
                </p>
              )
              }
            </form>
            <div>
              {isPaused ? (
                <div className="mt-4 p-4 bg-yellow-100 rounded-lg">
                  <h2 className="text-lg font-semibold text-yellow-800">
                    Confirmation requise
                  </h2>
                  <div>
                    {!showInput ? (
                      <div className="justify-center space-x-4">
                        <p className="text-yellow-700 mb-3">
                          Voulez-vous exécuter cette commande {command[command.length - 1]} ?
                        </p>
                        <div className="items-center space-y-4 space-x-4">
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
                          placeholder="Entrez votre commande alternative" /><div className="flex space-x-2">
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
                              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
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
              {loading && <Loading />}
            </div>
            {showReport && (
              <div className="items-center justify-center">
                {/* <iframe src={`http://127.0.0.1:5000/${scan.report_url}`} className="mt-3" width="100%" height="100%" title="Rapport PDF" /> */}
                <a
                  href={`http://127.0.0.1:5000/${scan.report_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-300 mt-3"
                >
                  Consulter le rapport
                </a>
              </div>
            )}
            {output && !loading && (
              <div className="mt-4 bg-black bg-opacity-70 p-4 rounded-lg max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-yellow-400 font-mono">Output:</h3>
                  <button
                    onClick={() => setOutput("")}
                    className="text-gray-400 hover:text-white"
                  >
                    × Clear
                  </button>
                </div>
                <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap break-words">
                  {typeof output === 'object' ? JSON.stringify(output, null, 2) : output}
                </pre>
              </div>
            )}      </div>
          <div className="bg-black p-4 ml-4 rounded-lg shadow-lg  max-w-2xl font-mono text-green-400 overflow-auto" style={{ height: "300px" }}>
            <div className="flex items-center mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
              <span className="text-sm">Terminal</span>
            </div>

            <div className="border-t border-gray-700 pt-2">
              {command_affichage.length > 0 ? (
                <>
                  <p className="text-white mb-2">$ Commandes exécutées:</p>
                  {command_affichage.map((cmd, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-blue-400">$</span> {cmd}
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-gray-500">Aucune commande exécutée...</p>
              )}
            </div>

            <div className="mt-2 flex items-center">
              <span className="text-green-400 mr-2">$</span>
              <span className="animate-pulse">_</span>
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

export default Scan_user;
