"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Graph } from "@phosphor-icons/react/dist/ssr";

export function LandingHeader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.header
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed top-0 z-50 w-full border-b border-gray-300 bg-[#EEEFE9]/90 backdrop-blur-md"
        >
          <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-900 text-white">
                <Graph size={14} weight="bold" />
              </div>
              <span className="text-[15px] font-extrabold tracking-tight text-gray-900">
                Nodegent
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-[13px] font-semibold">
              <a
                href="#features"
                className="hidden text-[#4D4F46] hover:text-black hover:underline underline-offset-4 sm:inline"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hidden text-[#4D4F46] hover:text-black hover:underline underline-offset-4 md:inline"
              >
                How it works
              </a>
              <Link
                href="/sign-in"
                className="hidden text-[#4D4F46] hover:text-black hover:underline underline-offset-4 sm:inline"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="brutal-border rounded-md bg-[#1D1D1D] px-3 py-1.5 text-white hover:bg-black"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
