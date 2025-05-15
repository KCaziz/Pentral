import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Facebook, Instagram, Linkedin } from "lucide-react"

const teamList = [
  {
    imageUrl: "https://i.pravatar.cc/150?img=17",
    name: "Aziz Sellal",
    position: "Developer",
    socialNetworks: [
      {
        name: "Linkedin",
        url: "https://www.linkedin.com/in/aziz-sellal-792a2127b/"
      },
      {
        name: "Instagram",
        url: "https://www.instagram.com/"
      }
    ]
  },
  {
    imageUrl: "https://i.pravatar.cc/150?img=21",
    name: "Dalia Slimani",
    position: "Developer",
    socialNetworks: [
      {
        name: "Linkedin",
        url: "https://www.linkedin.com/in/dalia-slimani-08bb95300/"
      },
      {
        name: "Instagram",
        url: "https://www.instagram.com/"
      }
    ]
  },
  {
    imageUrl: "https://i.pravatar.cc/150?img=60",
    name: "GHiles Mahleb",
    position: "Project Manager",
    socialNetworks: [
      {
        name: "Linkedin",
        url: "https://www.linkedin.com/in/ghilesm/"
      },

      {
        name: "Instagram",
        url: "https://www.instagram.com/"
      }
    ]
  },
  {
    imageUrl: "https://i.pravatar.cc/150?img=63",
    name: "Abdelhafed Ammari",
    position: "Project Manager",
    socialNetworks: [
      {
        name: "Linkedin",
        url: "https://www.linkedin.com/in/abdelhafed-ammari-87801729a/"
      },
      {
        name: "Instagram",
        url: "https://www.instagram.com/"
      }
    ]
  }
]

export const Team = () => {
  const socialIcon = iconName => {
    switch (iconName) {
      case "Linkedin":
        return <Linkedin size="20" />

      case "Facebook":
        return <Facebook size="20" />

      case "Instagram":
        return <Instagram size="20" />
    }
  }

  return (
    <section id="team" className="container py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold">
        Notre{" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          Equipe
        </span>
      </h2>


      <div className="grid pt-8 md:grid-cols-2 lg:grid-cols-4 gap-8 gap-y-10">
        {teamList.map(({ imageUrl, name, position, socialNetworks }) => (
          <Card
            key={name}
            className="bg-muted/50 relative mt-8 flex flex-col justify-center items-center"
          >
            <CardHeader className="mt-8 flex justify-center items-center pb-2">
              <img
                src={imageUrl}
                alt={`${name} ${position}`}
                className="absolute -top-12 rounded-full w-24 h-24 aspect-square object-cover"
              />
              <CardTitle className="text-center">{name}</CardTitle>
              <CardDescription className="text-primary">
                {position}
              </CardDescription>
            </CardHeader>

          

            <CardFooter>
              {socialNetworks.map(({ name, url }) => (
                <div key={name}>
                  <a
                    rel="noreferrer noopener"
                    href={url}
                    target="_blank"
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm"
                    })}
                  >
                    <span className="sr-only">{name} icon</span>
                    {socialIcon(name)}
                  </a>
                </div>
              ))}
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  )
}
