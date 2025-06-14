import { Statistics } from "./Statistics";
import pilot from "../assets/pilot.png";
import { ArrowRight } from "lucide-react";

export const About = () => {
  return (
    <section
      id="about"
      className="container py-12 sm:py-16"
    >
      <div className="bg-muted/50 border rounded-lg py-12">
        <div className="px-6 flex flex-col-reverse md:flex-row gap-8 md:gap-12">
          <img
            src={pilot}
            alt=""
            className="w-[300px] object-contain rounded-lg"
          />
          <div className="bg-green-0 flex flex-col justify-between">
            <div className="pb-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                  A propos{" "}
                </span>
                de Keystone
              </h2>
              <p className="text-2xl text-muted-foreground mt-4">
                Acteur majeur de la cybersécurité dans la région MENA, avec une expertise précieuse dans la mise en place de programmes de cyberdéfense couvrant les niveaux stratégique, tactique et opérationnel.
                Keystone intervient sur les aspects préventif, proactif et de réponse en proposant une liste complète de services pour plusieurs industries. Notre expertise et notre longue expérience sont assurées par nos experts de renommée internationale.
                keystone Team rassemble des spécialistes de la cybersécurité pour accompagner les entreprises dans leur développement digital et leur transformation digitale.

                Keystone s’engage à inverser cette tendance en aidant ses clients à comprendre les menaces sur leurs systèmes d’information et comment y répondre et les protéger.
              </p>
              <a href="https://www.keystone-corporation.com/" >
                <p className="pt-3"> Visite notre site web : www.keystone-corporation.com</p>

              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;