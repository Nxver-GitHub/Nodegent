import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="desktop-bg flex min-h-screen items-center justify-center px-6 py-12">
      <SignIn
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </main>
  );
}

