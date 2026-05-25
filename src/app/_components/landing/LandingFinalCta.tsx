import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export function LandingFinalCta() {
  return (
    <section className="w-full px-6 py-20">
      <div className="brutal-border mx-auto max-w-3xl rounded-xl bg-white p-10 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Stop juggling tabs. Start your quarter.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#4D4F46]">
          Sign up with your campus account and Nodegent will set up your
          dashboard in minutes.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="brutal-border inline-flex items-center gap-2 rounded-md bg-[#CD8407] px-6 py-3 text-sm font-bold text-white hover:bg-[#B57206]"
          >
            Create your dashboard
            <ArrowRight size={14} weight="bold" />
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-semibold text-[#4D4F46] underline-offset-4 hover:text-black hover:underline"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}
