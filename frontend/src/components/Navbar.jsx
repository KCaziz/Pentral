import { useState } from "react"
import { useTheme } from "./theme-provider"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"

import { GitHubLogoIcon } from "@radix-ui/react-icons"
import { buttonVariants } from "./ui/button"
import { Menu, Moon, Sun } from "lucide-react"
import { ModeToggle } from "./mode-toggle"
import { LogoIcon } from "./Icons"
import { Link } from "react-router-dom"


const routeList = [
  {
    href: "#features",
    label: "Fonctionnalités"
  },
  {
    href: "#howItWorks",
    label: "Guide"
  },
  {
    href: "#team",
    label: "Equipe"
  },
  {
    href: "#faq",
    label: "FAQ"
  }
]

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  return (
    <header className="sticky border-b-[1px] top-0 z-40 w-full bg-background dark:bg-blue-100 h-30 md:h-20 p-4 sm:px-6 lg:px-8">
      <NavigationMenu className="mx-auto">
        <NavigationMenuList className="container h-14 px-4 w-screen flex justify-between ">
          <NavigationMenuItem className="font-bold flex">
            <a
              rel="noreferrer noopener"
              href="/"
              className="ml-2 font-bold text-2xl flex"
            >
              <LogoIcon />
              Pentral
            </a>
          </NavigationMenuItem>

          {/* mobile */}
          <span className="flex md:hidden">
            <ModeToggle />

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger className="px-2">
                <Menu
                  className="flex md:hidden h-5 w-5"
                  onClick={() => setIsOpen(true)}
                >
                  <span className="sr-only">Menu Icon</span>
                </Menu>
              </SheetTrigger>

              <SheetContent side={"left"}>
                <SheetHeader>
                  <SheetTitle className="font-bold text-2xl">
                    Pentral
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col justify-center items-center gap-2 mt-4">
                  {routeList.map(({ href, label }) => (
                    <a
                      rel="noreferrer noopener"
                      key={label}
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className={buttonVariants({ variant: "ghost" })}
                    >
                      {label}
                    </a>
                  ))}
                  <div className=" " >
                  <Link
                    to="/login"
                    className={buttonVariants({ variant: "secondary", className: "text-lg w-[110px]" })}
                  >
                    Connexion
                  </Link>
                  </div>
                  <div className=" " >
                  <Link
                    to="/signup"
                    className={buttonVariants({ variant: "secondary", className: "text-lg w-[110px]" })}
                  >
                    Inscription
                  </Link>
                  </div>
                  <a
                    rel="noreferrer noopener"
                    href="https://github.com/KCaziz/Pentral"
                    target="_blank"
                    className={`w-[110px] border ${buttonVariants({
                      variant: "secondary"
                    })}`}
                  >
                    {/* <GitHubLogoIcon className="mr-2 w-5 h-5" /> */}
                    Github
                  </a>
                </nav>
              </SheetContent>
            </Sheet>
          </span>

          {/* desktop */}
          <nav className="hidden md:flex gap-2">
            {routeList.map((route, i) => (
              <a
                rel="noreferrer noopener"
                href={route.href}
                key={i}
                className={`text-xl ${buttonVariants({
                  variant: "ghost"
                })}`}
              >
                {route.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex gap-2">
            <Link
              to="/login"
              className={buttonVariants({ variant: "ghost", className: "text-lg" })}
            >
              Connexion
            </Link>
            <Link
              to="/signup"
              className={buttonVariants({ variant: "ghost", className: "text-lg text-background bg-primary" })}
            >
              Inscription
            </Link>

            <a
              rel="noreferrer noopener"
              href="https://github.com/KCaziz/Pentral"
              target="_blank"
              className={`border ${buttonVariants({ variant: "primary" })} `}
            >
              <GitHubLogoIcon className="mr-2 w-5 h-5" />
              Github
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>

          </div>

        </NavigationMenuList>
      </NavigationMenu>
    </header>
  )
}
