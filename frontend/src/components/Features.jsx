import { Badge } from "./ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import image from "../assets/growth.png"
import image3 from "../assets/reflecting.png"
import image4 from "../assets/looking-ahead.png"

const features = [
  {
    title: "Vitesse Inégalée",
    description: "Exécution parallélisée des tests avec des temps de réponse optimisés",
    image: image4 // Ex: chronomètre/flèche de vitesse
  },
  {
    title: "Automatisation Totale", 
    description: "Workflow 100% autonome de la détection à l'exploitation sans intervention humaine nécessaire",
    image: image3 // Ex: robot/process automatisé
  },
  {
    title: "Érudition Technique",
    description: "Base de connaissances enrichie par IA avec analyse contextuelle des vulnérabilités et adaptations dynamiques",
    image: image // Ex: cerveau IA/circuits
  }
];

const featureList = [
  "Interface rapide",
  "Design responsive (mobile/desktop)",
  "Thème clair/sombre personnalisable",
  "Gestion des sessions utilisateurs",
  "Tableau de bord",
  "Notifications en temps réel",
  "Export PDF des résultats",
  "Minimaliste et épuré",
  "Mise à niveau continue",
];

export const Features = () => {
  return (
    <section id="features" className="container py-12 sm:py-16 space-y-8">
      <h2 className="text-3xl lg:text-4xl font-bold md:text-center">
        Beaucoup de {" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
           fonctionnalités{" "}
        </span>
      </h2>

      <div className="flex flex-wrap md:justify-center gap-4">
        {featureList.map(feature => (
          <div key={feature}>
            <Badge variant="thirdary" className="text-sm ">
              {feature}
            </Badge>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map(({ title, description, image }) => (
          <div className="relative h-auto min-h-[200px] overflow-hidden">
          <Card key={title} className="bg-red-200 bg-opacity-20 border border-red-500 h-auto relative z-10">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>{description}</CardContent>

            <CardFooter>
              <img
                src={image}
                alt="About feature"
                className="w-[200px] lg:w-[300px] mx-auto"
              />
            </CardFooter>
          </Card>
          </div>
        ))}
      </div>
    </section>
  )
}
