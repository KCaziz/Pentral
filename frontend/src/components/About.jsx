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
                  About{" "}
                </span>
                Company
              </h2>
              <p className="text-2xl text-muted-foreground mt-4">
              Major player in cybersecurity in MENA region, with valuable expertise in setting-up cyber defense programs covering strategic, tactical and operational levels.
Keystone intervenes in the preventive, proactive and response aspects by offering a complete service list for multiple industries. Our expertise and our long experience is ensured by our internationally renowned experts.
keystone Team brings together cybersecurity specialists to support business in their digital development and digital transformation.

Keystone is committed to reversing this trend by helping its customers understand the threats to their information systems and how to respond to them and protect them.
              </p>
              <a href="https://www.keystone-corporation.com/" > 
              <p className="pt-3"> Visit our website : www.keystone-corporation.com</p>
              
              </a>
            </div>

            {/* <Statistics /> */}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;