import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"

const FAQList = [
  {
    question: "Pentral est-il gratuit ?",
    answer: "Oui, totalement gratuit, sans limites d'utilisation et sans publicité. Un outil open-source conçu pour la communauté cybersécurité.",
    value: "pricing"
  },
  {
    question: "Quelles technologies composent Pentral ?",
    answer: "Notre stack technique combine : Frontend (React + Vite + ShadCN/ui), Backend (Flask RESTful), Base de données (MongoDB) et Infrastructure (Docker).",
    value: "technologies"
  },
  {
    question: "Quel modèle de langage utilise Pentral ?",
    answer: "Mistral 7B (Quantenisation 4bit K_M).",
    value: "llm"
  },
  {
    question: "Quel est l'origine du projet Pentral ?",
    answer: "Projet de fin d'étude développé à l'USTHB (Alger) avec l'encadrement et le suivis de Keystone. Code source disponible sur GitHub sous licence MIT.",
    value: "project"
  },
  {
    question: "Pentral remplace-t-il un pentester humain ?",
    answer: "Non, c'est un assistant qui automatise les tâches répétitives. Les experts doivent valider les résultats et les prendre pour ce qu'ils sont des résultats générés par une IA.",
    value: "human-expert"
  }
];

export const FAQ = () => {
  return (
    <section id="faq" className="container py-12 sm:py-16">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        Foire aux{" "}
        <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
          Questions
        </span>
      </h2>

      <Accordion type="single" collapsible className="w-full AccordionRoot">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem key={value} value={value}>
            <AccordionTrigger className="text-left">
              {question}
            </AccordionTrigger>

            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <h3 className="font-medium mt-4">
        Encore des questions?{" "}
        <a
          rel="noreferrer noopener"
          href="mailto:azizsellal.dz@gmail.com"
          className="text-primary transition-all border-primary hover:border-b-2"
        >
          Contactez-nous !
        </a>
      </h3>
    </section>
  )
}


export default FAQ