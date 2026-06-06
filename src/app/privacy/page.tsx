import Link from "next/link";
import { Graph } from "@phosphor-icons/react/dist/ssr";

export const metadata = {
  title: "Privacy Policy · Nodegent",
  description: "How Nodegent collects, uses, and protects your data.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-gray-500">
          Last updated: June 2026
        </p>

        <Section title="Overview">
          <p>
            Nodegent is a campus-aware AI assistant built by students at UC
            Santa Cruz. This policy explains what data we collect, how we use
            it, and how you can control or delete it. We collect only what is
            necessary to provide the service.
          </p>
        </Section>

        <Section title="Data We Collect">
          <ul className="space-y-3">
            <Item label="Google account">
              Name, email address, and profile picture, provided through Google
              Sign-In via Clerk. We do not store your Google password.
            </Item>
            <Item label="Google Calendar">
              Calendar events from your connected Google account. This data is
              fetched on demand to display upcoming deadlines alongside your
              Canvas assignments. We do not modify or delete your calendar
              events.
            </Item>
            <Item label="Canvas academic data">
              Courses, assignments, due dates, and grades, fetched via your
              Canvas session cookies. These cookies are stored server-side and
              never exposed to the browser. We do not access or store your
              CruzID password beyond the duration of the login session.
            </Item>
            <Item label="AI chat messages">
              Messages you send to the Nodegent AI assistant. These are
              processed by a third-party LLM provider (Groq / Anthropic / OpenAI
              depending on configuration) and may be stored in our database to
              provide conversation history.
            </Item>
            <Item label="Activity log">
              A record of actions taken on your behalf (calendar reads, Canvas
              fetches, AI tool calls) with timestamps, shown to you in the
              dashboard for full transparency.
            </Item>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          <ul className="list-disc space-y-2 pl-5">
            <li>Display your academic dashboard and upcoming deadlines</li>
            <li>
              Provide the AI assistant with context about your courses and
              schedule
            </li>
            <li>Sync assignment due dates with your Google Calendar</li>
            <li>
              Show you an audit log of everything the assistant has done on your
              behalf
            </li>
          </ul>
          <p className="mt-4">
            We do not sell your data, share it with advertisers, or use it to
            train AI models.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <ul className="space-y-3">
            <Item label="Clerk">
              Handles authentication and OAuth token management. See{" "}
              <ExternalLink href="https://clerk.com/privacy">
                clerk.com/privacy
              </ExternalLink>
              .
            </Item>
            <Item label="Convex">
              Stores your academic data, chat history, and activity log. See{" "}
              <ExternalLink href="https://convex.dev/privacy">
                convex.dev/privacy
              </ExternalLink>
              .
            </Item>
            <Item label="Groq / Anthropic / OpenAI">
              Processes AI chat messages. Messages sent to these providers are
              subject to their respective privacy policies.
            </Item>
            <Item label="Vercel">
              Hosts the application. See{" "}
              <ExternalLink href="https://vercel.com/legal/privacy-policy">
                vercel.com/legal/privacy-policy
              </ExternalLink>
              .
            </Item>
          </ul>
        </Section>

        <Section title="Data Retention">
          <p>
            Your data is retained as long as your account is active. Canvas
            session cookies are stored only while your Canvas connection is
            active and are deleted when you disconnect Canvas in the dashboard.
            You may request full deletion of your account data at any time by
            contacting us.
          </p>
        </Section>

        <Section title="Your Controls">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Revoke Google Calendar access</strong> — Dashboard →
              Settings → Connected Accounts → Disconnect Google Calendar
            </li>
            <li>
              <strong>Revoke Canvas access</strong> — Dashboard → Settings →
              Connected Accounts → Disconnect Canvas
            </li>
            <li>
              <strong>Delete all your data</strong> — Email us at{" "}
              <a
                href="mailto:lucas.rafe.abdulali@gmail.com"
                className="text-blue-600 hover:underline"
              >
                lucas.rafe.abdulali@gmail.com
              </a>{" "}
              and we will remove your account and all associated data within 30
              days.
            </li>
          </ul>
        </Section>

        <Section title="Security">
          <p>
            All data is transmitted over HTTPS. Canvas session cookies and OAuth
            tokens are stored server-side and are never sent to the browser.
            Access to your data requires authentication via Clerk. We follow the
            principle of least privilege for all API scopes and tokens.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this policy as the product evolves. Significant
            changes will be communicated by updating the date at the top of this
            page. Continued use of Nodegent after changes constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email{" "}
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
            <Link href="/tos" className="hover:text-gray-700">
              Terms of Service
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

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2">
      <span className="font-semibold text-gray-900 shrink-0">{label}:</span>
      <span>{children}</span>
    </li>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 hover:underline"
    >
      {children}
    </a>
  );
}
