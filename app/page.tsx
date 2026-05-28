import { PracticeApp } from "@/components/PracticeApp";

export default function Home() {
  return <PracticeApp initialAiConfigured={!!process.env.API_KEY?.trim()} />;
}
