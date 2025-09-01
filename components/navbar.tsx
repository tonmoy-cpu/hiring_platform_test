"use client";

import Link from "next/link";
import { Menu, Bell, User, LogOut, Settings, Home, Briefcase, FileText } from 'lucide-react';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Sidebar from "./sidebar";
import { skillOptions, domainOptions } from "@/lib/utils";

interface NavbarProps {
  userType?: "candidate" | "recruiter";
}

export default function Navbar({ userType = "candidate" }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState<string>("/images/default-profile.png");
  const [imageError, setImageError] = useState(false);
  const [showPreferencesPopup, setShowPreferencesPopup] = useState(false);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [preferredDomains, setPreferredDomains] = useState<string[]>([]);
  const [username, setUsername] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/");
        return;
      }
      try {
        const res = await fetch("http://localhost:5000/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setProfilePic(data.profilePic || "/images/default-profile.png");
        setUsername(data.username || "User");
        if (userType === "candidate") {
          setPreferredSkills(data.preferredSkills || []);
          setPreferredDomains(data.preferredDomains || []);
        }
      } catch (err) {
        toast.error(`Failed to load profile: ${err.message}`);
        if (err.message.includes("401")) {
          localStorage.removeItem("token");
          router.push("/");
        }
      }
    };
    fetchProfile();
  }, [router, userType]);

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("token");
      router.push("/");
      setIsMenuOpen(false);
      setIsProfileOpen(false);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!imageError) {
      e.currentTarget.src = "/images/default-profile.png";
      setImageError(true);
    }
  };

  const handleSkillChange = (skill: string) => {
    setPreferredSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleDomainChange = (domain: string) => {
    setPreferredDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const savePreferences = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preferredSkills, preferredDomains }),
      });
      if (!res.ok) throw new Error(`Failed to save preferences: ${res.status}`);
      setShowPreferencesPopup(false);
      toast.success("Preferences saved successfully!");
    } catch (err) {
      toast.error(`Error saving preferences: ${err.message}`);
      if (err.message.includes("401")) {
        localStorage.removeItem("token");
        router.push("/");
      }
    }
  };

  return (
    <>
      <nav className="bg-accent p-4 flex items-center justify-between shadow-md relative z-30 sticky top-0">
        <div className="flex items-center">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="focus:outline-none mr-4 btn-icon"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href={userType === "recruiter" ? "/recruiter/dashboard" : "/dashboard"} className="flex items-center">
            <span className="text-xl font-bold text-primary">Hire<span className="text-white">ON</span></span>
          </Link>
        </div>

        <div className="hidden md:flex flex-1 justify-center space-x-8 items-center">
          <Link
            href={userType === "recruiter" ? "/recruiter/dashboard" : "/dashboard"}
            className="nav-link flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </Link>
          
          {userType === "candidate" ? (
            <>
              <Link href="/jobs" className="nav-link flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>Jobs</span>
              </Link>
              <Link href="/track-applications" className="nav-link flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Applications</span>
              </Link>
              <Link href="/resume-builder" className="nav-link flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Resume Builder</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/recruiter/post-job" className="nav-link flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>Post Job</span>
              </Link>
              <Link href="/recruiter/track-applicants" className="nav-link flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Applicants</span>
              </Link>
            </>
          )}
          
          {userType === "candidate" && (
            <button
              onClick={() => setShowPreferencesPopup(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              <span>Preferences</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button className="btn-icon relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 bg-primary text-xs text-accent rounded-full h-4 w-4 flex items-center justify-center">
              2
            </span>
          </button>
          
          <div className="relative">
            <div 
              className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-opacity-20 hover:bg-primary transition-all"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <img
                src={profilePic.startsWith('http') ? profilePic : `http://localhost:5000${profilePic}`}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border-2 border-primary"
                onError={handleImageError}
              />
              <span className="hidden md:block text-sm font-medium">{username}</span>
            </div>
            
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 dropdown-menu rounded-md shadow-lg z-30 animate-fade-in">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium">{username}</p>
                  <p className="text-xs text-gray-400">{userType}</p>
                </div>
                <Link
                  href="/profile"
                  className="dropdown-item flex items-center gap-2"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="dropdown-item flex items-center gap-2 w-full text-left text-danger"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} userType={userType} />

      {showPreferencesPopup && userType === "candidate" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 modal">
          <div className="bg-accent p-6 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto modal-content">
            <h2 className="text-xl font-bold text-primary mb-6">Set Your Preferences</h2>
            <div className="mb-6">
              <h3 className="font-bold text-white mb-3">Skills</h3>
              <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto p-2 bg-background rounded-lg">
                {skillOptions.map((skill) => (
                  <label key={skill} className="flex items-center text-white hover:text-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={preferredSkills.includes(skill)}
                      onChange={() => handleSkillChange(skill)}
                      className="mr-2 accent-primary"
                    />
                    <span className="text-sm">{skill}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <h3 className="font-bold text-white mb-3">Domains</h3>
              <div className="grid grid-cols-1 gap-3 max-h-40 overflow-y-auto p-2 bg-background rounded-lg">
                {domainOptions.map((domain) => (
                  <label key={domain} className="flex items-center text-white hover:text-primary transition-colors">
                    <input
                      type="checkbox"
                      checked={preferredDomains.includes(domain)}
                      onChange={() => handleDomainChange(domain)}
                      className="mr-2 accent-primary"
                    />
                    <span className="text-sm">{domain}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-between space-x-4">
              <button
                onClick={savePreferences}
                className="btn-primary w-full"
              >
                Save Preferences
              </button>
              <button
                onClick={() => setShowPreferencesPopup(false)}
                className="btn-secondary w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}