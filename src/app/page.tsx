import Link from "next/link";
import { Show } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Nodegent
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Your campus-aware AI assistant
        </p>

        <div className="mt-8">
          <Show
            when="signed-out"
            fallback={
              <Link
                href="/dashboard"
                className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Go to Dashboard
              </Link>
            }
          >
            <Link
              href="/sign-in"
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Sign In
            </Link>
          </Show>
        </div>
      </div>
    </main>
  );
}
