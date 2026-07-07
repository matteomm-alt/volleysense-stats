import { createFileRoute } from "@tanstack/react-router";
import { TeamDetailPage } from "./coach.team.$teamId";

export const Route = createFileRoute("/coach/team/$teamId/")({
  component: TeamDetailPage,
});