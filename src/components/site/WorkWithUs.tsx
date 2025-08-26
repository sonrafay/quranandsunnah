import Link from "next/link";
import { Mail, Instagram, Youtube, MessageSquare, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkWithUs() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-2xl font-semibold">Work with us</h3>
        <p className="text-muted-foreground mt-3">
          Reach out if you want to design, build, review Arabic text, or help with outreach.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="mailto:thequranandsunnah1@gmail.com">
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="https://www.instagram.com/thequranandsunnah1/" target="_blank">
              <Instagram className="mr-2 h-4 w-4" />
              Instagram
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="https://www.tiktok.com/@thequranandsunnah.com" target="_blank">
              <MessageSquare className="mr-2 h-4 w-4" />
              TikTok
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="https://www.youtube.com/@theQuranandSunnah1" target="_blank">
              <Youtube className="mr-2 h-4 w-4" />
              YouTube
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="https://discord.gg/WKtX3BrZ" target="_blank">
              <MessageSquare className="mr-2 h-4 w-4" />
              Discord
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="https://github.com/" target="_blank">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
