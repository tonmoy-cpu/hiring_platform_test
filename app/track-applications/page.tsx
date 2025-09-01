"use client";

import Navbar from "@/components/navbar";
import { CircleUser, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function TrackApplications() {
  const [applications, setApplications] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const fetchApplications = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/");
        return;
      }
      try {
        const res = await fetch("http://localhost:5000/api/applications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();
        setApplications(data);
      } catch (err) {
        console.error("Error fetching applications:", err);
        toast.error(`Error loading applications: ${err.message}`);
        if (err.message.includes("401")) {
          localStorage.removeItem("token");
          router.push("/");
        }
      }
    };
    fetchApplications();
  }, [router]);

  const getMissingSkills = (jobSkills, candidateSkills) => {
    return jobSkills.filter((skill) => !candidateSkills.includes(skill));
  };

  const handleAnalyze = async (jobId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to analyze resume.");
      router.push("/");
      return;
    }

    try {
      // Fetch the stored resumeParsed data
      const res = await fetch("http://localhost:5000/api/resume/get-draft", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch resume data");
      const data = await res.json();
      const resumeData = data.resumeData;

      if (!resumeData) {
        toast.error("No resume data available. Please upload a resume first.");
        return;
      }

      const resumeJson = JSON.stringify(resumeData);
      const base64Resume = Buffer.from(resumeJson).toString("base64");

      const analyzeRes = await fetch("http://localhost:5000/api/resume/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId, resume: base64Resume }),
      });
      if (!analyzeRes.ok) throw new Error(await analyzeRes.text());
      const analysisData = await analyzeRes.json();
      toast.success("Resume analyzed successfully!");
      console.log("Analysis result:", analysisData); // Display or handle result (e.g., modal)
    } catch (err) {
      console.error("Analysis failed:", err.message);
      toast.error(`Analysis failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Use bg-background */}
      <Navbar userType="candidate" />
      <main className="flex-1 p-6">
        <div className="bg-accent p-6 rounded-lg mb-8 shadow-md">
          {/* Use bg-accent */}
          <h1 className="text-3xl font-semibold text-center uppercase text-foreground">
            Track Applications
          </h1>
          {/* Use text-foreground */}
        </div>
        <div className="space-y-6">
          {applications.length > 0 ? (
            applications.map((app) => {
              const missingSkills = getMissingSkills(
                app.job.skills || [],
                app.candidate.resumeParsed?.skills || []
              );
              return (
                <div key={app._id} className="card">
                  {/* Use card class */}
                  <div className="flex items-center">
                    <CircleUser className="h-10 w-10 text-primary mr-4" />{" "}
                    {/* Use text-primary */}
                    <div className="flex-1 text-foreground">
                      {/* Use text-foreground */}
                      <p className="font-bold text-lg">{app.job.title}</p>
                      <p className="text-sm">Domain: {app.job.details}</p>
                      <p className="text-xs mt-1">Status: {app.status}</p>
                    </div>
                    <button onClick={() => handleAnalyze(app.job._id)} className="btn-icon">
                      {/* Use btn-icon */}
                      <FileText className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-2 text-foreground">
                    {/* Use text-foreground */}
                    <p className="font-semibold">Missing Skills:</p>
                    {missingSkills.length > 0 ? (
                      <ul className="list-disc pl-4">
                        {missingSkills.map((skill) => (
                          <li key={skill}>{skill}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>None</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-foreground">No applications found.</p>
            /* Use text-foreground */
          )}
        </div>
      </main>
    </div>
  );
}
