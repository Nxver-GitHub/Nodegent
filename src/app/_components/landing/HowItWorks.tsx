import {
  PlugsConnected,
  ArrowsClockwise,
  ChatCircleText,
} from "@phosphor-icons/react/dist/ssr";

const STEPS = [
  {
    number: "01",
    icon: <PlugsConnected size={22} weight="bold" />,
    accent: "bg-[#CD8407]",
    title: "Connect",
    description:
      "Sign in once with your campus account. Nodegent links Canvas, your campus portal, and Google Calendar with audited, revocable access.",
  },
  {
    number: "02",
    icon: <ArrowsClockwise size={22} weight="bold" />,
    accent: "bg-[#3B82F6]",
    title: "Sync",
    description:
      "Courses, assignments, exams, and class times stream into a unified dashboard — sorted by urgency, mirrored to your calendar.",
  },
  {
    number: "03",
    icon: <ChatCircleText size={22} weight="bold" />,
    accent: "bg-[#F34D52]",
    title: "Chat",
    description:
      "Ask your assistant about deadlines, study plans, or workload. Every answer is grounded in your actual campus data.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p className="mb-3 inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800">
            How it works
          </p>
          <h2 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Three steps to a calmer quarter.
          </h2>
          <div className="brutal-border mt-5 inline-block max-w-2xl rounded-md bg-white px-5 py-4">
            <p className="text-[15px] leading-relaxed text-gray-800">
              No new accounts to manage. No data shipped to third parties. Just
              your campus, organized.
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="brutal-border-lg flex flex-col gap-4 rounded-lg bg-white p-6"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-md text-white ${step.accent}`}
                >
                  {step.icon}
                </div>
                <span className="font-mono text-3xl font-extrabold text-[#E1D7C2]">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
                {step.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-[#4D4F46]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
