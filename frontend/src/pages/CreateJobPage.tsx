import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createJob } from "../api/jobs";
import { CreateJobForm } from "../components/forms/CreateJobForm";

export function CreateJobPage() {
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(args: { type: string; payload: unknown }) {
    setSubmitting(true);
    try {
      const job = await createJob(args);
      nav(`/jobs/${job.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <p>
        <Link to="/jobs">← Back</Link>
      </p>
      <h1>Create Job</h1>

      <div style={{ marginTop: 16 }}>
        <CreateJobForm onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </div>
  );
}
