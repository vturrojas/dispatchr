import { Navigate, createBrowserRouter } from "react-router-dom";
import { JobsPage } from "./pages/JobsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { CreateJobPage } from "./pages/CreateJobPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/jobs" replace /> },
  { path: "/jobs", element: <JobsPage /> },
  { path: "/jobs/new", element: <CreateJobPage /> },
  { path: "/jobs/:jobId", element: <JobDetailPage /> },
  {
    path: "*",
    element: (
      <div style={{ padding: 24 }}>
        <h1>404</h1>
        <p>Route not found</p>
      </div>
    ),
  },
]);
