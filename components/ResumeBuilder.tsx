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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
      if (!token || !selectedJobId || isAnalyzing) return;
      
      setIsAnalyzing(true);
      const resumeText = Buffer.from(JSON.stringify(data)).toString("base64");
      try {
        const result = await fetchResumeFeedback(token, selectedJobId, resumeText);
        if (result) {
          const job = jobs.find((j) => j._id === selectedJobId);
          const atsScore = calculateATSScore(data.skills || [], job?.skills || []);
          const atsFeedback = generateATSFeedback(data.skills || [], job?.skills || [], data);
          
          setFeedback({
            score: result.matchScore !== undefined ? result.matchScore : (result.score || 0),
            matchedSkills: result.matchedSkills || [],
            missingSkills: result.missingSkills,
            feedback: result.feedback,
            atsScore,
            atsFeedback,
          });
        } else {
          setFeedback({ 
            score: 0, 
            matchedSkills: [], 
            missingSkills: [], 
            feedback: ["Please select a job and complete your resume details."], 
            atsScore: 0, 
            atsFeedback: ["Select a job to see ATS compatibility."] 
          });
        }
      } catch (err) {
        console.error("Feedback error:", err.message);
        setFeedback({
          score: 0,
          matchedSkills: [],
          missingSkills: [{ skill: "Analysis Error", suggestion: "Please try again later or check your connection." }],
          feedback: ["Unable to fetch feedback. Please ensure all fields are filled and try again."],
          atsScore: 0,
          atsFeedback: ["Complete your resume and select a job for ATS analysis."],
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, 3000),
    [selectedJobId, jobs, isAnalyzing]
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
    
    setIsAnalyzing(true);
    if (debouncedFetchRef.current) {
      debouncedFetchRef.current.cancel();
    }
    
    const resumeText = Buffer.from(JSON.stringify(resumeData)).toString("base64");
    try {
      const result = await fetchResumeFeedback(token, selectedJobId, resumeText);
      const job = jobs.find((j) => j._id === selectedJobId);
      const atsScore = calculateATSScore(resumeData.skills || [], job?.skills || []);
      const atsFeedback = generateATSFeedback(resumeData.skills || [], job?.skills || [], resumeData);
      
      if (result) {
        setFeedback({
          score: result.matchScore !== undefined ? result.matchScore : (result.score || 0),
          matchedSkills: result.matchedSkills || [],
          missingSkills: result.missingSkills,
          feedback: result.feedback,
          atsScore,
          atsFeedback,
        });
        toast.success("Resume analysis completed!");
      } else {
        setFeedback({ 
          score: 0, 
          matchedSkills: [], 
          missingSkills: [], 
          feedback: ["Analysis failed. Please try again."], 
          atsScore: 0, 
          atsFeedback: ["Unable to calculate ATS score."] 
        });
      }
    } catch (err) {
      console.error("Analysis error:", err.message);
      toast.error("Analysis failed. Please try again.");
      setFeedback({
        score: 0,
        matchedSkills: [],
        missingSkills: [{ skill: "Analysis Error", suggestion: "Please try again later." }],
        feedback: ["Analysis failed. Please ensure all fields are completed and try again."],
        atsScore: 0,
        atsFeedback: ["Unable to perform ATS analysis. Please try again."],
      });
    } finally {
      setIsAnalyzing(false);
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
    const matched = resumeSkills.filter(resumeSkill => 
      jobSkills.some(jobSkill => 
        resumeSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
        jobSkill.toLowerCase().includes(resumeSkill.toLowerCase())
      )
    ).length;
    const baseScore = Math.round((matched / jobSkills.length) * 100);
    
    // Bonus for having more skills than required
    const bonus = resumeSkills.length > jobSkills.length ? 5 : 0;
    
    return Math.min(baseScore + bonus, 100);
  };

  const generateATSFeedback = (resumeSkills, jobSkills, resumeData) => {
    const missing = jobSkills.filter(jobSkill => 
      !resumeSkills.some(resumeSkill => 
        resumeSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
        jobSkill.toLowerCase().includes(resumeSkill.toLowerCase())
      )
    );
    
    const feedback = [];
    
    if (missing.length > 0) {
      feedback.push(`Include these keywords for better ATS scanning: ${missing.slice(0, 3).join(", ")}.`);
    }
    
    if (resumeSkills.length === 0) {
      feedback.push("Add technical skills section to improve ATS compatibility.");
    }
    
    if (!resumeData.contact?.name || !resumeData.contact?.email) {
      feedback.push("Ensure contact information is complete and properly formatted.");
    }
    
    if (!resumeData.experience || resumeData.experience.length === 0) {
      feedback.push("Add work experience or relevant projects for better ATS scoring.");
    }
    
    if (feedback.length === 0) {
      feedback.push("Your resume shows good ATS compatibility for this position.");
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
            className={`btn-primary mr-2 ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </span>
            ) : (
              "Analyze Resume"
            )}
          </button>
          <button
            onClick={handleLoadDraft}
            disabled={isLoadingDraft}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed" // Using btn-secondary
          >
            {isLoadingDraft ? "Loading..." : "Load Draft"}
          </button>
          
          {/* Enhanced Feedback Display */}
          <div className="mt-6 space-y-4">
            <div className="bg-background p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3 text-primary">Analysis Results</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${feedback.score >= 70 ? 'text-success' : feedback.score >= 50 ? 'text-warning' : 'text-danger'}`}>
                    {feedback.score || 0}%
                  </div>
                  <div className="text-sm text-gray-400">Job Match Score</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${feedback.atsScore >= 70 ? 'text-success' : feedback.atsScore >= 50 ? 'text-warning' : 'text-danger'}`}>
                    {feedback.atsScore || 0}%
                  </div>
                  <div className="text-sm text-gray-400">ATS Score</div>
                </div>
              </div>
              
              {feedback.matchedSkills.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-success mb-2">✓ Matched Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {feedback.matchedSkills.map((skill, i) => (
                      <span key={i} className="px-2 py-1 bg-success bg-opacity-20 text-success text-xs rounded-full">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {feedback.missingSkills.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-warning mb-2">⚠ Missing Skills</h4>
                  <div className="space-y-1">
                    {feedback.missingSkills.slice(0, 5).map((skill, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-warning">{skill.skill}</span>
                        <span className="text-gray-400 ml-2">- {skill.suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {feedback.feedback.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-info mb-2">💡 AI Feedback</h4>
                  <ul className="space-y-1">
                    {feedback.feedback.map((item, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-info mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {feedback.atsFeedback.length > 0 && (
                <div>
                  <h4 className="font-medium text-primary mb-2">🤖 ATS Recommendations</h4>
                  <ul className="space-y-1">
                    {feedback.atsFeedback.map((item, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
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
