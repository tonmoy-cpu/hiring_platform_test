"use client";
import Link from "next/link";
import { Home, Briefcase, FileText, BarChart, MessageSquare, Settings, User, HelpCircle, X, PlusCircle } from 'lucide-react';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  userType?: "candidate" | "recruiter";
};

export default function Sidebar({ isOpen, onClose, userType = "candidate" }: SidebarProps) {
  return (
    <>
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-accent shadow-lg transform transition-transform duration-300 ease-in-out z-20 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="text-xl font-bold text-primary">Hire<span className="text-foreground">ON</span></div> {/* Use text-foreground */}
          <button 
            onClick={onClose}
            className="btn-icon" // Use btn-icon
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-1">
          <Link 
            href={userType === "recruiter" ? "/recruiter/dashboard" : "/dashboard"} 
            onClick={onClose}
            className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
          >
            <Home className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          {userType === "candidate" ? (
            <>
              <Link 
                href="/jobs" 
                onClick={onClose}
                className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
              >
                <Briefcase className="h-5 w-5" />
                <span>Browse Jobs</span>
              </Link>
              
              <Link 
                href="/resume-extraction" 
                onClick={onClose}
                className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
              >
                <FileText className="h-5 w-5" />
                <span>Resume Extraction</span>
              </Link>
              
              <Link 
                href="/track-applications" 
                onClick={onClose}
                className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
              >
                <BarChart className="h-5 w-5" />
                <span>Track Applications</span>
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/recruiter/post-job" 
                onClick={onClose}
                className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
              >
                <PlusCircle className="h-5 w-5" />
                <span>Post Job</span>
              </Link>
              
              <Link 
                href="/recruiter/track-applicants" 
                onClick={onClose}
                className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
              >
                <FileText className="h-5 w-5" />
                <span>Track Applicants</span>
              </Link>
              
              <Link 
                href="/recruiter/analytics" 
                onClick={onClose}
                className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
              >
                <BarChart className="h-5 w-5" />
                <span>Analytics</span>
              </Link>
            </>
          )}

          <div className="pt-4 mt-4 border-t border-border">
            <Link 
              href="/profile" 
              onClick={onClose}
              className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </Link>
            
            <Link 
              href="/settings" 
              onClick={onClose}
              className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
            
            <Link 
              href="/help" 
              onClick={onClose}
              className="flex items-center gap-3 py-3 px-4 hover:bg-primary hover:bg-opacity-10 rounded-lg transition-all text-foreground hover:text-primary" // Use text-foreground
            >
              <HelpCircle className="h-5 w-5" />
              <span>Help & Support</span>
            </Link>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="text-xs text-gray-400 text-center">
            &copy; {new Date().getFullYear()} HireON
          </div>
        </div>
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10 transition-opacity duration-300" 
          onClick={onClose} 
        />
      )}
    </>
  );
}
