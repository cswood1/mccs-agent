import Script from "next/script";

// A stand-in for an MCCS installation homepage, so we can judge the widget in
// context. Layout and copy are placeholders, not the real site.

const nav = ["Fitness", "Dining", "Lodging", "Child & Youth", "Education", "Family Readiness", "Recreation", "Events"];

const quickLinks = [
  { title: "Fitness Centers", body: "Gyms, pools, group classes, and hours." },
  { title: "Child & Youth Programs", body: "Child development centers, school age care, and teen programs." },
  { title: "Education Center", body: "Tuition assistance, testing, and academic counseling." },
  { title: "Family Readiness", body: "Relocation help, new parent support, and deployment resources." },
  { title: "Dining", body: "Clubs, grills, and snack bars on base." },
  { title: "Lodging", body: "Rooms and suites for PCS, TDY, and leisure travel." },
];

const events = [
  { date: "Nov 1", title: "Fall Festival", where: "Sample Park" },
  { date: "Nov 8", title: "5K Fun Run", where: "Fitness Center A" },
  { date: "Nov 10", title: "Marine Corps Birthday", where: "Base-wide" },
];

export default function Home() {
  return (
    <>
      <div className="bg-gold px-4 py-2 text-center text-sm font-medium text-black">
        Prototype mock of an MCCS installation site, for testing the assistant. Not the official site.
      </div>

      <header className="bg-scarlet text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">Marine Corps Community Services</p>
            <p className="text-2xl font-bold">MCCS Quantico</p>
          </div>
          <div className="hidden text-sm sm:block">Marine Corps Base Quantico, Virginia</div>
        </div>
        <nav aria-label="Main" className="bg-scarlet-dark">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 text-sm">
            {nav.map((item) => (
              <li key={item}>
                <a href="#" className="block whitespace-nowrap px-3 py-3 hover:bg-white/10">
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-br from-neutral-800 to-neutral-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <h1 className="max-w-2xl text-3xl font-bold sm:text-5xl">Everything you need on base, in one place.</h1>
            <p className="mt-4 max-w-xl text-lg text-neutral-300">
              Fitness, family programs, dining, lodging, and events for Marines, families, retirees, and civilians.
            </p>
            <p className="mt-6 text-sm text-gold">Try the assistant: tap “Ask me anything” in the corner.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold">Programs & services</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((q) => (
              <a key={q.title} href="#" className="rounded-lg border border-neutral-200 p-5 hover:border-scarlet hover:shadow-sm">
                <h3 className="font-semibold text-scarlet">{q.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{q.body}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="bg-neutral-100">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="text-2xl font-bold">Upcoming events</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {events.map((e) => (
                <li key={e.title} className="flex gap-4 rounded-lg bg-white p-4">
                  <span className="rounded bg-scarlet px-3 py-2 text-center text-sm font-bold text-white">{e.date}</span>
                  <span>
                    <span className="block font-semibold">{e.title}</span>
                    <span className="text-sm text-neutral-600">{e.where}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="bg-neutral-900 px-4 py-8 text-center text-sm text-neutral-400">
        Prototype for the NPS hackathon. Not affiliated with or endorsed by MCCS.
      </footer>

      {/* The same one-tag embed a real MCCS site would use. */}
      <Script src="/widget.js" data-installation="quantico" strategy="afterInteractive" />
    </>
  );
}
