import { SignupForm } from "../components/Signup"
import { Link } from "react-router-dom"
export default function Signup() {
  return (
<div>
  {/* <div className="p-4 flex justify-between items-center">
    <Link
      to="/"
      className="text-xl px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-bold hover:text-primary/80 transition-colors duration-200 flex items-center"
    >
      Home
    </Link>

    <Link
      to="/dashboard"
      className="text-xl px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-bold hover:text-primary/80 transition-colors duration-200 flex items-center"
    >
      Dashboard
    </Link>
    
  </div> */}

  <div className="flex min-h-[calc(100svh-73px)] w-full items-center justify-center p-6 md:p-10">
    <div className="w-full max-w-sm">
      <SignupForm />
    </div>
  </div>
</div>
  )
}