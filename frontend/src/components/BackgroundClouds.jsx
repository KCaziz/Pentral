import cloudSvg from "../assets/japanese-style-cloud-svgrepo-com (2).svg";

const cloudPositions = [
  { top: "top-4", left: "left-[40%]" },
  { top: "top-16", left: "left-[60%]" },
  { top: "top-32", left: "left-[75%]" },
  { top: "top-[50%]", left: "left-[50%]" },
  { top: "top-[70%]", left: "left-[65%]" },
  { bottom: "bottom-10", left: "left-[70%]" },
  { bottom: "bottom-16", right: "right-4" },
  { top: "top-[30%]", right: "right-8" },

  { top: "top-4", left: "right-[40%]" },
  { top: "top-32", left: "right-[75%]" },
  { top: "top-[50%]", left: "right-[50%]" },
  { top: "top-[70%]", left: "right-[65%]" },
  { bottom: "bottom-10", left: "right-[70%]" },

];

export default function BackgroundClouds() {
  return (
    <div className=" absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {cloudPositions.map((pos, index) => (
        <img
          key={index}
          src={cloudSvg}
          alt="nuage japonais"
          className={`absolute w-48 opacity-20  ${
            pos.top || ""
          } ${pos.bottom || ""} ${pos.left || ""} ${pos.right || ""}`}
        />
      ))}
    </div>
  );
}
