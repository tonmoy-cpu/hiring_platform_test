const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  details: { type: String, required: true },
  skills: [{ type: String }],
  salary: { type: String }, // Optional salary field
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isClosed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  applicantsCount: { type: Number, default: 0 }, // Total applicants
  newApplicantsCount: { type: Number, default: 0 }, // New applicants
  applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Application" }], // Reference to applications
});

module.exports = mongoose.model("Job", jobSchema);