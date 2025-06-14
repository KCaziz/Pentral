import { Button } from "./ui/button";
import { buttonVariants } from "./ui/button";
import { HeroCards } from "./HeroCards";
import { RocketIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
<section className="container grid lg:grid-cols-2 place-items-center pt-20 md:pt-32 gap-10 relative">
      <div className="text-center lg:text-start space-y-6">
        <main className="text-5xl md:text-6xl font-bold">
          <h1 className="inline">
            <span className="inline bg-gradient-to-r from-[#F596D3] to-[#D247BF] text-transparent bg-clip-text">
              Pentral
            </span>{" "}
            Page d'accueil
          </h1>{" "}
          pour{" "}
          <h2 className="inline">
            amateur de{" "}
            <span className="inline bg-gradient-to-r from-pink-400 via-red-500 to-rose-800 text-transparent bg-clip-text">
              Pentest
            </span>{" "}

          </h2>
        </main>

        <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
          Utiliser notre outil gratuitement et commencez votre aventure de pentesting.
        </p>

        <div className="space-y-4 md:space-y-0 md:space-x-4">

          <Link
            to="/signup"
            className={`w-full md:w-1/3 ${buttonVariants({
              variant: "outline",
            })}`}
          >
            Commencer ici
            <RocketIcon />
          </Link>
        </div>
      </div>

      <div className="hidden lg:block"> 
          <HeroCards />
      </div>


    </section>
  );
};
