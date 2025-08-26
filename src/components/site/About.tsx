"use client";

import { motion } from "framer-motion";

export default function About() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="text-3xl font-bold">Our mission</h2>
        <p className="text-muted-foreground mt-5 leading-relaxed">
          Many Quran apps work well. Not many hadith apps reach the same level. Many other tools are
          spread across many places. We want to bring them together in one home.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          The app will be one hundred percent free. There are costs for servers and support. We ask for
          donations from those who are able. Treat it as sadaqah jariyah. You make it possible for everyone
          to learn. Developers volunteer with the same goal and are content with this.
        </p>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Any extra funds will be shared with charities that serve Muslims. We plan to support our brothers
          and sisters in Gaza first.
        </p>
      </motion.div>
    </section>
  );
}
