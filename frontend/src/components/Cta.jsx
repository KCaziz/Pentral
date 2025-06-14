import { Button } from "./ui/button";
import { Link } from "react-router-dom";

export const Cta = () => {
  return (
    <section
      id="cta"
      className="bg-muted/50 py-10 my-12 sm:my-16"
    >
      <div className="container lg:grid lg:grid-cols-2 place-items-center">
        <div className="lg:col-start-1 pl-4">
          <h2 className="text-3xl md:text-4xl font-bold ">
            Touts vos
            <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
              {" "}
              Pentest & Rapport de sécurité{" "}
            </span>
            Dans un seul endroit.
          </h2>
          <p className="text-muted-foreground text-xl mt-4 mb-8 lg:mb-0">
            Avec Pentral, gérez vos projets de cybersécurité avec une
            transparence totale et un accès instantané à tous vos résultats.
          </p>
        </div>

        <div className="space-y-4 lg:col-start-2 flex flex-col md:flex-row md:space-y-0 md:space-x-4">
  <Link 
    to="/scan"
    className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-center transition hover:bg-primary/90 shadow-sm"
  >
    Lancer un scan
  </Link>
  
  <a
    href="#features"
    className="bg-muted text-muted-foreground px-6 py-3 rounded-md font-medium text-center transition hover:bg-muted/80 border border-input shadow-sm"
  >
    Les fonctionnalités
  </a>
</div>
      </div>
    </section>
  );
};
