import React, { useState, useEffect } from "react";

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
            setIsPaused(true);
            
            setLlm_response(data.llm_response);
            if (data.llm_response) {
              setIsvalidating(true);
              setUser_command(data.user_command);
            }
            else {
              setCommand(data.command);
            }
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

    try {
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
    } catch (error) {
      setOutput("Erreur de connexion au serveur");
    }
  };

  return (
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
                    {!isvalidating ? (

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
                              setIsvalidating(false);
                              setCustomCommand('');
                              setUser_response('');
                              setIsPaused(true);
                            }}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                          >
                            Annuler
                          </button>
                        </div></>
                    ) : (
                      <><h2>validation requise</h2><h4>voulez vous exécuter votre commande {user_command}</h4>

                      <h4> <bold>le LLM {llm_response} votre reponse</bold></h4>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => { setUser_response("o"); }}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => { setUser_response("n"); }}
                          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                          Non
                        </button>
                      </div></>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div>
          {loading && <Loading />}
        </div>
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
          {command.length > 0 ? (
            <>
              <p className="text-white mb-2">$ Commandes exécutées:</p>
              {command.map((cmd, index) => (
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
