const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  resumeText: { type: String, required: true },
  coverLetter: { type: String, required: true },
  status: {
    type: String,
    enum: ["Applied", "Under Review", "Selected", "Not Selected"],
    default: "Applied", // Ensure this default is applied during save
  },
  feedback: { type: [String], default: [] }, // Array of strings for feedback
  compatibilityScore: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Application", applicationSchema);