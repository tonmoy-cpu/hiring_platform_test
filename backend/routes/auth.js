const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const User = require("../models/User");
const multer = require("multer");
const fs = require("fs").promises;
const pdfParse = require("pdf-parse");
const { extractResumeDetails } = require("../utils/ai");

// Ensure uploads directory exists
const uploadDir = "uploads/";
fs.mkdir(uploadDir, { recursive: true }, (err) => {
  if (err) console.error("Failed to create uploads directory:", err);
  else console.log("Uploads directory ready");
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Setting upload destination to uploads/");
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${file.originalname}`;
    console.log("Generated filename:", filename);
    cb(null, filename);
  },
});
const upload = multer({ storage });

// Custom middleware to handle Multer
const uploadMiddleware = (req, res, next) => {
  console.log("Entering uploadMiddleware");
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err.message, "Field:", err.field);
      return res.status(400).json({ msg: "File upload error", error: err.message, field: err.field });
    } else if (err) {
      console.error("Unknown upload error:", err.message);
      return res.status(500).json({ msg: "Upload processing error", error: err.message });
    }
    console.log("Multer processed successfully");
    next();
  });
};

router.post("/register", uploadMiddleware, async (req, res) => {
  console.log("Request body:", req.body);
  console.log("Uploaded files:", req.files);

  const { username, email, password, userType } = req.body;

  try {
    console.log("Validating required fields");
    if (!username || !email || !password || !userType) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    console.log("Checking for existing user");
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    const profilePicFile = req.files && req.files.find(file => file.fieldname === "profilePic");
    const resumeFile = req.files && req.files.find(file => file.fieldname === "resume");
    console.log("Profile pic file:", profilePicFile ? profilePicFile.filename : "None");
    console.log("Resume file:", resumeFile ? resumeFile.filename : "None");

    console.log("Creating new user");
    user = new User({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      userType,
      profilePic: profilePicFile ? `/uploads/${profilePicFile.filename}` : "/uploads/default.jpg",
    });

    console.log("Saving user to database");
    await user.save();

    if (userType === "candidate" && resumeFile) {
      const pdfPath = resumeFile.path;
      console.log("Processing resume for candidate at:", pdfPath);
      try {
        console.log("Reading PDF");
        const dataBuffer = await fs.readFile(pdfPath);
        console.log("Parsing PDF");
        const pdfData = await pdfParse(dataBuffer);
        const resumeText = pdfData.text;
        console.log("Extracting resume details");
        const parsedData = await extractResumeDetails(resumeText);
        user.resumeParsed = parsedData;
        console.log("Saving parsed resume data");
        await user.save();
        console.log("Cleaning up PDF file");
        await fs.unlink(pdfPath);
      } catch (resumeErr) {
        console.error("Resume processing error:", resumeErr.message);
      }
    }

    console.log("Generating JWT token");
    const payload = { user: { id: user.id, userType: user.userType } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    console.log("Sending success response");
    res.json({ token });
  } catch (err) {
    console.error("Error in /register:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt:", { email, password });

  try {
    console.log("Fetching user from database");
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(400).json({ msg: "Invalid credentials" });
    }
    console.log("User found:", user.email);

    console.log("Comparing passwords");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", email);
      return res.status(400).json({ msg: "Invalid credentials" });
    }
    console.log("Password matched");

    console.log("Generating JWT token");
    const payload = { user: { id: user.id, userType: user.userType } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
    console.log("Token generated successfully");

    res.json({ token });
  } catch (err) {
    console.error("Error in /login:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      console.log("User not found for ID:", req.user.id);
      return res.status(404).json({ msg: "User not found" });
    }
    user.profilePic = user.profilePic || "/uploads/default.jpg";
    console.log("Returning profile:", { username: user.username, profilePic: user.profilePic });
    res.json(user);
  } catch (err) {
    console.error("Error in /profile:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.get("/profile/:userId", auth, async (req, res) => {
  try {
    if (req.user.userType !== "recruiter") {
      console.log("Unauthorized access attempt by user:", req.user.id);
      return res.status(403).json({ msg: "Not authorized" });
    }

    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      console.log("User not found for ID:", req.params.userId);
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.userType !== "candidate") {
      console.log("Attempt to access non-candidate profile by recruiter:", req.user.id);
      return res.status(403).json({ msg: "Can only view candidate profiles" });
    }

    user.profilePic = user.profilePic || "/uploads/default.jpg";
    console.log("Returning candidate profile for ID:", req.params.userId, { username: user.username });
    res.json(user);
  } catch (err) {
    console.error("Error in /profile/:userId:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.put("/profile", auth, async (req, res) => {
  const { resumeParsed, preferredSkills, preferredDomains } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    console.log("Before update - User resumeParsed:", user.resumeParsed);
    console.log("Received resumeParsed:", resumeParsed);

    if (resumeParsed) {
      user.resumeParsed = resumeParsed; // Directly assign to preserve manual edits
    }
    if (preferredSkills) user.preferredSkills = preferredSkills;
    if (preferredDomains) user.preferredDomains = preferredDomains;

    await user.save();
    const updatedUser = await User.findById(req.user.id).select("-password");
    console.log("After update - User resumeParsed:", updatedUser.resumeParsed);

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating profile:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.put("/preferences", auth, async (req, res) => {
  if (req.user.userType !== "candidate") return res.status(403).json({ msg: "Not authorized" });

  const { preferredSkills, preferredDomains } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.preferredSkills = preferredSkills || user.preferredSkills;
    user.preferredDomains = preferredDomains || user.preferredDomains;
    await user.save();
    res.json(user);
  } catch (err) {
    console.error("Error in /preferences:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;