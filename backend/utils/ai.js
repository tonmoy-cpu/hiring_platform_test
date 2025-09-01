const { HfInference } = require("@huggingface/inference");
const User = require("../models/User");
const axios = require("axios");

const hf = new HfInference(process.env.HF_API_KEY);
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

// Comprehensive skills mapping for better matching
const skillsMapping = {
  // JavaScript ecosystem
  "javascript": ["js", "javascript", "ecmascript"],
  "typescript": ["ts", "typescript"],
  "react": ["react", "reactjs", "react.js", "reactnative", "react native"],
  "node": ["node", "nodejs", "node.js"],
  "next": ["next", "nextjs", "next.js"],
  "vue": ["vue", "vuejs", "vue.js"],
  "angular": ["angular", "angularjs"],
  
  // Backend frameworks
  "express": ["express", "expressjs", "express.js"],
  "django": ["django"],
  "flask": ["flask"],
  "spring": ["spring", "springboot", "spring boot"],
  "laravel": ["laravel"],
  "rails": ["rails", "ruby on rails"],
  
  // Databases
  "mongodb": ["mongo", "mongodb"],
  "postgresql": ["postgres", "postgresql"],
  "mysql": ["mysql"],
  "redis": ["redis"],
  
  // Cloud & DevOps
  "aws": ["aws", "amazon web services"],
  "azure": ["azure", "microsoft azure"],
  "docker": ["docker", "containerization"],
  "kubernetes": ["k8s", "kubernetes"],
  "jenkins": ["jenkins"],
  
  // Other technologies
  "python": ["python", "py"],
  "java": ["java"],
  "csharp": ["c#", "csharp", ".net", "dotnet"],
  "cpp": ["c++", "cpp"],
  "go": ["go", "golang"],
  "php": ["php"],
  "ruby": ["ruby"],
  "git": ["git", "github", "gitlab"],
  "sql": ["sql", "database"],
  "html": ["html", "html5"],
  "css": ["css", "css3", "styling"],
  "tailwind": ["tailwind", "tailwindcss"],
  "bootstrap": ["bootstrap"],
  "figma": ["figma", "design"],
  "graphql": ["graphql", "gql"],
  "rest": ["rest", "restapi", "rest api"],
  "machine learning": ["ml", "machine learning", "ai", "artificial intelligence"],
  "tensorflow": ["tensorflow", "tf"],
  "pytorch": ["pytorch", "torch"],
  "pandas": ["pandas"],
  "numpy": ["numpy"],
};

// Normalize and map skills for better matching
function normalizeSkill(skill) {
  const normalized = skill.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "")
    .trim();
  
  // Find mapped skill
  for (const [key, variants] of Object.entries(skillsMapping)) {
    if (variants.some(variant => normalized.includes(variant) || variant.includes(normalized))) {
      return key;
    }
  }
  return normalized;
}

// Enhanced skill matching with fuzzy logic
function matchSkills(resumeSkills, jobSkills) {
  const normalizedResumeSkills = resumeSkills.map(normalizeSkill);
  const normalizedJobSkills = jobSkills.map(normalizeSkill);
  
  const matchedSkills = [];
  const missingSkills = [];
  
  for (const jobSkill of jobSkills) {
    const normalizedJobSkill = normalizeSkill(jobSkill);
    const isMatched = normalizedResumeSkills.some(resumeSkill => {
      // Exact match
      if (resumeSkill === normalizedJobSkill) return true;
      
      // Partial match (for compound skills)
      if (resumeSkill.includes(normalizedJobSkill) || normalizedJobSkill.includes(resumeSkill)) {
        return true;
      }
      
      // Check skill variants
      const jobVariants = skillsMapping[normalizedJobSkill] || [normalizedJobSkill];
      const resumeVariants = skillsMapping[resumeSkill] || [resumeSkill];
      
      return jobVariants.some(jv => resumeVariants.some(rv => 
        jv === rv || jv.includes(rv) || rv.includes(jv)
      ));
    });
    
    if (isMatched) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push({
        skill: jobSkill,
        suggestion: `Consider learning ${jobSkill} through online courses or practical projects.`
      });
    }
  }
  
  return { matchedSkills, missingSkills };
}

// Calculate comprehensive score based on multiple factors
function calculateCompatibilityScore(resumeData, jobData, matchedSkills, jobSkills) {
  let score = 0;
  
  // Skills matching (40% weight)
  const skillsScore = jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) * 40 : 0;
  score += skillsScore;
  
  // Experience relevance (35% weight)
  const experience = resumeData.experience || [];
  let experienceScore = 0;
  
  if (experience.length > 0) {
    // Calculate total years of experience
    const totalYears = experience.reduce((total, exp) => {
      const years = exp.years || "";
      const yearMatch = years.match(/(\d{4})\s*[-–—]\s*(\d{4}|present)/i);
      if (yearMatch) {
        const startYear = parseInt(yearMatch[1]);
        const endYear = yearMatch[2].toLowerCase() === 'present' ? new Date().getFullYear() : parseInt(yearMatch[2]);
        return total + (endYear - startYear);
      }
      return total;
    }, 0);
    
    // Score based on experience (more experience = higher score, capped at 35)
    experienceScore = Math.min(totalYears * 5, 35);
    
    // Bonus for relevant job titles
    const relevantTitles = experience.some(exp => {
      const title = exp.title.toLowerCase();
      const jobTitle = jobData.title.toLowerCase();
      return title.includes(jobTitle.split(' ')[0]) || jobTitle.includes(title.split(' ')[0]);
    });
    
    if (relevantTitles) experienceScore += 5;
  }
  
  score += experienceScore;
  
  // Education relevance (15% weight)
  const education = resumeData.education || [];
  let educationScore = 0;
  
  if (education.length > 0) {
    // Check for relevant degrees
    const relevantEducation = education.some(edu => {
      const degree = edu.degree.toLowerCase();
      return degree.includes('computer') || degree.includes('software') || 
             degree.includes('engineering') || degree.includes('technology') ||
             degree.includes('science');
    });
    
    if (relevantEducation) educationScore = 15;
    else educationScore = 8; // Some education is better than none
  }
  
  score += educationScore;
  
  // Contact completeness (10% weight)
  const contact = resumeData.contact || {};
  const contactScore = (contact.name && contact.email && contact.phone) ? 10 : 5;
  score += contactScore;
  
  return Math.min(Math.round(score), 100);
}

// Generate comprehensive feedback
async function generateComprehensiveFeedback(resumeData, jobData, matchedSkills, missingSkills, score) {
  const feedback = [];
  
  // Skills feedback
  if (matchedSkills.length > 0) {
    feedback.push(`Strong match with ${matchedSkills.length} required skills: ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? ' and more' : ''}.`);
  }
  
  if (missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 3).map(m => m.skill).join(', ');
    feedback.push(`Consider developing these key skills: ${topMissing}. These are highly valued for this role.`);
  }
  
  // Experience feedback
  const experience = resumeData.experience || [];
  if (experience.length === 0) {
    feedback.push("Add relevant work experience or projects to strengthen your application.");
  } else {
    const hasRelevantExp = experience.some(exp => 
      exp.title.toLowerCase().includes(jobData.title.toLowerCase().split(' ')[0])
    );
    if (!hasRelevantExp) {
      feedback.push("Highlight experience that directly relates to this role for better alignment.");
    }
  }
  
  // Education feedback
  const education = resumeData.education || [];
  if (education.length === 0) {
    feedback.push("Include your educational background to provide a complete profile.");
  }
  
  // Contact feedback
  const contact = resumeData.contact || {};
  if (!contact.name || !contact.email || !contact.phone) {
    feedback.push("Ensure all contact information (name, email, phone) is complete and professional.");
  }
  
  // Score-based feedback
  if (score >= 80) {
    feedback.push("Excellent match! Your profile aligns very well with this position.");
  } else if (score >= 60) {
    feedback.push("Good potential match. Consider addressing the missing skills to improve your candidacy.");
  } else if (score >= 40) {
    feedback.push("Moderate match. Focus on developing the missing skills and gaining relevant experience.");
  } else {
    feedback.push("Consider building more relevant skills and experience before applying to this role.");
  }
  
  return feedback;
}

// Enhanced extractResumeDetails function
async function extractResumeDetails(resumeText, preParsedData = null) {
  if (preParsedData && preParsedData.skills) {
    console.log("Using pre-parsed resume data:", JSON.stringify(preParsedData, null, 2));
    return {
      contact: preParsedData.contact || { name: "Unknown", email: "N/A", phone: "N/A" },
      skills: preParsedData.skills || [],
      experience: preParsedData.experience || [],
      education: preParsedData.education || [],
    };
  }

  try {
    const lines = resumeText.replace(/\s+/g, " ").trim().split("\n").map(line => line.trim()).filter(line => line);

    // Extract contact information
    const contact = {
      name: "Unknown",
      email: resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || "N/A",
      phone: resumeText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || "N/A",
    };

    // Extract name from first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].length > 2 && !lines[i].includes("@") && !/\d{3}/.test(lines[i]) && 
          !lines[i].toLowerCase().includes("resume") && !lines[i].toLowerCase().includes("cv")) {
        contact.name = lines[i];
        break;
      }
    }

    // Extract skills using keyword matching
    const skillKeywords = Object.values(skillsMapping).flat();
    const extractedSkills = new Set();
    
    const skillsText = resumeText.toLowerCase();
    skillKeywords.forEach(skill => {
      if (skillsText.includes(skill.toLowerCase())) {
        // Find the canonical skill name
        for (const [canonical, variants] of Object.entries(skillsMapping)) {
          if (variants.includes(skill)) {
            extractedSkills.add(canonical);
            break;
          }
        }
      }
    });

    // Extract experience
    const experience = [];
    const expSection = resumeText.match(/experience[\s\S]*?(?=education|skills|$)/i)?.[0] || "";
    const expEntries = expSection.split(/\n(?=\w)/);
    
    expEntries.forEach(entry => {
      const dateMatch = entry.match(/(\d{4})\s*[-–—]\s*(\d{4}|present)/i);
      if (dateMatch) {
        const titleMatch = entry.match(/^([^\n]+)/);
        const companyMatch = entry.match(/at\s+([^\n,]+)|,\s*([^\n]+)/i);
        
        experience.push({
          title: titleMatch ? titleMatch[1].trim() : "Unknown Position",
          company: companyMatch ? (companyMatch[1] || companyMatch[2]).trim() : "Unknown Company",
          years: dateMatch[0],
          duration: dateMatch[2].toLowerCase() === 'present' ? 
            new Date().getFullYear() - parseInt(dateMatch[1]) : 
            parseInt(dateMatch[2]) - parseInt(dateMatch[1])
        });
      }
    });

    // Extract education
    const education = [];
    const eduSection = resumeText.match(/education[\s\S]*?(?=experience|skills|$)/i)?.[0] || "";
    const eduEntries = eduSection.split(/\n(?=\w)/);
    
    eduEntries.forEach(entry => {
      const degreeMatch = entry.match(/(bachelor|master|phd|b\.s\.|m\.s\.|ph\.d\.|diploma|certificate)/i);
      const yearMatch = entry.match(/\d{4}/);
      const schoolMatch = entry.match(/(?:from|at)\s+([^\n,]+)|,\s*([^\n]+)/i);
      
      if (degreeMatch || yearMatch) {
        education.push({
          degree: degreeMatch ? degreeMatch[0] : "Degree",
          school: schoolMatch ? (schoolMatch[1] || schoolMatch[2]).trim() : "Unknown Institution",
          year: yearMatch ? yearMatch[0] : "N/A",
          level: degreeMatch ? (
            degreeMatch[0].toLowerCase().includes('phd') || degreeMatch[0].toLowerCase().includes('ph.d') ? 3 :
            degreeMatch[0].toLowerCase().includes('master') || degreeMatch[0].toLowerCase().includes('m.s') ? 2 : 1
          ) : 1
        });
      }
    });

    return {
      contact,
      skills: Array.from(extractedSkills),
      experience,
      education,
    };
  } catch (err) {
    console.error("Error in extractResumeDetails:", err);
    return {
      contact: { name: "Unknown", email: "N/A", phone: "N/A" },
      skills: [],
      experience: [],
      education: [],
    };
  }
}

// Enhanced AI analysis with Gemini
async function analyzeResumeWithGemini(resumeData, jobData) {
  const maxRetries = 3;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `
        Analyze this resume against the job requirements and provide detailed feedback.
        
        Job Title: ${jobData.title}
        Job Domain: ${jobData.details}
        Required Skills: ${jobData.skills.join(", ")}
        
        Candidate Profile:
        - Skills: ${resumeData.skills.join(", ")}
        - Experience: ${resumeData.experience.map(e => `${e.title} at ${e.company} (${e.years})`).join("; ")}
        - Education: ${resumeData.education.map(e => `${e.degree} from ${e.school} (${e.year})`).join("; ")}
        
        Provide 3-5 specific, actionable feedback points to improve the candidate's application for this role.
        Focus on skill gaps, experience relevance, and overall fit.
        
        Return only a JSON object with this structure:
        {
          "feedback": ["feedback point 1", "feedback point 2", "feedback point 3"]
        }
      `;

      console.log("Sending enhanced prompt to Gemini API (attempt " + attempt + ")");

      const response = await axios.post(
        GEMINI_API_URL,
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          timeout: 30000,
        }
      );

      const geminiResult = response.data.candidates[0].content.parts[0].text;
      console.log("Raw Gemini response:", geminiResult);

      let parsedResult;
      try {
        // Clean the response to extract JSON
        const jsonMatch = geminiResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseErr) {
        console.error("Failed to parse Gemini response:", parseErr.message);
        return {
          feedback: [
            "Unable to generate AI feedback at this time.",
            "Please ensure your resume includes relevant skills and experience.",
            "Consider tailoring your application to match the job requirements."
          ]
        };
      }

      console.log("Parsed Gemini feedback:", parsedResult);
      return { feedback: Array.isArray(parsedResult.feedback) ? parsedResult.feedback : [] };
    } catch (err) {
      console.error("Error in analyzeResumeWithGemini (attempt " + attempt + "):", err.message);
      if (attempt < maxRetries && (err.code === "ECONNABORTED" || err.response?.status >= 500)) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying Gemini API call, waiting ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      return {
        feedback: [
          "AI analysis temporarily unavailable.",
          "Ensure your resume highlights relevant skills and experience.",
          "Tailor your application to match the specific job requirements."
        ]
      };
    }
  }
}

// Main analysis function with improved accuracy
async function analyzeResumeAgainstJob(resumeText, job, candidateId, preParsedData = null) {
  try {
    console.log("Starting enhanced resume analysis for job:", job.title);
    
    // Get candidate's stored resume data
    let resumeData;
    if (candidateId) {
      const user = await User.findById(candidateId).select("resumeParsed");
      if (user && user.resumeParsed) {
        resumeData = user.resumeParsed;
        console.log("Using stored resume data from user profile");
      } else {
        resumeData = await extractResumeDetails(resumeText, preParsedData);
        console.log("Extracted resume data from text");
      }
    } else {
      resumeData = preParsedData || await extractResumeDetails(resumeText);
      console.log("Using provided or extracted resume data");
    }

    console.log("Resume data for analysis:", {
      skills: resumeData.skills,
      experienceCount: resumeData.experience?.length || 0,
      educationCount: resumeData.education?.length || 0
    });

    // Perform skill matching
    const { matchedSkills, missingSkills } = matchSkills(resumeData.skills || [], job.skills || []);
    
    // Calculate compatibility score
    const score = calculateCompatibilityScore(resumeData, job, matchedSkills, job.skills || []);
    
    // Generate AI feedback
    let feedback = [
      "Ensure your resume highlights relevant technical skills.",
      "Add quantifiable achievements and project outcomes.",
      "Tailor your experience descriptions to match job requirements."
    ];
    
    try {
      const geminiResult = await analyzeResumeWithGemini(resumeData, job);
      if (geminiResult.feedback && geminiResult.feedback.length > 0) {
        feedback = geminiResult.feedback;
        console.log("Successfully integrated enhanced Gemini feedback");
      }
    } catch (geminiErr) {
      console.warn("Gemini analysis failed, using fallback feedback:", geminiErr.message);
    }

    const result = {
      score,
      matchedSkills,
      missingSkills,
      feedback,
      extractedSkills: resumeData.skills || [],
      resumeData
    };

    console.log("Final enhanced analysis result:", result);
    return result;
  } catch (err) {
    console.error("Error in analyzeResumeAgainstJob:", err.message, err.stack);
    return {
      score: 0,
      feedback: ["Error analyzing resume. Please ensure the resume is valid and try again."],
      matchedSkills: [],
      missingSkills: job.skills.map((skill) => ({
        skill,
        suggestion: "Consider learning this skill through online courses or practical projects.",
      })),
      extractedSkills: [],
      resumeData: null
    };
  }
}

// Calculate ATS score for resume builder
function calculateATSScore(resumeSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) return 0;
  
  const { matchedSkills } = matchSkills(resumeSkills, jobSkills);
  const baseScore = (matchedSkills.length / jobSkills.length) * 100;
  
  // ATS bonus factors
  let bonusScore = 0;
  
  // Keyword density bonus
  if (matchedSkills.length >= jobSkills.length * 0.8) bonusScore += 10;
  
  // Skills variety bonus
  if (resumeSkills.length >= 5) bonusScore += 5;
  
  return Math.min(Math.round(baseScore + bonusScore), 100);
}

// Generate ATS-specific feedback
function generateATSFeedback(resumeSkills, jobSkills, resumeData) {
  const feedback = [];
  const { matchedSkills, missingSkills } = matchSkills(resumeSkills, jobSkills);
  
  if (missingSkills.length > 0) {
    const criticalMissing = missingSkills.slice(0, 3).map(m => m.skill);
    feedback.push(`Include these keywords for better ATS compatibility: ${criticalMissing.join(", ")}.`);
  }
  
  if (matchedSkills.length === 0) {
    feedback.push("Add relevant technical skills that match the job requirements.");
  }
  
  if (!resumeData.contact?.name || !resumeData.contact?.email) {
    feedback.push("Ensure contact information is complete and properly formatted.");
  }
  
  if (!resumeData.experience || resumeData.experience.length === 0) {
    feedback.push("Add work experience or relevant projects to improve ATS scoring.");
  }
  
  if (feedback.length === 0) {
    feedback.push("Your resume has good ATS compatibility for this position.");
  }
  
  return feedback;
}

module.exports = { 
  extractResumeDetails, 
  analyzeResumeAgainstJob, 
  calculateATSScore, 
  generateATSFeedback,
  matchSkills,
  calculateCompatibilityScore
};