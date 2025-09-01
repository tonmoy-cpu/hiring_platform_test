"use client";

import Navbar from "@/components/navbar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ResumeExtraction() {
  const [resumeFile, setResumeFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState(""); // Add job ID state
  const router = useRouter();

  const handleFileChange = (e) => {
    setResumeFile(e.target.files[0]);
    setError(null); // Reset error on new file selection
  };

  const handleExtract = async () => {
    if (!resumeFile) {
      toast.error("Please upload a resume file"); // Use toast
      return;
    }

    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("resume", resumeFile);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:5000/api/resume/extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.msg || "Extraction failed");
      setParsedData(data.parsedData);
      toast.success("Resume parsed and added to your profile!"); // Use toast
    } catch (err) {
      console.error("Error extracting resume:", err.message);
      setError(err.message);
      toast.error(`Error: ${err.message}`); // Use toast
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobId || !parsedData) {
      toast.error("Please enter a job ID and extract a resume first."); // Use toast
      return;
    }

    const resumeJson = JSON.stringify(parsedData);
    const base64Resume = Buffer.from(resumeJson).toString("base64");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:5000/api/resume/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId, resume: base64Resume }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success("Resume analyzed successfully!"); // Use toast
      console.log("Analysis result:", data); // Display or handle result (e.g., modal)
    } catch (err) {
      console.error("Analysis failed:", err.message);
      toast.error(`Analysis failed: ${err.message}`); // Use toast
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background"> {/* Use bg-background */}
      <Navbar />
      <main className="flex-1 p-6">
        <div className="bg-accent p-6 rounded-lg mb-8 shadow-md"> {/* Use bg-accent */}
          <h1 className="text-3xl font-semibold text-center uppercase text-foreground">Resume Extraction</h1> {/* Use text-foreground */}
        </div>
        <div className="bg-secondary p-8 rounded-lg shadow-md text-dark-contrast"> {/* Use bg-secondary and text-dark-contrast */}
          <label htmlFor="resume" className="block font-semibold mb-2">
            Upload Resume (PDF)
          </label>
          <input
            type="file"
            id="resume"
            accept=".pdf"
            onChange={handleFileChange}
            className="input-field" // Use input-field
            disabled={isLoading}
          />
          <button
            onClick={handleExtract}
            className="btn-primary mt-4" // Use btn-primary
            disabled={isLoading}
          >
            {isLoading ? "Extracting..." : "Extract"}
          </button>
          {error && <p className="text-danger mt-4">{error}</p>} {/* Use text-danger */}
        </div>
        {parsedData && (
          <div className="mt-8 bg-secondary p-6 rounded-lg shadow-md text-dark-contrast"> {/* Use bg-secondary and text-dark-contrast */}
            <h2 className="text-xl font-bold text-text-dark mb-4">Parsed Resume</h2> {/* Use text-dark */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold">Contact</h3>
                <p>
                  {parsedData.contact?.name || "N/A"}<br />
                  {parsedData.contact?.email || "N/A"}<br />
                  {parsedData.contact?.phone || "N/A"}
                </p>
              </div>
              <div>
                <h3 className="font-bold">Skills</h3>
                <ul className="list-disc pl-4">
                  {parsedData.skills?.length > 0
                    ? parsedData.skills.map((s, i) => <li key={i}>{s || "N/A"}</li>)
                    : <li>N/A</li>}
                </ul>
              </div>
              <div>
                <h3 className="font-bold">Experience</h3>
                {parsedData.experience?.length > 0
                  ? parsedData.experience.map((e, i) => (
                      <p key={i}>
                        {e.title || "N/A"} at {e.company || "N/A"} ({e.years || "N/A"})
                      </p>
                    ))
                  : <p>N/A</p>}
              </div>
              <div>
                <h3 className="font-bold">Education</h3>
                {parsedData.education?.length > 0
                  ? parsedData.education.map((e, i) => (
                      <p key={i}>
                        {e.degree || "N/A"}, {e.school || "N/A"} ({e.year || "N/A"})
                      </p>
                    ))
                  : <p>N/A</p>}
              </div>
            </div>
            <div className="mt-4">
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="Enter Job ID to Analyze"
                className="input-field mb-2" // Use input-field
              />
              <button
                onClick={handleAnalyze}
                className="btn-primary mt-2" // Use btn-primary
                disabled={isLoading}
              >
                Analyze Resume
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
