"use client";

import Navbar from "@/components/navbar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import io from "socket.io-client";

export default function TrackApplicants() {
  const [applications, setApplications] = useState([]);
  const [showChatModal, setShowChatModal] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const router = useRouter();

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
      if (showChatModal) setChatMessages((prev) => [...prev, message]);
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

  const openChat = async (applicationId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/chat/${applicationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load chat");
      const chat = await res.json();
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
    if (!newMessage && !attachment) return;
    const token = localStorage.getItem("token");
    const formData = new FormData();
    if (newMessage) formData.append("content", newMessage);
    if (attachment) formData.append("attachment", attachment);

    try {
      const res = await fetch(`http://localhost:5000/api/chat/${showChatModal._id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to send message");
      const message = await res.json();
      socket.emit("sendMessage", { chatId: showChatModal._id, message });
      setNewMessage("");
      setAttachment(null);
    } catch (err) {
      toast.error(`Error sending message: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#373737]">
      <Navbar userType="recruiter" />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-semibold text-center uppercase text-white mb-8">Track Applicants</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {applications.map((app) => (
            <div key={app._id} className="p-6 rounded-lg shadow-md bg-[#d9d9d9]">
              <h3 className="font-semibold text-lg text-[#313131]">{app.job.title}</h3>
              <p className="text-sm text-[#313131]">Candidate: {app.candidate.username}</p>
              <p className="text-sm text-[#313131]">Status: {app.status}</p>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => openChat(app._id)}
                  className="text-sm px-4 py-2 rounded-lg bg-[#4a4a4a] text-white hover:bg-[#313131]"
                >
                  Chat
                </button>
                <a
                  href={`http://localhost:5000/api/resume/download/${app.candidate._id}`}
                  className="text-sm px-4 py-2 rounded-lg bg-[#313131] text-white hover:bg-[#4a4a4a]"
                >
                  Download Resume
                </a>
              </div>
            </div>
          ))}
        </div>

        {showChatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#d9d9d9] p-6 rounded-lg shadow-lg w-full max-w-lg">
              <h2 className="text-xl font-bold text-[#313131] mb-4">Chat with Candidate</h2>
              <div className="h-64 overflow-y-auto mb-4 bg-white p-2 rounded">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-2 ${msg.sender === localStorage.getItem("userId") ? "text-right" : "text-left"}`}
                  >
                    <p className="text-[#313131]">{msg.content}</p>
                    {msg.attachment && (
                      <a href={`http://localhost:5000${msg.attachment}`} target="_blank" className="text-blue-500">
                        {msg.attachmentType === "link" ? msg.content : `Attachment (${msg.attachmentType})`}
                      </a>
                    )}
                    <span className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#313131] text-[#313131]"
                placeholder="Type a message..."
              />
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)}
                className="mt-2"
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button
                  onClick={() => setShowChatModal(null)}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Close
                </button>
                <button
                  onClick={sendMessage}
                  className="bg-[#313131] text-white px-4 py-2 rounded hover:bg-[#4a4a4a]"
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
            className="fixed top-4 right-4 bg-[#313131] text-white p-4 rounded-lg shadow-lg z-50"
          >
            New message in chat {notif.chatId}
          </div>
        ))}
      </main>
    </div>
  );
}