import { Link, useParams } from "react-router-dom";

export function JobDetailPage() {
  const { jobId } = useParams();
  return (
    <div style={{ padding: 24 }}>
      <p><Link to="/jobs">← Back</Link></p>
      <h1>Job Detail</h1>
      <p>Job ID: {jobId}</p>
    </div>
  );
}
