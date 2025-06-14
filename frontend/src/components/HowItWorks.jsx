import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { TargetIcon, BrainCircuitIcon, TerminalIcon, RefreshCwIcon, ShieldAlertIcon, FileTextIcon } from "lucide-react"

const features = [
  {
    icon: <TargetIcon />,  // Icône de cible
    title: "1# Ciblage Initial",
    description: "Saisie de la cible (IP, plage CIDR ou domaine) et validation des paramètres de scan"
  },
  {
    icon: <BrainCircuitIcon />,  // Icône d'IA/LLM
    title: "2# Analyse Intelligente",
    description: "Le LLM évalue la cible et génère une stratégie d'attaque optimisée en temps réel"
  },
  {
    icon: <TerminalIcon />,  // Icône de terminal
    title: "3# Exécution Automatisée",
    description: "Déploiement des commandes (Nmap, Nessus, etc.) avec adaptation dynamique aux résultats"
  },
  {
    icon: <RefreshCwIcon />,  // Icône de boucle
    title: "4# Rétroadaptation",
    description: "Analyse des sorties et génération itérative de nouvelles commandes pour approfondir les connaissances sur la cible"
  },
  {
    icon: <ShieldAlertIcon />,  // Icône de bouclier avec alerte
    title: "5# Évaluation des Vulnérabilités",
    description: "Détection des vecteurs d'attaque critiques et évaluation du risque"
  },
  {
    icon: <FileTextIcon />,  // Icône de document
    title: "6# Rapport Final",
    description: "Génération automatisée du rapport comprenant : commandes exécutées, failles identifiées et recommandations de mitigation"
  }
];
export const HowItWorks = () => {
  return (
    <section id="howItWorks" className="container text-center py-12 sm:py-16">
      <h2 className="text-3xl md:text-4xl font-bold ">
        Comment{" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          ça fonctionne{" "}
        </span>
        Guide étape par étape
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-10">
        {features.map(({ icon, title, description }) => (
          <Card key={title} className="bg-muted/50">
            <CardHeader>
              <CardTitle className="grid gap-4 place-items-center">
                {icon}
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>{description}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
