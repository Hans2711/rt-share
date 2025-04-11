// src/routes/home/+page.tsx
import type { Route } from "./+types/home";
import { RtShare } from "./rt-share/+component";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Real-time Share" },
    { name: "description", content: "Real-time file and text sharing" },
  ];
}

export default function Home() {
  return <RtShare />;
}
