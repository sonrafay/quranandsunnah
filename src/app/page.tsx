import Hero from "@/components/site/Hero";
import About from "@/components/site/About";
import VersesCloud from "@/components/site/VersesCloud";
import WorkWithUs from "@/components/site/WorkWithUs";
import FAQ from "@/components/site/FAQ";
import Footer from "@/components/site/Footer";

export default function Page() {
  return (
    <main className="min-h-screen text-foreground">
      <section id="home" className="scroll-mt-24">
        <Hero />
      </section>

      <section id="about" className="scroll-mt-24">
        <About />
      </section>

      <section id="verses" className="scroll-mt-24">
        <VersesCloud />
      </section>

      <section id="work" className="scroll-mt-24">
        <WorkWithUs />
      </section>

      <section id="faq" className="scroll-mt-24">
        <FAQ />
      </section>

      <section id="socials" className="scroll-mt-24">
        <Footer />
      </section>
    </main>
  );
}
