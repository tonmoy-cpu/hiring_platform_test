"use client";

import Navbar from "@/components/navbar";
import { useState, useEffect, useRef } from "react"; // Import useRef
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import io from "socket.io-client";
import ResumeBuilder from "@/components/ResumeBuilder";
import { Briefcase, FileText, MessageSquare, PlusCircle, X } from 'lucide-react'; // Added icons

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [showApplyModal, setShowApplyModal] = useState(null);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(null);
  const [showChatModal, setShowChatModal] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(""); // Keep for controlled component behavior
  const [attachment, setAttachment] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const [showResumeBuilder, setShowResumeBuilder] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const router = useRouter();
  const messageInputRef = useRef(null); // Ref for the message textarea

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    const socketInstance = io("http://localhost:5000", { auth: { token } });
    setSocket(socketInstance);

    const fetchData = async () => {
      try {
        const jobsUrl =
          statusFilter === "all"
            ? "http://localhost:5000/api/jobs?all=true&includeClosed=true"
            : "http://localhost:5000/api/jobs?all=true";

        const [jobsRes, appsRes] = await Promise.all([
          fetch(jobsUrl, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
          fetch("http://localhost:5000/api/applications", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!jobsRes.ok) throw new Error(`Jobs fetch failed: ${jobsRes.status}`);
        if (!appsRes.ok) throw new Error(`Applications fetch failed: ${appsRes.status}`);

        const jobsData = await jobsRes.json();
        const appsData = await appsRes.json();

        console.log("Fetched jobs:", JSON.stringify(jobsData, null, 2));
        setJobs(jobsData);
        setAppliedJobs(appsData.map((app) => app.job._id));
        setApplications(appsData);
      } catch (err) {
        toast.error(`Failed to load jobs: ${err.message}`);
        if (err.message.includes("401")) {
          localStorage.removeItem("token");
          router.push("/");
        }
      }
    };
    fetchData();

    socketInstance.on("connect", () => console.log("Socket connected"));
    socketInstance.on("connect_error", (err) => console.error("Socket error:", err));
    socketInstance.on("message", (message) => {
      // Only append if the chat modal for this chat is currently open
      if (showChatModal && showChatModal._id === message.chatId) {
        setChatMessages((prev) => {
          // Prevent adding duplicate messages from socket if already optimistically added
          const isDuplicate = prev.some(
            (m) => m._id === message._id || (m.content === message.content && m.timestamp === message.timestamp)
          );
          return isDuplicate ? prev : [...prev, message];
        });
      }
    });
    socketInstance.on("notification", ({ chatId, message }) => {
      if (message.sender !== localStorage.getItem("userId")) {
        setNotifications((prev) => [...prev, { chatId, message }]);
        setTimeout(() => setNotifications((prev) => prev.slice(1)), 5000);
      }
    });

    return () => {
      socketInstance.off("message"); // Explicitly turn off the listener
      socketInstance.off("notification");
      socketInstance.off("connect");
      socketInstance.off("connect_error");
      socketInstance.disconnect();
    };
  }, [router, statusFilter, showChatModal]);

  const handleApply = async (jobId) => {
    if (!resumeFile || !coverLetter) {
      toast.error("Please upload a resume and write a cover letter.");
      return;
    }

    setIsApplying(true);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("resume", resumeFile);

    try {
      toast.loading("Processing your application...", { id: "applying" });
      
      const extractRes = await fetch("http://localhost:5000/api/resume/extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok) throw new Error(extractData.error || `Resume extraction failed: ${extractRes.status}`);
      const { resumeText } = extractData;

      const applyRes = await fetch("http://localhost:5000/api/applications/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId, resumeText, coverLetter }),
      });
      if (!applyRes.ok) throw new Error(`Application submission failed: ${applyRes.status}`);
      const newApplication = await applyRes.json();
      setAppliedJobs((prev) => [...prev, jobId]);
      setApplications((prev) => [...prev, newApplication]);
      setShowApplyModal(null);
      setResumeFile(null);
      setCoverLetter("");
      toast.dismiss("applying");
      toast.success("Application submitted successfully!");
    } catch (err) {
      console.error("Error applying:", err.message);
      toast.dismiss("applying");
      toast.error(`Error applying: ${err.message}`);
      if (err.message.includes("401")) {
        localStorage.removeItem("token");
        router.push("/");
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleAnalyze = async (jobId) => {
    if (!resumeFile) {
      toast.error("Please upload a resume to analyze.");
      return;
    }

    setIsAnalyzing(true);
    const token = localStorage.getItem("token");
    try {
      toast.loading("Analyzing your resume...", { id: "analyzing" });
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Resume = reader.result.split(",")[1];
        const analyzeRes = await fetch("http://localhost:5000/api/resume/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ jobId, resume: base64Resume }),
        });

        if (!analyzeRes.ok) throw new Error(`Analysis failed: ${analyzeRes.status}`);
        const result = await analyzeRes.json();
        console.log("Frontend received analysis result:", JSON.stringify(result, null, 2));
        
        setAnalysisResult(result);
        toast.dismiss("analyzing");
        toast.success("Analysis completed!");
      };
      reader.readAsDataURL(resumeFile);
    } catch (err) {
      console.error("Error analyzing resume:", err.message);
      toast.dismiss("analyzing");
      toast.error(`Error analyzing resume: ${err.message}`);
      if (err.message.includes("401")) {
        localStorage.removeItem("token");
        router.push("/");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openChat = async (applicationId) => {
    console.log("--- DEBUG: openChat called with applicationId:", applicationId); // DEBUG LOG
    if (!applicationId) {
      toast.error("Cannot open chat: Application ID is missing or invalid.");
      console.error("Attempted to open chat with missing application ID.");
      return;
    }

    setChatMessages([]); // Clear messages before fetching new ones
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/chat/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load chat");
      const chat = await res.json();
      console.log("--- DEBUG: Chat object received in openChat:", chat); // DEBUG LOG
      setShowChatModal(chat);
      setChatMessages(chat.messages); // Set messages with fetched data
      socket.emit("joinChat", chat._id);

      await fetch(`http://localhost:5000/api/chat/${chat._id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      toast.error(`Error loading chat: ${err.message}`);
    }
  };

  const sendMessage = async () => {
    console.log("--- DEBUG: sendMessage called."); // DEBUG LOG
    // Get the current value directly from the textarea using the ref
    const messageText = messageInputRef.current ? messageInputRef.current.value.trim() : '';

    if (!messageText && !attachment) {
      toast.error("Message content or attachment is required."); // More specific error
      return;
    }
    if (!showChatModal || !showChatModal.application) { // Ensure application ID is available
      toast.error("Chat context missing. Please reopen the chat.");
      console.error("showChatModal or showChatModal.application is missing:", showChatModal); // Debug log
      return;
    }

    const token = localStorage.getItem("token");
    const formData = new FormData();
    
    // Only append content if messageText has a value
    if (messageText) {
      formData.append("content", messageText);
    } else if (!attachment) {
        // If no text and no attachment, prevent sending (should be caught by initial check but good for redundancy)
        toast.error("Message content or attachment is required.");
        return;
    }

    if (attachment) formData.append("attachment", attachment);

    try {
      // THIS IS THE CRITICAL LINE: Use showChatModal.application (Application ID)
      const targetUrl = `http://localhost:5000/api/chat/${showChatModal.application}`;
      console.log("--- DEBUG: Chat URL Construction V4 - Attempting to send message to URL:", targetUrl); // CRITICAL DEBUG LOG
      console.log("--- DEBUG: showChatModal content for sendMessage V4:", showChatModal); // CRITICAL DEBUG LOG
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to send message: ${errorText}`); // Include backend error message
      }
      const message = await res.json();
      
      // Optimistically add the message to the chatMessages state
      setChatMessages((prev) => [...prev, message]);

      // Clear the textarea using the ref
      if (messageInputRef.current) {
        messageInputRef.current.value = '';
      }
      setNewMessage(""); // Also clear the state for controlled component behavior
      setAttachment(null);
    } catch (err) {
      toast.error(`Error sending message: ${err.message}`);
    }
  };

  const closeChatModal = () => {
    setShowChatModal(null);
    setChatMessages([]); // Clear messages when closing the modal
    if (messageInputRef.current) { // Clear input on close
      messageInputRef.current.value = '';
    }
    setNewMessage(""); // Reset state too
  };

  const filteredJobs = jobs.filter((job) => {
    const textMatch =
      job.title?.toLowerCase().includes(filter.toLowerCase()) ||
      job.details?.toLowerCase().includes(filter.toLowerCase());
    const skillMatch = skillFilter
      ? Array.isArray(job.skills) && job.skills.some((skill) => skill.toLowerCase().includes(skillFilter.toLowerCase()))
      : true;
    const salaryMatch = () => {
      if (!job.salary) return !minSalary && !maxSalary;
      const salaryNum = parseInt(job.salary.replace(/[^0-9]/g, ""), 10) || 0;
      const min = minSalary ? parseInt(minSalary, 10) : -Infinity;
      const max = maxSalary ? parseInt(maxSalary, 10) : Infinity;
      return salaryNum >= min && salaryNum <= max;
    };
    return textMatch && skillMatch && salaryMatch();
  });

  return (
    <div className="min-h-screen flex flex-col bg-background"> {/* Use bg-background */}
      <Navbar userType="candidate" />
      <main className="flex-1 p-6">
        <div className="bg-accent p-6 rounded-lg mb-8 shadow-md"> {/* Use bg-accent */}
          <h1 className="text-3xl font-semibold text-center uppercase text-foreground tracking-wide">All Jobs</h1> {/* Use text-foreground */}
        </div>

        <div className="mb-6 space-y-4">
          <input
            type="text"
            placeholder="Search jobs by title or domain..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field" /* Use input-field */
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-foreground mb-1">Filter by Skill</label> {/* Use text-foreground */}
              <input
                type="text"
                placeholder="e.g., React.js"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="input-field" /* Use input-field */
              />
            </div>
            <div>
              <label className="block text-foreground mb-1">Min Salary</label> {/* Use text-foreground */}
              <input
                type="number"
                placeholder="e.g., 30000"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
                className="input-field" /* Use input-field */
              />
            </div>
            <div>
              <label className="block text-foreground mb-1">Max Salary</label> {/* Use text-foreground */}
              <input
                type="number"
                placeholder="e.g., 80000"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
                className="input-field" /* Use input-field */
              />
            </div>
          </div>
          <div>
            <label className="block text-foreground mb-1">Job Status</label> {/* Use text-foreground */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field" /* Use input-field */
            >
              <option value="open" className="bg-background text-foreground">Open Jobs</option> {/* Set option colors */}
              <option value="all" className="bg-background text-foreground">All Jobs (Open + Closed)</option> {/* Set option colors */}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <div key={job._id} className="card job-card"> {/* Use card class */}
              <h3 className="font-semibold text-lg mb-2 text-foreground">{job.title}</h3> {/* Use text-foreground */}
              <p className="text-sm text-gray-300">{job.details}</p>
              <p className="text-xs text-gray-400 mt-1"> {/* Use gray-400 for secondary text */}
                Skills: {Array.isArray(job.skills) ? job.skills.join(", ") : "Not specified"}
              </p>
              <p className="text-xs text-gray-400 mt-1"> {/* Use gray-400 for secondary text */}
                Salary: {job.salary || "Not specified"}
              </p>
              <p className="text-xs text-gray-400 mt-1"> {/* Use gray-400 for secondary text */}
                Status: {job.isClosed ? "Closed" : "Open"}
              </p>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setShowAnalyzeModal(job)}
                  className="btn-secondary"
                >
                  Analyze Resume
                </button>
                {/* Modified Chat button to ensure valid applicationId */}
                <button
                  onClick={() => {
                    const matchingApp = applications.find((app) => app.job._id === job._id);
                    if (matchingApp) {
                      openChat(matchingApp._id);
                    } else {
                      toast.error("Chat not available for this job yet. Please apply first!");
                    }
                  }}
                  className="btn-secondary"
                >
                  Chat
                </button>
                <button
                  onClick={() => (appliedJobs.includes(job._id) ? null : setShowApplyModal(job))}
                  disabled={appliedJobs.includes(job._id) || job.isClosed}
                  className={`btn-primary ${
                    appliedJobs.includes(job._id) || job.isClosed
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {appliedJobs.includes(job._id) ? "Applied" : job.isClosed ? "Closed" : "Apply"}
                </button>
                <button
                  onClick={() => setShowResumeBuilder(true)}
                  className="btn-secondary"
                >
                  Build Resume
                </button>
              </div>
            </div>
          ))}
        </div>

        {showApplyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 modal">
            <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-md modal-content"> {/* Use bg-accent */}
              <h2 className="text-xl font-bold text-primary mb-4">Apply to {showApplyModal.title}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-foreground font-semibold mb-2">Upload Resume (PDF)</label> {/* Use text-foreground */}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
                    className="input-field" /* Use input-field */
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-2">Cover Letter</label> {/* Use text-foreground */}
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="input-field" /* Use input-field */
                    rows={5}
                    placeholder="Write your cover letter here..."
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowApplyModal(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApply(showApplyModal._id)}
                    className={`btn-primary ${isApplying ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isApplying}
                  >
                    {isApplying ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      "Submit Application"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAnalyzeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 modal">
            <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-md modal-content"> {/* Use bg-accent */}
              <h2 className="text-xl font-bold text-primary mb-4">
                Analyze Resume for {showAnalyzeModal.title}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-foreground font-semibold mb-2">Upload Resume (PDF)</label> {/* Use text-foreground */}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
                    className="input-field" /* Use input-field */
                  />
                </div>
                {analysisResult ? (
                  <div className="text-foreground"> {/* Use text-foreground */}
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${analysisResult.score >= 70 ? 'text-success' : analysisResult.score >= 50 ? 'text-warning' : 'text-danger'}`}>
                          {analysisResult.score || analysisResult.matchScore || 0}%
                        </div>
                        <div className="text-sm text-gray-400">Job Compatibility Score</div>
                      </div>
                      
                      {analysisResult.matchedSkills && analysisResult.matchedSkills.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-success mb-2">✓ Your Matching Skills</h4>
                          <div className="flex flex-wrap gap-1">
                            {analysisResult.matchedSkills.map((skill, index) => (
                              <span key={index} className="px-2 py-1 bg-success bg-opacity-20 text-success text-xs rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {analysisResult.missingSkills && analysisResult.missingSkills.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-warning mb-2">⚠ Skills to Develop</h4>
                          <div className="space-y-2">
                            {analysisResult.missingSkills.slice(0, 5).map((item, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium text-warning">
                                  {typeof item === "string" ? item : item.skill}
                                </span>
                                {typeof item === "object" && item.suggestion && (
                                  <div className="text-gray-400 text-xs mt-1">{item.suggestion}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {analysisResult.feedback && analysisResult.feedback.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-info mb-2">💡 AI Recommendations</h4>
                          <ul className="space-y-1">
                            {analysisResult.feedback.map((item, index) => (
                              <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-info mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">
                    Upload a resume and click Analyze to see results.
                  </p>
                )}
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowAnalyzeModal(null);
                      setAnalysisResult(null);
                      setResumeFile(null);
                    }}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleAnalyze(showAnalyzeModal._id)}
                    className={`btn-primary ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                </div>
              </div>
            </div>
          </div>
        )}

        {showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 modal">
            <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-lg modal-content"> {/* Use bg-accent */}
              <h2 className="text-xl font-bold text-primary mb-4">Chat</h2>
              <div className="h-64 overflow-y-auto mb-4 bg-background p-2 rounded"> {/* Use bg-background */}
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-2 ${msg.sender === localStorage.getItem("userId") ? "text-right" : "text-left"}`}
                  >
                    <p className="text-foreground">{msg.content}</p> {/* Use text-foreground */}
                    {msg.attachment && (
                      <a href={`http://localhost:5000${msg.attachment}`} target="_blank" className="text-info underline"> {/* Use text-info */}
                        {msg.attachmentType === "link" ? msg.content : `Attachment (${msg.attachmentType})`}
                      </a>
                    )}
                    <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleTimeString()}</span> {/* Use gray-400 */}
                  </div>
                ))}
              </div>
              <textarea
                ref={messageInputRef} // Attach ref here
                value={newMessage} // Value controlled by state
                onChange={(e) => setNewMessage(e.target.value)} // Update state on change
                className="input-field" /* Use input-field */
                placeholder="Type a message..."
              />
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)}
                className="mt-2 text-foreground" /* Use text-foreground */
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button
                  onClick={closeChatModal} // Use the new closeChatModal function
                  className="btn-secondary" /* Use btn-secondary */
                >
                  Close
                </button>
                <button
                  onClick={sendMessage}
                  className="btn-primary" /* Use btn-primary */
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {notifications.map((notif, index) => (
          <div
            key={index}
            className="fixed top-4 right-4 bg-accent text-foreground p-4 rounded-lg shadow-lg z-50" /* Use bg-accent and text-foreground */
          >
            New message in chat {notif.chatId}
          </div>
        ))}

        {showResumeBuilder && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 modal">
            <ResumeBuilder onClose={() => setShowResumeBuilder(false)} />
          </div>
        )}
      </main>
    </div>
  );
}
