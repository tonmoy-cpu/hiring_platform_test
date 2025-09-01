"use client";

import Navbar from "@/components/navbar";
import { useState } from "react";

export default function PostJob() {
  const [formData, setFormData] = useState({
    jobName: "",
    details: "",
    skills: "",
    salary: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: Replace with API call: POST /api/jobs
    setTimeout(() => {
      alert("Job posted successfully!");
      setFormData({ jobName: "", details: "", skills: "", salary: "" });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#373737]">
      <Navbar />
      <main className="flex-1 p-6">
        <div className="bg-[#313131] p-6 rounded-lg mb-8 shadow-md">
          <h1 className="text-3xl font-semibold text-center uppercase text-white tracking-wide">Post a Job</h1>
        </div>

        <div className="bg-[#d9d9d9] p-8 rounded-lg shadow-md">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[#313131] font-semibold mb-2">Job Name</label>
              <input
                type="text"
                name="jobName"
                value={formData.jobName}
                onChange={handleChange}
                className="w-full p-2 rounded-lg bg-transparent border border-[#313131] focus:outline-none focus:ring-2 focus:ring-[#313131]"
                required
              />
            </div>
            <div>
              <label className="block text-[#313131] font-semibold mb-2">Details</label>
              <input
                type="text"
                name="details"
                value={formData.details}
                onChange={handleChange}
                className="w-full p-2 rounded-lg bg-transparent border border-[#313131] focus:outline-none focus:ring-2 focus:ring-[#313131]"
                required
              />
            </div>
            <div>
              <label className="block text-[#313131] font-semibold mb-2">Skills</label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleChange}
                className="w-full p-2 rounded-lg bg-transparent border border-[#313131] focus:outline-none focus:ring-2 focus:ring-[#313131]"
                placeholder="e.g., React, Node.js"
                required
              />
            </div>
            <div>
              <label className="block text-[#313131] font-semibold mb-2">Salary</label>
              <input
                type="text"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                className="w-full p-2 rounded-lg bg-transparent border border-[#313131] focus:outline-none focus:ring-2 focus:ring-[#313131]"
                placeholder="e.g., $60,000 - $80,000"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`text-sm px-6 py-2 rounded-lg transition duration-200 ${
                  isSubmitting
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-[#313131] text-white hover:bg-[#4a4a4a]"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}