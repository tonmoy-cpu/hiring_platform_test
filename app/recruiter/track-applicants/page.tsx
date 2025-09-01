"use client";

import Navbar from "@/components/navbar";
import { CircleUser, FileText, MoreHorizontal, MessageSquare, X } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import io from "socket.io-client";

export default function TrackApplicants() {
  const [applications, setApplications] = useState([]);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [statusUpdates, setStatusUpdates] = useState({});
  const [showChatModal, setShowChatModal] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const router = useRouter();
  // Removed messageInputRef, relying solely on newMessage state for textarea content

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    const socketInstance = io("http://localhost:5000", { auth: { token } });
    setSocket(socketInstance);

    const fetchApplications = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/applications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data = await res.json();
        setApplications(data);
      } catch (err) {
        toast.error(`Error: ${err.message}`);
        if (err.message.includes("401")) {
          localStorage.removeItem("token");
          router.push("/");
        }
      }
    };
    fetchApplications();

    socketInstance.on("connect", () => console.log("Socket connected"));
    socketInstance.on("connect_error", (err) => console.error("Socket error:", err));
    socketInstance.on("message", (message) => {
      if (showChatModal && showChatModal._id === message.chatId) {
        setChatMessages((prev) => {
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
      socketInstance.off("message");
      socketInstance.off("notification");
      socketInstance.off("connect");
      socketInstance.off("connect_error");
      socketInstance.disconnect();
    };
  }, [router, showChatModal]);

  const handleStatusChange = (appId, value) => {
    setStatusUpdates((prev) => ({ ...prev, [appId]: value }));
  };

  const handleSubmitStatus = async (appId) => {
    const token = localStorage.getItem("token");
    const newStatus = statusUpdates[appId] || applications.find((a) => a._id === appId).status;

    try {
      const res = await fetch(`http://localhost:5000/api/applications/${appId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || `Failed to update status (Status: ${res.status})`);
      }

      const data = await res.json();
      if (newStatus === "Not Selected") {
        setApplications((prev) => prev.filter((app) => app._id !== appId));
      } else {
        setApplications((prev) =>
          prev.map((app) => (app._id === appId ? { ...app, status: newStatus } : app))
        );
      }
      toast.success("Status updated successfully!");
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleChat = async (app) => {
    console.log("--- DEBUG: handleChat called with app:", app); // DEBUG LOG
    setChatMessages([]);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/chat/${app._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load chat");
      const chat = await res.json();
      console.log("--- DEBUG: Chat object received in handleChat:", chat); // DEBUG LOG
      setShowChatModal(chat);
      setChatMessages(chat.messages);
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
    const messageText = newMessage.trim(); // Directly use the state variable

    if (!messageText && !attachment) {
      toast.error("Message content or attachment is required.");
      return;
    }
    if (!showChatModal || !showChatModal.application) { // Ensure application ID is available
      toast.error("Chat context missing. Please reopen the chat.");
      console.error("showChatModal or showChatModal.application is missing:", showChatModal); // Debug log
      return;
    }

    const token = localStorage.getItem("token");
    const formData = new FormData();
    
    if (messageText) { // Only append if messageText has actual text
      formData.append("content", messageText);
    } else if (!attachment) {
        toast.error("Message content or attachment is required.");
        return;
    }

    if (attachment) formData.append("attachment", attachment);

    try {
      const targetUrl = `http://localhost:5000/api/chat/${showChatModal.application}`;
      console.log("--- DEBUG: Chat URL Construction V3 - Attempting to send message to URL:", targetUrl); // CRITICAL DEBUG LOG
      console.log("--- DEBUG: showChatModal content for sendMessage V3:", showChatModal); // CRITICAL DEBUG LOG
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to send message: ${errorText}`);
      }
      const message = await res.json();
      
      setChatMessages((prev) => [...prev, message]);

      // Clear the textarea by resetting the state
      setNewMessage("");
      setAttachment(null);
    } catch (err) {
      toast.error(`Error sending message: ${err.message}`);
    }
  };

  const closeChatModal = () => {
    setShowChatModal(null);
    setChatMessages([]);
    setNewMessage(""); // Reset state too
  };

  const handleAnalyze = async (app) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("No token found. Please log in again.");
      router.push("/");
      return;
    }
    try {
      console.log("Analyzing:", { resumeText: app.resumeText, jobId: app.job._id });
      const res = await fetch("http://localhost:5000/api/applications/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeText: app.resumeText, jobId: app.job._id }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Analysis failed: ${res.status} - ${errorText}`);
      }
      const analysisData = await res.json();
      setAnalysis(analysisData);
      setSelectedApplicant(app);
    } catch (err) {
      console.error("Error analyzing:", err);
      toast.error(err.message || "Failed to analyze application.");
    }
  };

  const handleDetails = (app) => {
    setSelectedApplicant(app);
    setAnalysis(null);
  };

  const handleDownloadResume = async (userId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to download the resume.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/resume/download/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Failed to download resume");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${userId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar userType="recruiter" />
      <main className="flex-1 p-6">
        <div className="bg-accent p-6 rounded-lg mb-8 shadow-md">
          <h1 className="text-3xl font-semibold text-center uppercase text-foreground">
            Track Applicants
          </h1>
        </div>
        <div className="space-y-6">
          {applications.length > 0 ? (
            applications.map((app) => (
              <div key={app._id} className="card">
                <div className="flex items-center">
                  <CircleUser className="h-10 w-10 text-primary mr-4" />
                  <div className="flex-1 text-foreground">
                    <p className="font-bold text-lg">{app.candidate.username}</p>
                    <p className="text-sm">{app.job.title}</p>
                    <p className="text-xs">Current Status: {app.status}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleChat(app)} className="btn-icon" title="Chat">
                      <MessageSquare className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleAnalyze(app)}
                      className="btn-icon"
                      title="Analyze with AI"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDetails(app)}
                      className="btn-icon"
                      title="Details"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <select
                    value={statusUpdates[app._id] || app.status}
                    onChange={(e) => handleStatusChange(app._id, e.target.value)}
                    className="input-field mb-2"
                  >
                    <option value="Applied" className="bg-background text-foreground">
                      Applied
                    </option>
                    <option value="Under Review" className="bg-background text-foreground">
                      Under Review
                    </option>
                    <option value="Selected" className="bg-background text-foreground">
                      Selected
                    </option>
                    <option value="Not Selected" className="bg-background text-foreground">
                      Not Selected
                    </option>
                  </select>
                  <button onClick={() => handleSubmitStatus(app._id)} className="btn-primary w-full">
                    Submit
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-foreground">No applicants found.</p>
          )}
        </div>

        {showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 modal">
            <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-lg modal-content">
              <h2 className="text-xl font-bold text-primary mb-4">Chat with Candidate</h2>
              <div className="h-64 overflow-y-auto mb-4 bg-background p-2 rounded">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-2 ${
                      msg.sender === localStorage.getItem("userId") ? "text-right" : "text-left"
                    }`}
                  >
                    <p className="text-foreground">{msg.content}</p>
                    {msg.attachment && (
                      <a
                        href={`http://localhost:5000${msg.attachment}`}
                        target="_blank"
                        className="text-info underline"
                      >
                        {msg.attachmentType === "link"
                          ? msg.content
                          : `Attachment (${msg.attachmentType})`}
                      </a>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
              <textarea
                value={newMessage} // Value controlled by state
                onChange={(e) => setNewMessage(e.target.value)} // Update state on change
                className="input-field"
                placeholder="Type a message..."
              />
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)}
                className="mt-2 text-foreground"
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button onClick={closeChatModal} className="btn-secondary">
                  Close
                </button>
                <button onClick={sendMessage} className="btn-primary">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {notifications.map((notif, index) => (
          <div
            key={index}
            className="fixed top-4 right-4 bg-accent text-foreground p-4 rounded-lg shadow-lg z-50"
          >
            New message in chat {notif.chatId}
          </div>
        ))}
      </main>

      {selectedApplicant && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 modal">
          <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto modal-content">
            <button
              onClick={() => setSelectedApplicant(null)}
              className="absolute top-2 right-2 btn-icon"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-primary mb-4">
              {selectedApplicant.candidate.username}’s Details
            </h2>
            {analysis ? (
              <div className="mt-4 text-foreground">
                <h3 className="font-bold">AI Analysis</h3>
                <p>
                  <strong>Score:</strong> {analysis.score}%
                </p>
                <p>
                  <strong>Feedback:</strong> {analysis.feedback}
                </p>
                <p>
                  <strong>Matched Skills:</strong> {analysis.matchedSkills.join(", ") || "None"}
                </p>
                <p>
                  <strong>Missing Skills:</strong> {analysis.missingSkills.join(", ") || "None"}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-foreground">
                  <div>
                    <h3 className="font-bold">Contact</h3>
                    <p>
                      {selectedApplicant.candidate.resumeParsed?.contact?.name || "N/A"}
                      <br />
                      {selectedApplicant.candidate.resumeParsed?.contact?.email || "N/A"}
                      <br />
                      {selectedApplicant.candidate.resumeParsed?.contact?.phone || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold">Skills</h3>
                    <ul className="list-disc pl-4">
                      {selectedApplicant.candidate.resumeParsed?.skills?.map((s) => (
                        <li key={s}>{s}</li>
                      )) || <li>N/A</li>}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold">Experience</h3>
                    {selectedApplicant.candidate.resumeParsed?.experience?.map((e, i) => (
                      <p key={i}>
                        {e.title} at {e.company} ({e.years})
                      </p>
                    )) || <p>N/A</p>}
                  </div>
                  <div>
                    <h3 className="font-bold">Education</h3>
                    {selectedApplicant.candidate.resumeParsed?.education?.map((e, i) => (
                      <p key={i}>
                        {e.degree}, {e.school} ({e.year})
                      </p>
                    )) || <p>N/A</p>}
                  </div>
                </div>
                <div className="mt-4 text-foreground">
                  <h3 className="font-bold">Cover Letter</h3>
                  <p>{selectedApplicant.coverLetter || "N/A"}</p>
                </div>
                <div className="mt-4 text-foreground">
                  <h3 className="font-bold">Resume</h3>
                  {selectedApplicant.candidate.resumeFile ? (
                    <button
                      onClick={() => handleDownloadResume(selectedApplicant.candidate._id)}
                      className="text-primary underline hover:text-primary-hover"
                    >
                      Download Resume
                    </button>
                  ) : (
                    <p>No resume available</p>
                  )}
                </div>
              </>
            )}
            <button onClick={() => setSelectedApplicant(null)} className="mt-4 btn-primary">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
