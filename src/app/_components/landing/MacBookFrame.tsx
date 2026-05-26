import type { ReactNode } from "react";

/**
 * Decorative MacBook chassis used to wrap the interactive dashboard mockup
 * on the landing hero. Pure CSS — lid + bezel + camera notch + keyboard deck.
 * Adds the “student on their laptop” layer that makes Nodegent’s OS-style
 * dashboard read as a real product running on a real device.
 */
export function MacBookFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative inline-block w-full max-w-[640px]">
      <div className="macbook-lid">
        <div className="macbook-bezel">
          <div className="macbook-screen">{children}</div>
        </div>
      </div>
      <div className="macbook-deck" aria-hidden="true" />
    </div>
  );
}
