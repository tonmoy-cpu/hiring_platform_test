"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { skillOptions, domainOptions, fetchResumeFeedback } from "@/lib/utils";
import { debounce } from "lodash";
import { fetchDraft } from "@/lib/draftUtils";
import { X, Save } from 'lucide-react'; // Import icons

interface ResumeBuilderProps {
  onClose: () => void;
}

export default function ResumeBuilder({ onClose }: ResumeBuilderProps) {
  const [resumeData, setResumeData] = useState({
    contact: { name: "", email: "", phone: "" },
    skills: [],
    experience: [{ title: "", company: "", years: "" }],
    education: [{ degree: "", school: "", year: "" }],
  });
  const [feedback, setFeedback] = useState({ score: 0, matchedSkills: [], missingSkills: [], feedback: [], atsScore: 0, atsFeedback: [] });
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const router = useRouter();
  const debouncedFetchRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    const fetchJobs = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/jobs?all=true", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch jobs");
        const data = await res.json();
        setJobs(data);
      } catch (err) {
        toast.error(`Failed to load jobs: ${err.message}`);
      }
    };
    fetchJobs();

    return () => {
      if (debouncedFetchRef.current) {
        debouncedFetchRef.current.cancel();
      }
    };
  }, [router]);

  const debouncedFetchFeedback = useCallback(
    debounce(async (data) => {
      const token = localStorage.getItem("token");
      if (!token || !selectedJobId) return;
      const resumeText = Buffer.from(JSON.stringify(data)).toString("base64");
      try {
        const result = await fetchResumeFeedback(token, selectedJobId, resumeText);
        if (result && (typeof result.matchScore !== "undefined" || typeof result.score !== "undefined")) {
          const job = jobs.find((j) => j._id === selectedJobId);
          const normalizedResumeSkills = data.skills.map(s => s.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "").replace(/native/, "reactnative"));
          const normalizedJobSkills = job?.skills.map(s => s.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "").replace(/native/, "reactnative")) || [];
          const atsScore = calculateATSScore(normalizedResumeSkills, normalizedJobSkills);
          const atsFeedback = generateATSFeedback(normalizedResumeSkills, normalizedJobSkills);
          setFeedback({
            score: result.matchScore !== undefined ? result.matchScore : result.score,
            matchedSkills: [...new Set(result.matchedSkills.map(s => s.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "").replace(/native/, "reactnative")))],
            missingSkills: result.missingSkills,
            feedback: result.feedback,
            atsScore,
            atsFeedback,
          });
        } else {
          setFeedback({ score: 0, matchedSkills: [], missingSkills: [], feedback: [], atsScore: 0, atsFeedback: [] });
        }
      } catch (err) {
        console.error("Feedback error:", err.message);
        setFeedback({
          score: 0,
          matchedSkills: [],
          missingSkills: [{ skill: "N/A", suggestion: "API limit reached, try again later" }],
          feedback: ["Unable to fetch feedback due to API limits. Save your draft and retry."],
          atsScore: 0,
          atsFeedback: ["Error in ATS analysis. Ensure job is selected and resume is complete."],
        });
      }
    }, 3000),
    [selectedJobId, jobs]
  );

  useEffect(() => {
    debouncedFetchRef.current = debouncedFetchFeedback;
  }, [debouncedFetchFeedback]);

  const handleChange = (section, index, field, value) => {
    const newData = { ...resumeData };
    if (section === "experience" || section === "education") {
      newData[section][index][field] = value;
    } else if (section === "skills") {
      const skills = value.split(/[,\s]+/).map(s => s.trim()).filter(s => s);
      newData[section] = [...new Set([...resumeData.skills, ...skills])];
    } else {
      newData[section][field] = value;
    }
    setResumeData(newData);
    if (debouncedFetchRef.current) {
      debouncedFetchRef.current(newData);
    }
  };

  const addSection = (section) => {
    const newData = { ...resumeData };
    newData[section].push(section === "experience" ? { title: "", company: "", years: "" } : { degree: "", school: "", year: "" });
    setResumeData(newData);
    if (debouncedFetchRef.current) {
      debouncedFetchRef.current(newData);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/resume/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resumeData: resumeData }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Resume draft saved successfully!");
      onClose();
    } catch (err) {
      toast.error(`Error saving draft: ${err.message}`);
    }
  };

  const handleAnalyze = async () => {
    const token = localStorage.getItem("token");
    if (!token || !selectedJobId) {
      toast.error("Please select a job and fill in the details.");
      return;
    }
    if (debouncedFetchRef.current) {
      debouncedFetchRef.current.cancel();
    }
    const resumeText = Buffer.from(JSON.stringify(resumeData)).toString("base64");
    try {
      const result = await fetchResumeFeedback(token, selectedJobId, resumeText);
      const job = jobs.find((j) => j._id === selectedJobId);
      const normalizedResumeSkills = resumeData.skills.map(s => s.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "").replace(/native/, "reactnative"));
      const normalizedJobSkills = job?.skills.map(s => s.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "").replace(/native/, "reactnative")) || [];
      const atsScore = calculateATSScore(normalizedResumeSkills, normalizedJobSkills);
      const atsFeedback = generateATSFeedback(normalizedResumeSkills, normalizedJobSkills);
      if (result && (typeof result.matchScore !== "undefined" || typeof result.score !== "undefined")) {
        setFeedback({
          score: result.matchScore !== undefined ? result.matchScore : result.score,
          matchedSkills: [...new Set(result.matchedSkills.map(s => s.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "").replace(/native/, "reactnative")))],
          missingSkills: result.missingSkills,
          feedback: result.feedback,
          atsScore,
          atsFeedback,
        });
      } else {
        setFeedback({ score: 0, matchedSkills: [], missingSkills: [], feedback: [], atsScore: 0, atsFeedback: [] });
      }
    } catch (err) {
      console.error("Analysis error:", err.message);
      setFeedback({
        score: 0,
        matchedSkills: [],
        missingSkills: [{ skill: "N/A", suggestion: "API limit reached or error occurred, try again later" }],
        feedback: ["Unable to fetch feedback due to an error. Save your draft and retry.", "Ensure all fields are filled.", "Check your internet connection."],
        atsScore: 0,
        atsFeedback: ["Error in ATS analysis. Ensure job is selected and resume is complete."],
      });
    }
  };

  const handleLoadDraft = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to load a draft.");
      return;
    }
    setIsLoadingDraft(true);
    try {
      const savedData = await fetchDraft(token);
      if (savedData) {
        setResumeData(savedData);
        toast.success("Draft loaded successfully!");
      } else {
        toast.info("No draft found. Starting with a new resume.");
      }
    } catch (err) {
      console.error("Draft load error:", err.message);
      toast.error("Failed to load draft. Please try again.");
    } finally {
      setIsLoadingDraft(false);
    }
  };

  useEffect(() => {
    console.log("Feedback state updated:", feedback);
  }, [feedback]);

  const calculateATSScore = (resumeSkills, jobSkills) => {
    if (!jobSkills.length) return 0;
    const matched = resumeSkills.filter(skill => jobSkills.includes(skill)).length;
    return Math.min(Math.round((matched / jobSkills.length) * 100), 100); // Cap at 100%
  };

  const generateATSFeedback = (resumeSkills, jobSkills) => {
    const missing = jobSkills.filter(skill => !resumeSkills.includes(skill));
    const feedback = [];
    if (missing.length > 0) {
      feedback.push(`Add these missing skills to improve ATS compatibility: ${missing.join(", ")}.`);
    }
    if (resumeSkills.length === 0) {
      feedback.push("Include at least some skills to pass ATS screening.");
    } else if (feedback.length === 0) {
      feedback.push(`Your resume is ${Math.max(feedback.atsScore || 0, 70) >= 70 ? "well-" : ""}aligned with ATS requirements for this job.`);
    }
    return feedback;
  };

  return (
    <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-2xl relative h-[90vh] flex flex-col"> {/* Using bg-accent */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 btn-icon" // Using btn-icon
      >
        <X className="h-5 w-5" />
      </button>
      <h2 className="text-2xl font-bold text-primary mb-4">Resume Builder</h2> {/* Using text-primary */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <div>
          <label className="block text-foreground font-semibold">Select Job</label> {/* Using text-foreground */}
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="input-field"
          >
            <option value="" className="bg-background text-foreground">Select a job</option>
            {jobs.map((job) => (
              <option key={job._id} value={job._id} className="bg-background text-foreground">{job.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-foreground font-semibold">Name</label> {/* Using text-foreground */}
          <input
            value={resumeData.contact.name}
            onChange={(e) => handleChange("contact", 0, "name", e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-foreground font-semibold">Email</label> {/* Using text-foreground */}
          <input
            value={resumeData.contact.email}
            onChange={(e) => handleChange("contact", 0, "email", e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-foreground font-semibold">Phone</label> {/* Using text-foreground */}
          <input
            value={resumeData.contact.phone}
            onChange={(e) => handleChange("contact", 0, "phone", e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-foreground font-semibold">Skills (comma or space-separated, or select multiple)</label> {/* Using text-foreground */}
          <input
            value={resumeData.skills.join(", ")}
            onChange={(e) => handleChange("skills", 0, "skills", e.target.value)}
            className="input-field mb-2"
            placeholder="e.g., JavaScript, React.js (type and press comma or space)"
          />
          <select
            multiple
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              handleChange("skills", 0, "skills", [...resumeData.skills, ...selected].join(", "));
            }}
            className="input-field h-24 overflow-y-auto"
          >
            {skillOptions.map((skill) => (
              <option key={skill} value={skill} className="bg-background text-foreground">{skill}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-foreground font-semibold">Experience</label> {/* Using text-foreground */}
          {resumeData.experience.map((exp, index) => (
            <div key={index} className="space-y-2 mb-2">
              <input
                value={exp.title}
                onChange={(e) => handleChange("experience", index, "title", e.target.value)}
                placeholder="Title"
                className="input-field"
              />
              <input
                value={exp.company}
                onChange={(e) => handleChange("experience", index, "company", e.target.value)}
                placeholder="Company"
                className="input-field"
              />
              <input
                value={exp.years}
                onChange={(e) => handleChange("experience", index, "years", e.target.value)}
                placeholder="Years (e.g., 2024-Present)"
                className="input-field"
              />
            </div>
          ))}
          <button
            onClick={() => addSection("experience")}
            className="btn-secondary mt-2" // Using btn-secondary
          >
            Add Experience
          </button>
        </div>
        <div>
          <label className="block text-foreground font-semibold">Education</label> {/* Using text-foreground */}
          {resumeData.education.map((edu, index) => (
            <div key={index} className="space-y-2 mb-2">
              <input
                value={edu.degree}
                onChange={(e) => handleChange("education", index, "degree", e.target.value)}
                placeholder="Degree"
                className="input-field"
              />
              <input
                value={edu.school}
                onChange={(e) => handleChange("education", index, "school", e.target.value)}
                placeholder="School"
                className="input-field"
              />
              <input
                value={edu.year}
                onChange={(e) => handleChange("education", index, "year", e.target.value)}
                placeholder="Year (e.g., 2026)"
                className="input-field"
              />
            </div>
          ))}
          <button
            onClick={() => addSection("education")}
            className="btn-secondary mt-2" // Using btn-secondary
          >
            Add Education
          </button>
        </div>
        <div className="text-foreground"> {/* Using text-foreground for feedback section */}
          <button
            onClick={handleAnalyze}
            className="btn-primary mr-2" // Using btn-primary
          >
            Analyze Resume
          </button>
          <button
            onClick={handleLoadDraft}
            disabled={isLoadingDraft}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed" // Using btn-secondary
          >
            {isLoadingDraft ? "Loading..." : "Load Draft"}
          </button>
          <h3 className="font-semibold mt-4">Feedback</h3>
          <p>Score: {feedback.score || 0}%</p>
          <p>Matched Skills: {feedback.matchedSkills.join(", ") || "None"}</p>
          <ul className="list-disc pl-5">
            {feedback.missingSkills.map((skill, i) => (
              <li key={i}>{skill.skill} - {skill.suggestion}</li>
            ))}
          </ul>
          <ul className="list-disc pl-5">
            {feedback.feedback.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <h3 className="font-semibold mt-4">ATS Compatibility</h3>
          <p>ATS Score: {feedback.atsScore || 0}%</p>
          <ul className="list-disc pl-5">
            {feedback.atsFeedback.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 flex justify-end space-x-4">
        <button
          onClick={onClose}
          className="btn-secondary" // Using btn-secondary
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="btn-primary flex items-center gap-2" // Using btn-primary
        >
          <Save className="h-5 w-5" />
          Save
        </button>
      </div>
    </div>
  );
}
