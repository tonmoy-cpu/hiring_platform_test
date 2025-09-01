// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, enum: ["recruiter", "candidate"], required: true },
  profilePic: { type: String, default: "/Uploads/default-profile.png" },
  resumeParsed: {
    contact: { name: String, email: String, phone: String },
    skills: [{ type: String }],
    experience: [{ title: String, company: String, years: String }],
    education: [{ degree: String, school: String, year: String }],
  },
  resumeFile: { type: String }, // Path to stored resume file
  company: { type: String }, // Recruiter field
  preferredSkills: { type: [String], default: [] }, // New field
  preferredDomains: { type: [String], default: [] }, // New field
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);