import React from "react";

const cards = [
  {
    title: "Card one",
    desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    gradientFrom: "#ffbc00",
    gradientTo: "#ff0058",
  },
  {
    title: "Card two",
    desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    gradientFrom: "#03a9f4",
    gradientTo: "#ff0058",
  },
  {
    title: "Card three",
    desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    gradientFrom: "#4dff03",
    gradientTo: "#00d0ff",
  },
];

export default function SkewCards() {
  return (
    <>
      <div className="flex min-h-screen flex-wrap items-center justify-center bg-dark py-10">
        {cards.map(({ title, desc, gradientFrom, gradientTo }, idx) => (
          <div
            key={idx}
            className="group relative m-[40px_30px] h-[400px] w-[320px] transition-all duration-500"
          >
            <span
              className="absolute left-[50px] top-0 h-full w-1/2 skew-x-[15deg] rounded-lg transition-all duration-500 group-hover:left-[20px] group-hover:w-[calc(100%-90px)] group-hover:skew-x-0"
              style={{
                background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
              }}
            />
            <span
              className="absolute left-[50px] top-0 h-full w-1/2 skew-x-[15deg] rounded-lg blur-[30px] transition-all duration-500 group-hover:left-[20px] group-hover:w-[calc(100%-90px)] group-hover:skew-x-0"
              style={{
                background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
              }}
            />

            <span className="pointer-events-none absolute inset-0 z-10">
              <span className="animate-blob absolute left-0 top-0 h-0 w-0 rounded-lg bg-[rgba(255,255,255,0.1)] opacity-0 shadow-[0_5px_15px_rgba(0,0,0,0.08)] backdrop-blur-[10px] transition-all duration-100 group-hover:left-[50px] group-hover:top-[-50px] group-hover:h-[100px] group-hover:w-[100px] group-hover:opacity-100" />
              <span className="animate-blob animation-delay-1000 absolute bottom-0 right-0 h-0 w-0 rounded-lg bg-[rgba(255,255,255,0.1)] opacity-0 shadow-[0_5px_15px_rgba(0,0,0,0.08)] backdrop-blur-[10px] transition-all duration-500 group-hover:bottom-[-50px] group-hover:right-[50px] group-hover:h-[100px] group-hover:w-[100px] group-hover:opacity-100" />
            </span>

            <div className="relative left-0 z-20 rounded-lg bg-[rgba(255,255,255,0.05)] p-[20px_40px] text-white shadow-lg backdrop-blur-[10px] transition-all duration-500 group-hover:left-[-25px] group-hover:p-[60px_40px]">
              <h2 className="mb-2 text-2xl">{title}</h2>
              <p className="mb-2 text-lg leading-relaxed">{desc}</p>
              <a
                href="#"
                className="inline-block rounded bg-white px-3 py-2 text-lg font-bold text-black hover:border hover:border-[rgba(255,0,88,0.4)] hover:bg-[#ffcf4d] hover:shadow-md"
              >
                Read More
              </a>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translateY(10px); }
          50% { transform: translate(-10px); }
        }
        .animate-blob { animation: blob 2s ease-in-out infinite; }
        .animation-delay-1000 { animation-delay: -1s; }
        .shadow-\\[0_5px_15px_rgba\\(0,0,0,0.08\\) { box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
      `}</style>
    </>
  );
}
