import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LightBulbIcon } from "./Icons"

export const HeroCards = () => {
  const navigate = useNavigate();
  return (

    <div className="flex flex-col xl:flex-row flex-wrap gap-8 w-full xl:w-[800px] h-auto xl:h-[550px] relative">
      {/* Par défaut en static ; devient absolute uniquement en xl */}
      <Card className="w-full xl:w-[320px] xl:absolute xl:top-1/2 xl:left-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2">
        <CardHeader>
          <CardTitle className="text-2xl">Gratuit</CardTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <CardDescription className="text-lg pt-2">
            Scan illimités • Pas de carte de crédit requise • Pas de publicités
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full text-lg py-6"
            onClick={() => navigate("/scan")}
          >
            Démarrer un scan
          </Button>
        </CardContent>
      </Card>

      {/* Feature - Positionné en haut à droite */}
      <Card className="xl:absolute w-full xl:w-[380px] xl:-top-[10px] xl:right-[40px]">
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="bg-primary/20 p-3 rounded-full">
            <LightBulbIcon className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-xl">UX</CardTitle>
            <CardDescription className="text-lg">
              Systéme de théme Light&Dark.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};
export default HeroCards


{/* Testimonial - Déplacé en haut à gauche */ }
{/* <Card className="xl:absolute w-full xl:w-[360px] xl:-top-[20px] xl:-left-[10px] drop-shadow-xl">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <Avatar className="h-12 w-12">
            <AvatarImage src="https://i.pravatar.cc/150?img=3" />
            <AvatarFallback>LT</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <CardTitle className="text-xl">Linus Torvalds</CardTitle>
            <CardDescription>Creator of Linux</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-lg">"Revolutionary pentesting tool!"</CardContent>
      </Card> */}

{/* Pricing - Centré verticalement */ }