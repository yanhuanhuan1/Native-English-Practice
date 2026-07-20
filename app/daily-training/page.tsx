import type { Metadata } from "next";
import { DailyEnglishTraining } from "@/components/DailyEnglishTraining";

export const metadata: Metadata = {
  title: "每日英语训练 | Daily English Training",
  description: "基于真实资源的每日英语听说读词汇训练。"
};

export default function DailyTrainingPage() {
  return <DailyEnglishTraining />;
}
