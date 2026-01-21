import FriendProfileView from "@/components/friends/FriendProfileView";

export const metadata = {
  title: "Friend Profile | Quran & Sunnah",
  description: "View your friend's profile.",
};

type PageProps = {
  params: Promise<{ uid: string }>;
};

export default async function Page({ params }: PageProps) {
  const { uid } = await params;
  return <FriendProfileView uid={uid} />;
}
