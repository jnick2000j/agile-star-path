import { Navigate } from "react-router-dom";

/** Consolidated into the unified Wizards hub (Draft with AI tab). */
export default function AIWizards() {
  return <Navigate to="/wizards?tab=ai" replace />;
}
