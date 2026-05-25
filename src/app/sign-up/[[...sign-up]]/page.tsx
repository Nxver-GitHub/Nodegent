import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="desktop-bg flex min-h-screen items-center justify-center px-6 py-12">
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </main>
  );
}

