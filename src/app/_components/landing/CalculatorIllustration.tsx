const KEY_LAYOUT: Array<"default" | "yellow" | "blue" | "green">[] = [
  ["yellow", "blue", "default", "default", "default"],
  ["default", "default", "default", "default", "default"],
  ["default", "default", "default", "default", "default"],
  ["default", "default", "default", "default", "default"],
  ["default", "default", "default", "default", "green"],
];

export function CalculatorIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`ti84 ${className}`} aria-hidden="true">
      <div className="ti84-brand">TI · 84 Plus CE</div>
      <div className="ti84-screen">
        <div className="ti84-screen-topbar">nodegent</div>
        <p className="ti84-screen-line ti84-line-red">&gt; 3 due today</p>
        <p className="ti84-screen-line ti84-line-amber">&gt; exam in 2 days</p>
        <p className="ti84-screen-line ti84-line-green">  AI ready ✓</p>
        <p className="ti84-screen-line">&gt; <span className="blink inline-block">_</span></p>
      </div>
      <div className="ti84-keys">
        {KEY_LAYOUT.flat().map((variant, i) => (
          <span
            key={i}
            className={`ti84-key ${
              variant === "yellow" ? "ti84-key-yellow" :
              variant === "blue"   ? "ti84-key-blue"   :
              variant === "green"  ? "ti84-key-green"  : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
