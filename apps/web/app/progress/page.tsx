import ProgressDashboard from "@/components/progress-dashboard";

export default function ProgressPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  return <ProgressDashboard apiBaseUrl={apiBaseUrl} />;
}
