import type { Metadata } from "next";
import { ProgressSimulator } from "@/components/ProgressSimulator";

export const metadata: Metadata = {
  title: "進行シミュレーター | Kanto Pickle's Drow",
  description: "会場時間、コート数、試合時間から大会の試合数と参加定員を試算します。"
};

export default function SimulatorPage() {
  return <ProgressSimulator />;
}
