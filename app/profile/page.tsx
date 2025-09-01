// /app/profile/page.tsx
"use client";

import Navbar from "@/components/navbar";
import { useState, useEffect } from "react";
import toast from "react-hot-toast"; // Import toast

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found");
        return;
      }
      try {
        const res = await fetch("http://localhost:5000/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
        const data = await res.json();
        console.log("Profile fetched:", data);
        setProfile(data);
        setFormData(data.resumeParsed || { contact: {}, skills: [], experience: [], education: [] });
      } catch (err) {
        console.error("Error fetching profile:", err.message);
        toast.error(`Error fetching profile: ${err.message}`); // Use toast
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e, section) => {
    const updated = { ...formData };
    if (section === "contact") {
      updated.contact = { ...updated.contact, [e.target.name]: e.target.value };
    }
    setFormData(updated);
  };

  const handleArrayChange = (section, index, value) => {
    const updated = { ...formData };
    if (section === "skills") {
      updated.skills[index] = value;
    } else {
      updated[section][index] = { ...updated[section][index], ...value };
    }
    setFormData(updated);
  };

  const addItem = (section) => {
    const updated = { ...formData };
    if (section === "skills") {
      updated.skills.push("");
    } else if (section === "experience") {
      updated.experience.push({ title: "", company: "", years: "" });
    } else if (section === "education") {
      updated.education.push({ degree: "", school: "", year: "" });
    }
    setFormData(updated);
  };

  const removeItem = (section, index) => {
    const updated = { ...formData };
    updated[section].splice(index, 1);
    setFormData(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:5000/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeParsed: formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Failed to update profile");
      setProfile({ ...profile, resumeParsed: formData });
      setEditMode(false);
      toast.success("Profile updated successfully!"); // Use toast
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error("Error: " + err.message); // Use toast
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "/uploads/default.jpg"; // Corrected path
  };

  if (!profile) return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Loading...</div>; // Use bg-background and text-foreground

  return (
    <div className="min-h-screen flex flex-col bg-background"> {/* Use bg-background */}
      <Navbar userType={profile.userType} />
      <main className="flex-1 p-6">
        <div className="bg-accent p-6 rounded-lg mb-8 shadow-md"> {/* Use bg-accent */}
          <h1 className="text-3xl font-semibold text-center text-foreground">Profile Details</h1> {/* Use text-foreground */}
        </div>
        <div className="bg-accent p-8 rounded-lg shadow-md"> {/* Use bg-accent */}
          <div className="flex justify-center mb-6">
            <img
              src={profile.profilePic?.startsWith('http') ? profile.profilePic : `http://localhost:5000${profile.profilePic || '/uploads/default.jpg'}`}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-4 border-primary shadow-lg" // Use border-primary
              onError={handleImageError}
            />
          </div>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">{profile.username}</h2> {/* Use text-foreground */}
            <p className="text-gray-300">{profile.email}</p>
            <p className="text-sm text-gray-400 capitalize">{profile.userType}</p>
          </div>
          {profile.resumeParsed ? (
            editMode ? (
              <div className="mt-4">
                <h3 className="font-bold text-foreground text-lg mb-2">Contact</h3> {/* Use text-foreground */}
                <input
                  name="name"
                  value={formData.contact?.name || ""}
                  onChange={(e) => handleChange(e, "contact")}
                  className="input-field mb-2" // Use input-field
                  placeholder="Name"
                />
                <input
                  name="email"
                  value={formData.contact?.email || ""}
                  onChange={(e) => handleChange(e, "contact")}
                  className="input-field mb-2" // Use input-field
                  placeholder="Email"
                />
                <input
                  name="phone"
                  value={formData.contact?.phone || ""}
                  onChange={(e) => handleChange(e, "contact")}
                  className="input-field mb-2" // Use input-field
                  placeholder="Phone"
                />
                <h3 className="font-bold text-foreground text-lg mt-4 mb-2">Skills</h3> {/* Use text-foreground */}
                {formData.skills?.map((skill, i) => (
                  <div key={i} className="flex items-center mb-2">
                    <input
                      value={skill}
                      onChange={(e) => handleArrayChange("skills", i, e.target.value)}
                      className="input-field flex-1" // Use input-field
                      placeholder="Skill"
                    />
                    <button
                      onClick={() => removeItem("skills", i)}
                      className="ml-2 btn-danger" // Use btn-danger
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addItem("skills")}
                  className="btn-secondary mt-2" // Use btn-secondary
                >
                  Add Skill
                </button>
                <h3 className="font-bold text-foreground text-lg mt-4 mb-2">Experience</h3> {/* Use text-foreground */}
                {formData.experience?.map((exp, i) => (
                  <div key={i} className="mb-4 border-b border-border pb-2"> {/* Use border-border */}
                    <input
                      name="title"
                      value={exp.title || ""}
                      onChange={(e) => handleArrayChange("experience", i, { title: e.target.value })}
                      className="input-field mb-2" // Use input-field
                      placeholder="Job Title"
                    />
                    <input
                      name="company"
                      value={exp.company || ""}
                      onChange={(e) => handleArrayChange("experience", i, { company: e.target.value })}
                      className="input-field mb-2" // Use input-field
                      placeholder="Company"
                    />
                    <input
                      name="years"
                      value={exp.years || ""}
                      onChange={(e) => handleArrayChange("experience", i, { years: e.target.value })}
                      className="input-field mb-2" // Use input-field
                      placeholder="Years (e.g., 2019-2021)"
                    />
                    <button
                      onClick={() => removeItem("experience", i)}
                      className="btn-danger" // Use btn-danger
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addItem("experience")}
                  className="btn-secondary mt-2" // Use btn-secondary
                >
                  Add Experience
                </button>
                <h3 className="font-bold text-foreground text-lg mt-4 mb-2">Education</h3> {/* Use text-foreground */}
                {formData.education?.map((edu, i) => (
                  <div key={i} className="mb-4 border-b border-border pb-2"> {/* Use border-border */}
                    <input
                      name="degree"
                      value={edu.degree || ""}
                      onChange={(e) => handleArrayChange("education", i, { degree: e.target.value })}
                      className="input-field mb-2" // Use input-field
                      placeholder="Degree"
                    />
                    <input
                      name="school"
                      value={edu.school || ""}
                      onChange={(e) => handleArrayChange("education", i, { school: e.target.value })}
                      className="input-field mb-2" // Use input-field
                      placeholder="School"
                    />
                    <input
                      name="year"
                      value={edu.year || ""}
                      onChange={(e) => handleArrayChange("education", i, { year: e.target.value })}
                      className="input-field mb-2" // Use input-field
                      placeholder="Year"
                    />
                    <button
                      onClick={() => removeItem("education", i)}
                      className="btn-danger" // Use btn-danger
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addItem("education")}
                  className="btn-secondary mt-2" // Use btn-secondary
                >
                  Add Education
                </button>
                <div className="flex justify-center mt-6 space-x-4">
                  <button
                    onClick={() => setEditMode(false)}
                    className="btn-secondary" // Use btn-secondary
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary" // Use btn-primary
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-6 text-foreground"> {/* Use text-foreground */}
                <div>
                  <h3 className="font-bold text-lg mb-2">Contact</h3>
                  <p>{profile.resumeParsed.contact?.name || "N/A"}</p>
                  <p>{profile.resumeParsed.contact?.email || "N/A"}</p>
                  <p>{profile.resumeParsed.contact?.phone || "N/A"}</p>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">Skills</h3>
                  <ul className="list-disc pl-4">
                    {profile.resumeParsed.skills?.map((s) => <li key={s}>{s}</li>) || <li>N/A</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">Experience</h3>
                  {profile.resumeParsed.experience?.map((e, i) => (
                    <p key={i}>
                      {e.title} at {e.company} ({e.years})
                    </p>
                  )) || <p>N/A</p>}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">Education</h3>
                  {profile.resumeParsed.education?.map((e, i) => (
                    <p key={i}>
                      {e.degree}, {e.school} ({e.year})
                    </p>
                  )) || <p>N/A</p>}
                </div>
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setEditMode(true)}
                    className="btn-primary" // Use btn-primary
                  >
                    Edit
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="text-center text-gray-400">No resume uploaded yet.</p> // Use gray-400
          )}
        </div>
      </main>
    </div>
  );
}
