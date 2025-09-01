import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const skillOptions = [
  "Node.js", "React.js", "React Native", "Figma", "Next.js", "JavaScript", "TypeScript",
  "Python", "Django", "Flask", "Java", "Spring", "C#", ".NET", "C++", "Go", "Ruby",
  "Rails", "PHP", "Laravel", "Angular", "Vue.js", "Svelte", "HTML", "CSS", "Tailwind CSS",
  "Bootstrap", "SQL", "MongoDB", "PostgreSQL", "MySQL", "Redis", "GraphQL", "REST API",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Jenkins", "Git", "CI/CD",
  "Machine Learning", "TensorFlow", "PyTorch", "Data Analysis", "Pandas", "NumPy",
  "UI/UX Design", "Adobe XD", "Sketch", "Blockchain", "Solidity", "Cybersecurity",
];

export const domainOptions = [
  "Web Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Mobile Developer", "UI/UX Designer", "Business Analyst", "Data Analyst", "Data Scientist",
  "Machine Learning Engineer", "DevOps Engineer", "Cloud Architect", "Software Engineer",
  "Systems Analyst", "Database Administrator", "Network Engineer", "Cybersecurity Analyst",
  "Product Manager", "Project Manager", "QA Engineer", "Game Developer", "Blockchain Developer",
  "AI Engineer", "Embedded Systems Engineer", "Robotics Engineer", "Graphic Designer",
];

export function formatResumeData(data: any) {
  return JSON.stringify(data, null, 2);
}

export async function fetchResumeFeedback(token: string, jobId: string, resumeText: string) {
  const res = await fetch(`http://localhost:5000/api/resume/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jobId, resume: resumeText }),
  });
  if (!res.ok) throw new Error("Failed to fetch feedback");
  const data = await res.json();
  console.log("Raw API response in fetchResumeFeedback:", data);
  // Map the response to match the feedback state structure, prioritizing matchScore if present
  return {
    score: data.matchScore !== undefined ? data.matchScore : (data.score || 0),
    matchedSkills: data.matchedSkills || [],
    missingSkills: data.missingSkills || [],
    feedback: data.feedback || [],
  };
}