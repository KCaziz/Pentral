import { Radar } from "lucide-react"
import key from "../assets/Key-W-logo.png"

const sponsors = [
  {
    icon: <Radar size={34} />,
    name: "Sponsor 1"
  }
]

export const Sponsors = () => {
  return (
    <section id="sponsors" className="container pt-12 sm:py-16">
      <h2 className="text-center text-lg lg:text-4xl font-bold mb-8 ">
        <span className="text-primary"> Investors </span> and founders
      </h2>
      {/* max-w-[200px] */}
      <div className=" mx-auto flex flex-wrap justify-center items-center bg-black gap-4 p-4">
  <img src={key} alt="logo" className="w-auto h-auto" />
</div>
    </section>
  )
}
