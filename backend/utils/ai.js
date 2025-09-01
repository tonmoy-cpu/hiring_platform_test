const { HfInference } = require("@huggingface/inference");
const User = require("../models/User");
const axios = require("axios");

const hf = new HfInference(process.env.HF_API_KEY);
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

// Common skills list (expanded as needed)
const commonSkills = [
  "javascript", "python", "java", "react", "node", "sql", "aws", "docker", "git", "html", "css",
  "project management", "agile", "ux design", "figma", "typescript", "mongodb", "graphql",
  "next", "react native", "django", "flask", "spring", "c#", "net", "c++", "go", "ruby",
  "rails", "php", "laravel", "angular", "vue", "svelte", "tailwind", "bootstrap",
  "postgresql", "mysql", "redis", "rest", "azure", "google cloud", "kubernetes", "jenkins",
  "ci/cd", "machine learning", "tensorflow", "pytorch", "data analysis", "pandas", "numpy",
  "ui/ux design", "adobe xd", "sketch", "blockchain", "solidity", "cybersecurity",
];

// Helper to clean and split text into lines
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);
}

// Enhanced extractResumeDetails to handle pre-parsed data
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
    const lines = cleanText(resumeText);

    const contactResult = await hf.tokenClassification({
      model: "dslim/bert-base-NER",
      inputs: resumeText,
      parameters: { aggregation_strategy: "simple" },
    });

    const contact = {
      name: "Unknown",
      email: resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || "N/A",
      phone: resumeText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || "N/A",
    };

    const nameEntity = contactResult.find((e) => e.entity_group === "PER");
    if (nameEntity) contact.name = nameEntity.word;
    else {
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (lines[i].length > 2 && !lines[i].includes("@") && !/\d{3}/.test(lines[i])) {
          contact.name = lines[i];
          break;
        }
      }
    }

    const skillsFromAI = await hf
      .tokenClassification({
        model: "dslim/bert-base-NER",
        inputs: resumeText,
      })
      .then((res) =>
        res
          .filter((e) => (e.entity_group === "SKILL" || e.score > 0.7) && e.word.length > 2)
          .map((e) => e.word.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, ""))
      );

    const skillsFromText = lines
      .flatMap((line) => line.toLowerCase().match(/\b\w+\b/g) || [])
      .filter((word) => commonSkills.includes(word.replace(/\s+/g, "").replace(/\.?js$/, "")) || (word.length > 2 && !/^\d+$/.test(word)))
      .map((word) => word.replace(/\s+/g, "").replace(/\.?js$/, ""));

    const skills = [...new Set([...skillsFromAI, ...skillsFromText])];

    const experience = [];
    const expKeywords = ["experience", "work history", "employment", "professional experience"];
    let expSection = false;
    let currentExp = null;

    for (const line of lines) {
      if (expKeywords.some((k) => line.toLowerCase().includes(k))) {
        expSection = true;
        continue;
      }
      if (expSection && (line.toLowerCase().includes("education") || line.toLowerCase().includes("skills"))) {
        expSection = false;
        continue;
      }
      if (expSection) {
        const dateMatch = line.match(/(\d{4}\s*[-–—]\s*\d{4}|\d{4}\s*-\s*present)/i);
        if (dateMatch) {
          if (currentExp) experience.push(currentExp);
          currentExp = { title: "", company: "", years: dateMatch[0], duration: 0 };
        } else if (currentExp && !currentExp.title) {
          const parts = line.split(/ at |, | - /i);
          currentExp.title = parts[0].trim();
          currentExp.company = parts[1]?.trim() || "Unknown";
          const years = dateMatch ? dateMatch[0].match(/\d{4}/g) : [];
          if (years.length > 1) {
            const start = parseInt(years[0]);
            const end = years[1] === "present" ? new Date().getFullYear() : parseInt(years[1]);
            currentExp.duration = end - start;
          }
        }
      }
    }
    if (currentExp) experience.push(currentExp);

    const education = [];
    const eduKeywords = ["education", "academic", "degree"];
    let eduSection = false;

    for (const line of lines) {
      if (eduKeywords.some((k) => line.toLowerCase().includes(k))) {
        eduSection = true;
        continue;
      }
      if (eduSection && (line.toLowerCase().includes("experience") || line.toLowerCase().includes("skills"))) {
        eduSection = false;
        continue;
      }
      if (eduSection) {
        const degreeMatch = line.match(/(b\.s\.|m\.s\.|ph\.d\.|bachelor|master|diploma)/i);
        const yearMatch = line.match(/\d{4}/);
        if (degreeMatch || yearMatch) {
          const parts = line.split(/,| - /i);
          education.push({
            degree: degreeMatch ? parts[0].trim() : parts[0].trim(),
            school: parts[1]?.trim() || "Unknown",
            year: yearMatch ? yearMatch[0] : "N/A",
            level: degreeMatch ? (degreeMatch[0].includes("ph.d.") ? 3 : degreeMatch[0].includes("m.s.") ? 2 : 1) : 0,
          });
        }
      }
    }

    return { contact, skills, experience, education };
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

// Enhanced computeScoreAndSkills for accurate results
async function computeScoreAndSkills(resumeSkills, resumeExperience, resumeEducation, jobSkills) {
  // Normalize skills: remove spaces, handle case, and .js variants
  const normalizeSkill = (skill) =>
    skill.toLowerCase().replace(/\s+/g, "").replace(/\.?js$/, "");

  const normalizedResumeSkills = resumeSkills.map(normalizeSkill);
  const normalizedJobSkills = jobSkills.map(normalizeSkill);

  console.log("Normalized Resume Skills:", normalizedResumeSkills); // Debug log
  console.log("Normalized Job Skills:", normalizedJobSkills); // Debug log

  // Match skills with fuzzy logic
  const matchedSkills = normalizedResumeSkills.filter((resumeSkill) =>
    normalizedJobSkills.some((jobSkill) =>
      jobSkill === resumeSkill || (jobSkill.length > 2 && resumeSkill.includes(jobSkill)) || (resumeSkill.length > 2 && jobSkill.includes(resumeSkill))
    )
  );

  // Identify missing skills based on jobSkills
  const missingSkills = normalizedJobSkills.filter((jobSkill) =>
    !normalizedResumeSkills.some((resumeSkill) =>
      resumeSkill === jobSkill || resumeSkill.includes(jobSkill) || jobSkill.includes(resumeSkill)
    )
  ).map((skill) => ({
    skill: skill.replace(/_/g, " "), // Restore readable format
    suggestion: "Consider taking an online course or building a project to gain this skill.",
  }));

  // Detailed scoring
  const skillsScore = (matchedSkills.length / Math.max(normalizedJobSkills.length, 1)) * 50;
  const expScore = resumeExperience.reduce((sum, exp) => sum + (exp.duration || 0), 0) > 0 ? 30 : 0;
  const eduScore = Math.max(...resumeEducation.map(e => e.level)) > 0 ? 20 : 0;
  const score = Math.min(Math.max(skillsScore + expScore + eduScore, 0), 100);

  console.log("Computed - Score:", score, "Matched Skills:", matchedSkills, "Missing Skills:", missingSkills);
  return { score, matchedSkills, missingSkills };
}

// Updated analyzeResumeWithGemini for feedback only
async function analyzeResumeWithGemini(resumeText, job, preParsedData = null) {
  const maxRetries = 5;
  const baseDelay = 5000;
  const maxPromptSize = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { skills, experience, education } = preParsedData || (await extractResumeDetails(resumeText));
      const prompt = `
        You are an AI-powered resume analyzer. Provide 3 concise, actionable feedback points to improve the resume for the job based on skills: ${job.skills.join(", ")}, experience titles: ${experience.map(e => e.title).join(", ")}, and education: ${education.map(e => e.degree).join(", ")}. Job title: ${job.title}.
        Return JSON with a 'feedback' array wrapped in \`\`\`json\n and \n\`\`\`.
      `;

      const truncatedPrompt = prompt.length > maxPromptSize ? prompt.substring(0, maxPromptSize) + "..." : prompt;
      console.log("Sending feedback prompt to Gemini API (attempt " + attempt + ", size: " + truncatedPrompt.length + " chars):", truncatedPrompt.substring(0, 200) + "...");

      const response = await axios.post(
        GEMINI_API_URL,
        {
          contents: [{ parts: [{ text: truncatedPrompt }] }],
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
        parsedResult = JSON.parse(geminiResult.replace(/```json\n|\n```/g, ""));
      } catch (parseErr) {
        console.error("Failed to parse Gemini response:", parseErr.message);
        throw new Error("Invalid JSON response from Gemini");
      }

      console.log("Parsed Gemini feedback:", parsedResult);
      return { feedback: Array.isArray(parsedResult.feedback) ? parsedResult.feedback : [] };
    } catch (err) {
      console.error("Error in analyzeResumeWithGemini (attempt " + attempt + "):", err.message, err.stack);
      if ((err.code === "ECONNABORTED" || err.response?.status === 503 || err.response?.status === 429) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying due to ${err.code === "ECONNABORTED" ? "timeout" : err.response?.status === 503 ? "service unavailable" : "rate limit"}, waiting ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  console.warn("Max retries reached for Gemini API, skipping feedback.");
  return { feedback: [] };
}

// Modified analyzeResumeAgainstJob to handle pre-parsed data
async function analyzeResumeAgainstJob(resumeText, job, candidateId, preParsedData = null) {
  try {
    const { skills, experience, education } = preParsedData || (await extractResumeDetails(resumeText, preParsedData));
    const { score, matchedSkills, missingSkills } = await computeScoreAndSkills(skills, experience, education, job.skills);

    let feedback = ["Ensure your resume includes relevant skills.", "Add quantifiable achievements.", "Tailor your experience to the job."];
    try {
      const geminiResult = await analyzeResumeWithGemini(resumeText, job, preParsedData);
      if (geminiResult.feedback.length > 0) {
        feedback = geminiResult.feedback;
        console.log("Successfully integrated Gemini feedback:", feedback);
      }
    } catch (geminiErr) {
      console.warn("Gemini failed, using fallback feedback:", geminiErr.message);
    }

    let normalizedSkills = [];
    if (candidateId) {
      const user = await User.findById(candidateId).select("resumeParsed.skills");
      if (!user) throw new Error("Candidate not found");
      console.log("Using resumeParsed.skills for logging:", user.resumeParsed?.skills);
      normalizedSkills = (user.resumeParsed?.skills || []).map((s) => s.toLowerCase());
    } else {
      console.log("No candidateId provided, extracting skills from resumeText");
      normalizedSkills = skills.map((s) => s.toLowerCase());
    }

    console.log("Final analysis result:", { score, matchedSkills, missingSkills, feedback });
    return { score, matchedSkills, missingSkills, feedback };
  } catch (err) {
    console.error("Error in analyzeResumeAgainstJob:", err.message, err.stack);
    return {
      score: 0,
      feedback: ["Error analyzing resume. Please ensure the resume is valid and retry after some time."],
      matchedSkills: [],
      missingSkills: job.skills.map((skill) => ({
        skill,
        suggestion: "Consider taking an online course or building a project to gain this skill.",
      })),
    };
  }
}

module.exports = { extractResumeDetails, analyzeResumeAgainstJob };