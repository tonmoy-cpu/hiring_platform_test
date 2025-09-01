"use client";

import Navbar from "@/components/navbar";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { skillOptions, domainOptions } from "@/lib/utils";

interface Job {
  _id: string;
  title: string;
  details: string;
  skills: string[];
}

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [formData, setFormData] = useState<Job>({ _id: "", title: "", details: "", skills: [] });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const userType = localStorage.getItem("userType");
    if (userType && userType !== "recruiter") {
      toast.error("Access denied. Redirecting...");
      router.push("/dashboard");
      return;
    }
    if (pathname !== "/recruiter/dashboard") {
      router.push("/recruiter/dashboard");
    }
  }, [pathname, router]);

  const fetchJobs = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/jobs/recruiter", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      toast.error(`Failed to load jobs: ${err.message}`);
      if (err.message.includes("401")) {
        localStorage.removeItem("token");
        router.push("/");
      }
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [router]);

  const handleEdit = (job: Job) => {
    setEditingJob(job._id);
    setFormData({ ...job });
  };

  const handleClose = async (jobId: string) => {
    if (!confirm("Are you sure you want to close this job?")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${jobId}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to close job");
      setJobs((prev) => prev.filter((job) => job._id !== jobId));
      toast.success("Job closed successfully!");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleSaveEdit = async (jobId: string) => {
    if (!formData.title || !formData.details || formData.skills.length === 0) {
      toast.error("Please fill all required fields.");
      return;
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update job");
      const updatedJob = await res.json();
      setJobs((prev) => prev.map((job) => (job._id === jobId ? updatedJob : job)));
      setEditingJob(null);
      toast.success("Job updated successfully!");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleSkillChange = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete job");
      setJobs((prev) => prev.filter((job) => job._id !== jobId));
      toast.success("Job deleted successfully!");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#373737]">
      <Navbar userType="recruiter" />
      <main className="flex-1 p-6">
        <div className="bg-[#313131] p-6 rounded-lg mb-8 shadow-md">
          <h1 className="text-3xl font-semibold text-center uppercase text-white">Your Job Postings</h1>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="bg-[#d9d9d9] p-6 rounded-lg shadow-md relative"
            >
              {editingJob === job._id ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full p-2 border rounded text-[#313131]"
                    placeholder="Job Title"
                  />
                  <select
                    name="details"
                    value={formData.details}
                    onChange={handleChange}
                    className="w-full p-2 border rounded text-[#313131]"
                  >
                    <option value="">Select a domain</option>
                    {domainOptions.map((domain) => (
                      <option key={domain} value={domain}>
                        {domain}
                      </option>
                    ))}
                  </select>
                  <div className="mb-4">
                    <h3 className="font-bold text-[#313131] mb-2">Skills</h3>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {skillOptions.map((skill) => (
                        <label key={skill} className="flex items-center text-[#313131]">
                          <input
                            type="checkbox"
                            checked={formData.skills.includes(skill)}
                            onChange={() => handleSkillChange(skill)}
                            className="mr-2"
                          />
                          {skill}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSaveEdit(job._id)}
                      className="flex-1 bg-[#313131] text-white py-2 rounded hover:bg-[#4a4a4a]"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingJob(null)}
                      className="flex-1 bg-[#313131] text-white py-2 rounded hover:bg-[#4a4a4a]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-[#313131]">{job.title}</h3>
                    <p className="text-sm text-[#313131]">{job.details}</p>
                    <p className="text-sm text-[#313131]">Skills: {job.skills.join(", ")}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(job)}
                      className="bg-[#313131] text-white p-2 rounded hover:bg-[#4a4a4a]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleClose(job._id)}
                      className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => handleDelete(job._id)}
                      className="bg-red-700 text-white p-2 rounded hover:bg-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}