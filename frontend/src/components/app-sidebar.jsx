import * as React from "react"
import { Scan, Plus, FileText, History, FolderPlus, Shield, Download, Home } from "lucide-react";
import { useEffect, useState } from "react";
import cloudSvg from "../assets/japanese-style-cloud-svgrepo-com.svg";
import { Frame, Settings2, } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
// import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
export function AppSidebar({ user, ...props }) {
  const { state, open } = useSidebar();
  const data = {
    // teams: user?.teams?.map(team => ({
    //   name: team.name,
    // })) || [],
    teams: [
      {
        name: "Team 1",
        id: "team1",
        logo: "#"
      },
      {
        name: "Team 2",
        id: "team2",
      },
    ],

    navMain: [
      {
        title: "Settings",
        url: "#",
        icon: Settings2,
        items: [
          {
            title: "General",
            url: "#",
          },
          {
            title: "Team",
            url: "#",
          },
          {
            title: "Limits",
            url: "#",
          },
        ],
      },
    ],
  };

  function handleAddProject() {
    const userId = localStorage.getItem("userId");

    fetch("http://127.0.0.1:5000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Nouveau projet",
        created_by: userId,
        team_id: user?.teams?.[0]?._id, // par défaut la première team
        company_id: user?.companies?.[0]?._id,
      }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Erreur création projet");
        }
        return response.json();
      })
      .then(data => alert("Projet créé"))
      .catch(err => {
        console.error(err);
        alert("Erreur création projet");
      });
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={`transition-all duration-200 ${state === 'collapsed' ? 'hidden' : 'inline-block'}`}>
      <a href="/dashboard" className="block transition-all duration-200">
          <button className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90  ${state === 'collapsed' ? 'justify-center px-2' : ''}`}>
            <Home className="w-5 h-5" />
            <span className={`transition-all duration-200 ${state === 'collapsed' ? 'hidden' : 'inline-block'}`}>
              Accueil
            </span>
          </button>
        </a>

        <a href="/scan" className="block transition-all duration-200">
          <button className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90  ${state === 'collapsed' ? 'justify-center px-2' : ''}`}>
            <Scan className="w-5 h-5" />
            <span className={`transition-all duration-200 ${state === 'collapsed' ? 'hidden' : 'inline-block'}`}>
              Scan Rapide
            </span>
          </button>
        </a>

      </SidebarHeader>

      <SidebarContent>
        <NavProjects projects={[
          {
            name: "Nouveau Projet",
            url: "/add-project",
            icon: FolderPlus,
            action: true,
            onClick: handleAddProject,
          },
          {
            name: "Projets",
            url: "/gestionproject",
            icon: Frame,
          },
          {
            name: "Rapports",
            url: "/report",
            icon: FileText,
          },
          {
            name: "Scans",
            url: "/gestionscans",
            icon: Shield,
            isActive: true,
          },

          {
            name: "Historique",
            url: "/historique",
            icon: History,
            isActive: false,
          },
        ]} />
      </SidebarContent>

      <SidebarFooter >
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}