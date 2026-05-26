import {
  ArrowsClockwise,
  ChatCircleText,
  Desktop,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { FeatureCard } from "./FeatureCard";

const FEATURES = [
  {
    icon: <ArrowsClockwise size={20} weight="bold" />,
    title: "Campus Sync",
    description:
      "Pull courses and assignments from Canvas and your campus portal, then mirror everything into Google Calendar so your week always lines up.",
    accent: "amber" as const,
  },
  {
    icon: <ChatCircleText size={20} weight="bold" />,
    title: "Campus-aware AI Chat",
    description:
      "Ask anything about your workload — your assistant already knows your courses, deadlines, and snapshot of the week.",
    accent: "blue" as const,
  },
  {
    icon: <Desktop size={20} weight="bold" />,
    title: "OS-style Desktop",
    description:
      "A focused, window-based interface designed for the rhythm of student life — daily snapshot, calendar, and courses in one place.",
    accent: "red" as const,
  },
  {
    icon: <ShieldCheck size={20} weight="bold" />,
    title: "Full Transparency",
    description:
      "Every agent action is logged with timestamp and scope. Toggle access at any time and revoke credentials instantly.",
    accent: "dark" as const,
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="w-full px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p className="mb-3 inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-800">
            Features
          </p>
          <h2 className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Built for the way students actually study.
          </h2>
          <div className="brutal-border mt-5 inline-block max-w-2xl rounded-md bg-white px-5 py-4">
            <p className="text-[15px] leading-relaxed text-gray-800">
              One trusted surface for your academic life — your data, your keys,
              your audit trail. No noise, no nagging, no rented agents.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              accent={feature.accent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
