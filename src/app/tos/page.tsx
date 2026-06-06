import Link from "next/link";
import { Graph } from "@phosphor-icons/react/dist/ssr";

export const metadata = {
  title: "Terms of Service · Nodegent",
  description: "Terms governing your use of Nodegent.",
};

export default function TosPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-900 text-white">
              <Graph size={13} weight="bold" />
            </div>
            <span className="font-extrabold text-gray-900">Nodegent</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-gray-500">Last updated: June 2026</p>

        <Section title="Acceptance of Terms">
          <p>
            By signing in to or using Nodegent, you agree to these Terms of
            Service. If you do not agree, do not use the service. Nodegent is a
            student-built project created for educational purposes at UC Santa
            Cruz.
          </p>
        </Section>

        <Section title="Eligibility">
          <p>
            Nodegent is intended for college students. By using the service, you
            represent that you are a current college student or an authorized
            tester. You must be at least 13 years old to use Nodegent.
          </p>
        </Section>

        <Section title="Your Account">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              You are responsible for keeping your account credentials secure.
            </li>
            <li>
              You may not share your account or allow others to access the
              service through your credentials.
            </li>
            <li>
              You are responsible for all activity that occurs under your
              account.
            </li>
          </ul>
        </Section>

        <Section title="Connected Services">
          <p>
            Nodegent integrates with third-party services including Canvas,
            Google Calendar, and AI providers. By connecting these services you
            authorize Nodegent to access them on your behalf within the scopes
            you grant. You can revoke access at any time from the dashboard. We
            are not responsible for the availability, accuracy, or conduct of
            these third-party services.
          </p>
        </Section>

        <Section title="Acceptable Use">
          <p>You agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Use Nodegent to violate UCSC's academic integrity policies</li>
            <li>Attempt to access another user's data or account</li>
            <li>
              Reverse-engineer, scrape, or abuse the service in ways that
              degrade performance for other users
            </li>
            <li>
              Use the AI assistant to generate content that is illegal, harmful,
              or violates university policy
            </li>
            <li>
              Submit false or misleading information to obtain unauthorized
              access
            </li>
          </ul>
        </Section>

        <Section title="AI-Generated Content">
          <p>
            Nodegent uses large language models to generate responses. AI
            output may be inaccurate, incomplete, or out of date. You are solely
            responsible for verifying any information provided by the AI
            assistant before relying on it for academic or other decisions. We
            make no warranty about the accuracy or fitness of AI-generated
            content.
          </p>
        </Section>

        <Section title="Intellectual Property">
          <p>
            Nodegent and its underlying code are the work of the project team.
            Your academic data (Canvas, Google Calendar) remains yours. You
            grant Nodegent a limited license to process your data solely for
            the purpose of providing the service.
          </p>
        </Section>

        <Section title="Disclaimer of Warranties">
          <p>
            Nodegent is provided <strong>"as is"</strong> without warranties of
            any kind, express or implied. We do not guarantee that the service
            will be uninterrupted, error-free, or that data will never be lost.
            Use at your own risk.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            To the fullest extent permitted by law, the Nodegent team shall not
            be liable for any indirect, incidental, special, or consequential
            damages arising from your use of the service, including but not
            limited to loss of academic data, missed deadlines, or reliance on
            AI-generated content.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            We may suspend or terminate your access at any time if you violate
            these terms. You may stop using Nodegent at any time and request
            deletion of your data by contacting us.
          </p>
        </Section>

        <Section title="Changes to These Terms">
          <p>
            We may update these terms as the project evolves. The updated date
            at the top of this page reflects the most recent revision. Continued
            use after changes constitutes acceptance of the new terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Email{" "}
            <a
              href="mailto:lucas.rafe.abdulali@gmail.com"
              className="text-blue-600 hover:underline"
            >
              lucas.rafe.abdulali@gmail.com
            </a>
            .
          </p>
        </Section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Nodegent · UC Santa Cruz</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-700">
              Privacy Policy
            </Link>
            <Link href="/" className="hover:text-gray-700">
              Back to home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}
