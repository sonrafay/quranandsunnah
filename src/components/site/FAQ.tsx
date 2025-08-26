// =============================
// FILE: components/site/FAQ.tsx
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h3 className="text-2xl font-semibold text-center">Frequently asked questions</h3>
      <Accordion type="single" collapsible className="mt-6">
        <AccordionItem value="q1">
          <AccordionTrigger>Is the app free</AccordionTrigger>
          <AccordionContent>
            Yes. The app is free for everyone. We may accept donations to cover costs. Extra funds will go to charity.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="q2">
          <AccordionTrigger>Which features will be in the first release</AccordionTrigger>
          <AccordionContent>
            Clean reading for Quran with translations. Hadith browsing. Bookmarks. Search. Night mode. We will add more based on feedback.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="q3">
          <AccordionTrigger>Will there be iOS and Android apps</AccordionTrigger>
          <AccordionContent>
            Yes. We will ship the web first, then mobile. We will keep the design the same.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="q4">
          <AccordionTrigger>How can I help</AccordionTrigger>
          <AccordionContent>
            You can test features, report issues, or contribute code and design. You can also help with Arabic review and outreach. Contact us to join.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="q5">
          <AccordionTrigger>Which sources will you use</AccordionTrigger>
          <AccordionContent>
            We will follow the Quran Foundation API for Quran and a trusted Hadith API. We will add source notes inside the app for clarity.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}