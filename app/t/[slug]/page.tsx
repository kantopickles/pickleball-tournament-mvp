import TournamentScreen from "@/components/TournamentScreen";

export default function TournamentPage({ params }: { params: { slug: string } }) {
  return <TournamentScreen slug={params.slug} />;
}
