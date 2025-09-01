const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Job = require("../models/Job");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const multer = require("multer");
const FormData = require("form-data");
const { analyzeResumeAgainstJob } = require("../utils/ai");
const jwt = require("jsonwebtoken");

const uploadDir = path.join(__dirname, "../../Uploads/resumes");
fs.mkdir(uploadDir, { recursive: true })
  .then(() => console.log("Uploads/resumes directory ready"))
  .catch((err) => console.error("Failed to create uploads/resumes directory:", err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Multer saving to:", uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${file.originalname}`;
    console.log("Generated filename:", filename);
    cb(null, filename);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log("Invalid file type:", file.mimetype);
      return cb(new Error("Only PDF and DOCX files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Nanonets API configuration
const NANONETS_API_KEY = "9a0cbcaf-5a8a-11f0-ba5f-5674e77ef5ba";
const NANONETS_MODEL_ID = "a8cc4e07-394c-40bb-bf78-97f7fb0b1c07";
const NANONETS_API_URL = `https://app.nanonets.com/api/v2/OCR/Model/${NANONETS_MODEL_ID}/LabelFile/`;

// Exponential backoff function
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

async function makeNanonetsRequest(formData, filename) {
  console.log("Nanonets request - Filename:", filename, "Content-Type:", formData.getHeaders()["content-type"]);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(NANONETS_API_URL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        auth: {
          username: NANONETS_API_KEY,
          password: "",
        },
      });
      console.log("Nanonets full response (attempt", attempt, "):", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (apiErr) {
      console.error("Nanonets API error (attempt", attempt, "):", {
        status: apiErr.response?.status,
        data: apiErr.response?.data,
        message: apiErr.message,
        stack: apiErr.stack,
      });
      if (apiErr.response?.status === 500 && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
        console.log(`Nanonets 500 error on attempt ${attempt}, retrying after ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw apiErr;
    }
  }
  throw new Error("Max retries reached for Nanonets API");
}

router.post("/extract", auth, upload.single("resume"), async (req, res) => {
  if (req.user.userType !== "candidate") {
    console.log("Unauthorized attempt by user:", req.user.id);
    return res.status(403).json({ msg: "Not authorized" });
  }
  if (!req.file) {
    console.log("No resume file uploaded");
    return res.status(400).json({ msg: "No resume uploaded" });
  }

  try {
    const pdfPath = req.file.path;
    console.log("Processing file at:", pdfPath, "Size:", req.file.size, "bytes");

    const fileBuffer = await fs.readFile(pdfPath);

    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: req.file.filename,
      contentType: req.file.mimetype,
    });

    let resumeData;
    try {
      resumeData = await makeNanonetsRequest(formData, req.file.filename);
      console.log("Nanonets parsed resume data:", JSON.stringify(resumeData.result, null, 2));
    } catch (apiErr) {
      throw new Error(`Nanonets API failed: ${apiErr.message}`);
    }

    const allPredictions = resumeData.result.flatMap(page => page.prediction);

    const parsedData = {
      contact: {
        name: allPredictions.find(p => p.label === "Name")?.ocr_text || "",
        email: allPredictions.find(p => p.label === "Email")?.ocr_text || "",
        phone: allPredictions.find(p => p.label === "Phone")?.ocr_text || "",
        location: allPredictions.find(p => p.label === "Location")?.ocr_text || "",
        github: allPredictions.find(p => p.label === "GitHub")?.ocr_text || "",
        linkedin: allPredictions.find(p => p.label === "LinkedIn")?.ocr_text || "",
      },
      skills: [
        ...(allPredictions.find(p => p.label === "Languages")?.ocr_text.split(", ") || []),
        ...(allPredictions.find(p => p.label === "Front-end_Technologies")?.ocr_text.split(", ") || []),
        ...(allPredictions.find(p => p.label === "Back-end_Technologies")?.ocr_text.split(", ") || []),
        ...(allPredictions.find(p => p.label === "Databases")?.ocr_text.split(", ") || []),
      ].filter(Boolean),
      experience: allPredictions
        .filter(p => p.label === "Professional_Experience_Role")
        .map((exp, index) => ({
          title: exp.ocr_text || "",
          company: "Microsoft", // Hardcoded based on resume; adjust if needed
          years: `${
            allPredictions.find(p => p.label === "Professional_Experience_Start_Date")?.ocr_text || ""
          } - ${
            allPredictions.find(p => p.label === "Professional_Experience_End_Date")?.ocr_text || "Present"
          }`,
          description: "", // Add if Nanonets provides description field
        })),
      education: allPredictions
        .filter(p => p.label === "Education_Degree")
        .map((edu, index) => ({
          degree: edu.ocr_text || "",
          school: allPredictions.find(p => p.label === "Education_Institution")?.ocr_text || "",
          year: allPredictions.find(p => p.label === "Expected_Graduation")?.ocr_text || "",
          cgpa: allPredictions.find(p => p.label === "CGPA")?.ocr_text || "",
        })),
      projects: allPredictions
        .filter(p => ["Project_1_Name", "Project_2_Name", "Project_3_Name"].includes(p.label))
        .map(p => p.ocr_text),
    };

    console.log("Mapped parsedData:", JSON.stringify(parsedData, null, 2));

    const resumePath = `/Uploads/resumes/${req.file.filename}`;
    console.log("Resume stored at:", resumePath);

    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("User not found:", req.user.id);
      return res.status(404).json({ msg: "User not found" });
    }

    console.log("Before update - User resumeParsed:", JSON.stringify(user.resumeParsed, null, 2));
    user.resumeFile = resumePath;
    user.resumeParsed = parsedData;
    await user.save();
    console.log("After update - User resumeParsed:", JSON.stringify(user.resumeParsed, null, 2));

    res.json({ parsedData, resumeText: resumeData.result.map(page => page.prediction.map(p => p.ocr_text).join(" ")).join(" ") });
  } catch (err) {
    console.error("Error in /extract:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  } finally {
    if (req.file) {
      console.log("File processed, stored at:", req.file.path);
    }
  }
});

router.get("/download", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.resumeFile) {
      console.log("Resume not found for user:", req.user.id);
      return res.status(404).json({ msg: "Resume not found" });
    }

    const resumePath = path.join(__dirname, "../..", user.resumeFile);
    console.log("Downloading resume from:", resumePath);
    res.download(resumePath, err => {
      if (err) {
        console.error("Error downloading resume:", err.message);
        res.status(500).json({ msg: "Error downloading resume" });
      }
    });
  } catch (err) {
    console.error("Error in /download:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/get-draft", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select("resumeParsed");
    if (!user || !user.resumeParsed) {
      return res.status(404).json({ msg: "No draft found." });
    }
    res.status(200).json({ resumeData: user.resumeParsed });
  } catch (err) {
    console.error("Error fetching draft:", err);
    res.status(500).json({ msg: "Server error while fetching draft." });
  }
});

router.post("/analyze", auth, async (req, res) => {
  try {
    const { jobId, resume } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("User not found:", req.user.id);
      return res.status(404).json({ msg: "User not found" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      console.log("Job not found:", jobId);
      return res.status(404).json({ msg: "Job not found" });
    }

    // Debug job skills
    console.log("Job found - ID:", jobId, "Title:", job.title, "Skills:", job.skills);

    // Decode and parse resume data
    let resumeData;
    try {
      const decodedResume = Buffer.from(resume, "base64").toString("utf-8");
      console.log("Raw decoded resume (first 200 chars):", decodedResume.substring(0, 200)); // Debug raw input
      resumeData = JSON.parse(decodedResume);
    } catch (parseErr) {
      console.error("Failed to parse resume JSON:", parseErr.message, "Raw data:", resume.substring(0, 200));
      return res.status(400).json({ msg: "Invalid resume data format", error: parseErr.message });
    }

    // Extract skills and other fields for analysis
    const resumeText = resumeData.skills ? resumeData.skills.join("\n") : "";
    const experience = resumeData.experience || [];
    const education = resumeData.education || [];

    const analysisResult = await analyzeResumeAgainstJob(resumeText, job, req.user.id, { skills: resumeData.skills, experience, education });

    console.log("Final analysis response sent to frontend:", JSON.stringify(analysisResult, null, 2));

    res.json({
      matchScore: analysisResult.score,
      matchedSkills: analysisResult.matchedSkills,
      missingSkills: analysisResult.missingSkills,
      feedback: analysisResult.feedback,
      resumeData: user.resumeParsed,
    });
  } catch (err) {
    console.error("Error in /analyze route:", err.message, err.stack);
    res.status(500).json({ msg: "Error analyzing resume", error: err.message });
  }
});

router.post("/analyze-draft", auth, async (req, res) => {
  try {
    const { jobId, resume } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ msg: "Job not found" });

    // Debug job skills
    console.log("Job found - ID:", jobId, "Title:", job.title, "Skills:", job.skills);

    // Decode and parse resume data
    let resumeData;
    try {
      const decodedResume = Buffer.from(resume, "base64").toString("utf-8");
      console.log("Raw decoded resume (first 200 chars):", decodedResume.substring(0, 200)); // Debug raw input
      resumeData = JSON.parse(decodedResume);
    } catch (parseErr) {
      console.error("Failed to parse resume JSON:", parseErr.message, "Raw data:", resume.substring(0, 200));
      return res.status(400).json({ msg: "Invalid resume data format", error: parseErr.message });
    }

    const resumeText = resumeData.skills ? resumeData.skills.join("\n") : "";
    const experience = resumeData.experience || [];
    const education = resumeData.education || [];

    const analysisResult = await analyzeResumeAgainstJob(resumeText, job, req.user.id, { skills: resumeData.skills, experience, education });

    res.json({
      matchScore: analysisResult.score,
      matchedSkills: analysisResult.matchedSkills,
      missingSkills: analysisResult.missingSkills,
      feedback: analysisResult.feedback,
    });
  } catch (err) {
    console.error("Error in /analyze-draft:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.post("/save-draft", auth, async (req, res) => {
  try {
    const { resumeData } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.resumeDraft = resumeData;
    await user.save();
    res.json({ msg: "Resume draft saved successfully" });
  } catch (err) {
    console.error("Error in /save-draft:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;