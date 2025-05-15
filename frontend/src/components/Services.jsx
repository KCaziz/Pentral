import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { MagnifierIcon, WalletIcon, ChartIcon } from "./Icons"
import cubeLeg from "../assets/cube-leg.png"

import {
  Code,                // CodeIcon (Open Source)
  FolderPlus,          // ProjectManagementIcon 
  FileSearch,          // ReportAccessIcon
} from "lucide-react";

const serviceList = [
  {
    title: "Open Source Transparency",
    description: "Reepository entièrement accessible et auditable pour une confiance absolue dans le processus de scan",
    icon: <Code className="w-6 h-6 text-primary" />
  },
  {
    title: "Gestion de Projets Flexibles",
    description: "Créez des projets illimités, chacun pouvant contenir autant de scans que nécessaire avec organisation temporelle",
    icon: <FolderPlus className="w-6 h-6 text-primary" />
  },
  {
    title: "Accès Immédiat aux Résultats",
    description: "Consultez ou téléchargez les rapports PDF à tout moment, même des scans effectués il y a plusieurs mois",
    icon: <FileSearch className="w-6 h-6 text-primary" />
  }
];

export const Services = () => {
  return (
    <section className="container py-12 sm:py-16">
      <div className="grid lg:grid-cols-[1fr,1fr] gap-8 place-items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">
            <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
              Client-Centric{" "}
            </span>
            Services
          </h2>

          <p className="text-muted-foreground text-xl mt-4 mb-8">
            Pentral redéfinit l'expérience cybersécurité avec une approche centrée utilisateur :
            automatisation intelligente, résultats exploitables et tranquillité d'esprit garantie.
          </p>
          <div className="flex flex-col gap-8">
            {serviceList.map(({ icon, title, description }) => (
              <Card key={title}>
                <CardHeader className="space-y-1 flex md:flex-row justify-start items-start gap-4">
                  <div className="mt-1 bg-primary/20 p-1 rounded-2xl">
                    {icon}
                  </div>
                  <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription className="text-md mt-2">
                      {description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <img
          src={cubeLeg}
          className="w-[300px] md:w-[500px] lg:w-[600px] object-contain"
          alt="About services"
        />
      </div>
    </section>
  )
}
