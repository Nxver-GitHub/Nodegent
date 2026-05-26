/**
 * Stylized TI-84-style calculator used as a desk decoration on the
 * landing page. CSS-only, no interactivity — a quiet nod to every
 * student who’s pulled an all-nighter with one of these.
 */
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
      <div className="ti84-brand">TI · 84 Plus</div>
      <div className="ti84-screen">
        <p className="ti84-screen-line">&gt; hello, surya</p>
        <p className="ti84-screen-line">&gt; assignments_due()</p>
        <p className="ti84-screen-line">  3</p>
        <p className="ti84-screen-line">&gt; <span className="blink inline-block">_</span></p>
      </div>
      <div className="ti84-keys">
        {KEY_LAYOUT.flat().map((variant, i) => (
          <span
            key={i}
            className={`ti84-key ${
              variant === "yellow"
                ? "ti84-key-yellow"
                : variant === "blue"
                  ? "ti84-key-blue"
                  : variant === "green"
                    ? "ti84-key-green"
                    : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
