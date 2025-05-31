import { Link } from "react-router-dom";
import  About  from "../components/About";
import { Cta } from "../components/Cta";
import  FAQ  from "../components/FAQ";
import { Features } from "../components/Features";
import { Footer } from "../components/Footer";
import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
import { Navbar } from "../components/Navbar";
import { Newsletter } from "../components/Newsletter";
import { Pricing } from "../components/Pricing";
import { ScrollToTop } from "../components/ScrollToTop";
import { Services } from "../components/Services";
import { Sponsors } from "../components/Sponsors";
import { Team } from "../components/Team";
import { Testimonials } from "../components/Testimonials";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import "./Home.css";

function Home() {
  return (
    <>

    <div className="w-full grid place-items-center">
      <Navbar />
      <Hero />
      <Sponsors />
      <About />
      <HowItWorks />
      <Features />
      <Services />
      <Cta />
      <Team />
      <FAQ />
      <Footer />
      <ScrollToTop />
      </div>

    </>
  );
}

export default Home;
