"use client";

interface GreetingHeaderProps {
  name: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function GreetingHeader({ name }: GreetingHeaderProps) {
  const firstName = name.split(" ")[0];

  return (
    <div className="pb-3 border-b border-gray-100">
      <p className="text-[11px] font-mono text-gray-400 uppercase tracking-widest">
        {formatDate()}
      </p>
      <h2 className="mt-0.5 text-[15px] font-extrabold text-gray-900 leading-tight">
        {getGreeting()}, {firstName}
      </h2>
    </div>
  );
}
