import {
  ArrowsClockwise,
  ChatCircleText,
  Desktop,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { FeatureCard } from "./FeatureCard";

const FEATURES = [
  {
    icon: <ArrowsClockwise size={18} weight="bold" />,
    title: "Campus Sync",
    description:
      "Pull courses and assignments from Canvas and MyUCSC, then mirror everything into Google Calendar so your week always lines up.",
  },
  {
    icon: <ChatCircleText size={18} weight="bold" />,
    title: "Campus-aware AI Chat",
    description:
      "Ask anything about your workload — your assistant already knows your courses, deadlines, and snapshot of the week.",
  },
  {
    icon: <Desktop size={18} weight="bold" />,
    title: "OS-style Desktop",
    description:
      "A focused, window-based interface designed for the rhythm of student life — daily snapshot, calendar, and courses in one place.",
  },
  {
    icon: <ShieldCheck size={18} weight="bold" />,
    title: "Full Transparency",
    description:
      "Every agent action is logged with timestamp and scope. Toggle access at any time and revoke credentials instantly.",
  },
];

export function FeatureGrid() {
  return (
    <section className="w-full px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Built for the way students actually study.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] text-[#4D4F46]">
            One trusted surface for your academic life — your data, your keys,
            your audit trail.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
