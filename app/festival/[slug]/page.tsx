import { notFound } from "next/navigation";
import FestivalGame from "@/components/game/FestivalGame";
import { festivalById, festivalGames } from "@/lib/game/festival";
export function generateStaticParams(){return festivalGames.map(game=>({slug:game.id}));}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const game=festivalById(slug);if(!game)notFound();return <FestivalGame key={game.id} game={game}/>;}
