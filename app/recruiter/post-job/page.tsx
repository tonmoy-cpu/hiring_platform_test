"use client";

import Navbar from "@/components/navbar";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { skillOptions, domainOptions } from "@/lib/utils";
import { Plus } from 'lucide-react'; // Import Plus icon

export default function PostJob() {
  const [formData, setFormData] = useState({
    jobName: "",
    details: "",
    skills: [],
    salary: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSkillChange = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleDetailChange = (domain) => {
    setFormData((prev) => ({
      ...prev,
      details: domain,
    }));
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.jobName,
          details: formData.details,
          skills: formData.skills,
          salary: formData.salary,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Failed to post job");
      }

      toast.success("Job posted successfully!");
      setFormData({ jobName: "", details: "", skills: [], salary: "" });
      setTimeout(() => router.push("/recruiter/dashboard"), 1000);
    } catch (err) {
      console.error("Error posting job:", err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar userType="recruiter" />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full"> {/* Added max-w-4xl and mx-auto for centering */}
        <div className="bg-accent p-6 rounded-lg mb-8 shadow-md">
          <h1 className="text-3xl font-bold text-center uppercase text-foreground tracking-wide">
            Post a Job
          </h1>
        </div>

        <div className="card p-8"> {/* Using .card class for consistent styling */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-foreground font-semibold mb-2">Job Name</label>
              <input
                type="text"
                name="jobName"
                value={formData.jobName}
                onChange={handleInputChange}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-foreground font-semibold mb-2">Domain</label>
              <select
                name="details"
                value={formData.details}
                onChange={(e) => handleDetailChange(e.target.value)}
                className="input-field"
                required
              >
                <option value="" className="bg-background text-foreground">Select a domain</option>
                {domainOptions.map((domain) => (
                  <option key={domain} value={domain} className="bg-background text-foreground">
                    {domain}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-foreground font-semibold mb-2">Skills</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-background rounded-lg border border-border"> {/* Added bg-background, rounded-lg, border-border */}
                {skillOptions.map((skill) => (
                  <label key={skill} className="flex items-center text-foreground">
                    <input
                      type="checkbox"
                      checked={formData.skills.includes(skill)}
                      onChange={() => handleSkillChange(skill)}
                      className="mr-2 accent-primary"
                    />
                    {skill}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-foreground font-semibold mb-2">Salary</label>
              <input
                type="text"
                name="salary"
                value={formData.salary}
                onChange={handleInputChange}
                className="input-field"
                placeholder="e.g., $60,000 - $80,000"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`btn-primary ${
                  isSubmitting
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-background" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Submit Job
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
