"use client";

import Navbar from "@/components/navbar";
import { FileText, Edit, X, Plus, BarChart, Users, Briefcase, Clock } from 'lucide-react';
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { skillOptions, domainOptions } from "@/lib/utils";
import Link from "next/link";

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [editingJob, setEditingJob] = useState(null);
  const [formData, setFormData] = useState({ title: "", details: "", skills: [] });
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    totalApplicants: 0,
    newApplicants: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const userType = localStorage.getItem("userType");
    if (userType && userType !== "recruiter") {
      toast.error("Access denied. Redirecting...");
      router.push("/dashboard");
      return;
    }
    // No need to push to /recruiter/dashboard if already there, causes infinite loop
    // if (pathname !== "/recruiter/dashboard") {
    //   router.push("/recruiter/dashboard");
    // }
  }, [pathname, router]);

  const fetchJobs = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/jobs/recruiter", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch jobs: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      setJobs(data);

      // Calculate dashboard stats
      const activeJobs = data.filter(job => !job.isClosed).length;
      const totalApplicants = data.reduce((sum, job) => sum + (job.applicantsCount || 0), 0);
      const newApplicants = data.reduce((sum, job) => sum + (job.newApplicantsCount || 0), 0);
      setStats({
        totalJobs: data.length,
        activeJobs: activeJobs,
        totalApplicants: totalApplicants,
        newApplicants: newApplicants
      });
    } catch (err) {
      console.error("Fetch error:", err);
      if (err.message.includes("401")) {
        toast.error("Session expired. Please log in again.");
        localStorage.removeItem("token");
        router.push("/");
      } else {
        toast.error("Failed to load jobs: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    return () => {
      setJobs([]);
      setEditingJob(null);
    };
  }, [router]);

  const handleEdit = (job) => {
    setEditingJob(job._id);
    setFormData({
      title: job.title || "",
      details: job.details || "",
      skills: job.skills || [],
    });
  };

  const handleClose = async (jobId) => {
    const token = localStorage.getItem("token");
    if (!confirm("Are you sure you want to close this job?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${jobId}/close`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Failed to close job");
      }
      
      setJobs((prev) => prev.map(job => 
        job._id === jobId ? {...job, isClosed: true} : job
      ));
      
      toast.success("Job closed successfully!");
    } catch (err) {
      console.error("Close error:", err);
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleSaveEdit = async (jobId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Failed to update job");
      }
      const updatedJob = await res.json();
      setJobs((prev) =>
        prev.map((job) => (job._id === jobId ? updatedJob : job))
      );
      setEditingJob(null);
      toast.success("Job updated successfully!");
    } catch (err) {
      console.error("Save error:", err);
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSkillChange = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar userType="recruiter" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-foreground">Loading your dashboard...</p> {/* Use text-foreground */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" key={pathname}> {/* Use bg-background */}
      <Navbar userType="recruiter" />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="bg-accent p-8 rounded-lg mb-8 shadow-md relative overflow-hidden"> {/* Use bg-accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-10 rounded-full transform translate-x-1/3 -translate-y-1/3"></div>
          <h1 className="text-3xl font-bold text-foreground mb-2 relative z-10">Recruiter Dashboard</h1> {/* Use text-foreground */}
          <p className="text-gray-300 max-w-2xl relative z-10">
            Manage your job postings, track applicants, and find the perfect candidates for your positions.
          </p>
        </div>

        {/* Stats Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-fade-in">
          <div className="card p-6 flex items-center"> {/* Use card class */}
            <div className="p-3 rounded-full bg-primary bg-opacity-20 mr-4">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Jobs</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalJobs}</p> {/* Use text-foreground */}
            </div>
          </div>
          
          <div className="card p-6 flex items-center"> {/* Use card class */}
            <div className="p-3 rounded-full bg-success bg-opacity-20 mr-4">
              <Clock className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active Jobs</p>
              <p className="text-2xl font-bold text-foreground">{stats.activeJobs}</p> {/* Use text-foreground */}
            </div>
          </div>
          
          <div className="card p-6 flex items-center"> {/* Use card class */}
            <div className="p-3 rounded-full bg-info bg-opacity-20 mr-4">
              <Users className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Applicants</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalApplicants}</p> {/* Use text-foreground */}
            </div>
          </div>
          
          <div className="card p-6 flex items-center"> {/* Use card class */}
            <div className="p-3 rounded-full bg-warning bg-opacity-20 mr-4">
              <BarChart className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">New Applicants</p>
              <p className="text-2xl font-bold text-foreground">{stats.newApplicants}</p> {/* Use text-foreground */}
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-8 animate-fade-in" style={{animationDelay: "0.1s"}}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Quick Actions</h2> {/* Use text-foreground */}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link href="/recruiter/post-job" className="card hover:border-primary group"> {/* Use card class */}
              <div className="p-3 rounded-full bg-primary bg-opacity-20 inline-block mb-4 group-hover:bg-primary group-hover:bg-opacity-30 transition-all">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2"> {/* Use text-foreground */}
                Post New Job
              </h3>
              <p className="text-sm text-gray-300">
                Create a new job posting to find the perfect candidates.
              </p>
            </Link>
            
            <Link href="/recruiter/track-applicants" className="card hover:border-primary group"> {/* Use card class */}
              <div className="p-3 rounded-full bg-primary bg-opacity-20 inline-block mb-4 group-hover:bg-primary group-hover:bg-opacity-30 transition-all">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2"> {/* Use text-foreground */}
                Track Applicants
              </h3>
              <p className="text-sm text-gray-300">
                Review and manage all your job applicants in one place.
              </p>
            </Link>
            
            <Link href="/recruiter/analytics" className="card hover:border-primary group"> {/* Use card class */}
              <div className="p-3 rounded-full bg-primary bg-opacity-20 inline-block mb-4 group-hover:bg-primary group-hover:bg-opacity-30 transition-all">
                <BarChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2"> {/* Use text-foreground */}
                Analytics
              </h3>
              <p className="text-sm text-gray-300">
                Get insights into your job postings and applicant performance.
              </p>
            </Link>
          </div>
        </section>

        {/* Your Job Postings */}
        <section className="space-y-6 animate-fade-in" style={{animationDelay: "0.2s"}}>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-foreground">Your Job Postings</h2> {/* Use text-foreground */}
            <Link href="/recruiter/post-job" className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Post New Job</span>
            </Link>
          </div>
          
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job, index) => (
                <div
                  key={job._id}
                  className="card recruiter-job-card" // Use card class
                  style={{animationDelay: `${index * 0.05}s`}}
                >
                  {editingJob === job._id ? (
                    <div className="w-full space-y-4">
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        className="input-field" // Use input-field
                        placeholder="Job Title"
                      />
                      <select
                        name="details"
                        value={formData.details}
                        onChange={handleChange}
                        className="input-field" // Use input-field
                      >
                        <option value="" className="bg-background text-foreground">Select a domain</option> {/* Set option colors */}
                        {domainOptions.map((domain) => (
                          <option key={domain} value={domain} className="bg-background text-foreground">
                            {domain}
                          </option>
                        ))}
                      </select>
                      <div className="mb-4">
                        <h3 className="font-bold text-foreground mb-2">Skills</h3> {/* Use text-foreground */}
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-background rounded-lg"> {/* Use bg-background */}
                          {skillOptions.map((skill) => (
                            <label key={skill} className="flex items-center text-foreground hover:text-primary transition-colors"> {/* Use text-foreground */}
                              <input
                                type="checkbox"
                                checked={formData.skills.includes(skill)}
                                onChange={() => handleSkillChange(skill)}
                                className="mr-2 accent-primary"
                              />
                              <span className="text-sm">{skill}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleSaveEdit(job._id)}
                          className="btn-primary flex-1" // Use btn-primary
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingJob(null)}
                          className="btn-secondary flex-1" // Use btn-secondary
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="p-3 rounded-lg bg-primary bg-opacity-20 mr-4">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-foreground flex-1"> {/* Use text-foreground */}
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-lg">{job.title || "Untitled"}</p>
                            {job.isClosed && (
                              <span className="px-2 py-1 bg-danger bg-opacity-20 text-danger text-xs rounded-full">
                                Closed
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300">{job.details || "No details"}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(job.skills || []).slice(0, 3).map(skill => (
                              <span key={skill} className="skill-tag">
                                {skill}
                              </span>
                            ))}
                            {(job.skills || []).length > 3 && (
                              <span className="skill-tag">+{job.skills.length - 3}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                            <span>
                              <strong>Salary:</strong> {job.salary || "Not specified"}
                            </span>
                            <span>
                              <strong>Applicants:</strong> {job.applicantsCount || 0}
                            </span>
                            <span>
                              <strong>Posted:</strong> {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {job.isClosed === false && (
                          <>
                            <button
                              onClick={() => handleEdit(job)}
                              className="btn-icon"
                              title="Edit Job"
                            >
                              <Edit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleClose(job._id)}
                              className="btn-icon text-danger hover:bg-danger hover:text-background" /* Use btn-icon and danger colors */
                              title="Close Job"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        {/* Added Delete button for recruiters */}
                        <button
                          onClick={() => handleDelete(job._id)}
                          className="btn-icon text-danger hover:bg-danger hover:text-background"
                          title="Delete Job"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12"> {/* Use card class */}
              <div className="mb-4 text-primary">
                <Briefcase className="h-12 w-12 mx-auto opacity-50" />
              </div>
              <p className="text-foreground mb-4">No jobs posted yet. Create your first job posting!</p> {/* Use text-foreground */}
              <Link href="/recruiter/post-job" className="btn-primary inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Post New Job</span>
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
