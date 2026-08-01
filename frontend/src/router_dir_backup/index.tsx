import { createBrowserRouter } from "react-router";
import { JobsPage } from "../pages/JobsPage";
import { JobDetailPage } from "../pages/JobDetailPage";
import { CreateJobPage } from "../pages/CreateJobPage";

export const router = createBrowserRouter([
  { path: "/", element: <JobsPage /> },
  { path: "/jobs", element: <JobsPage /> },
  { path: "/jobs/new", element: <CreateJobPage /> },
  { path: "/jobs/:jobId", element: <JobDetailPage /> },
]);
