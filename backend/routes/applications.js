const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { analyzeResumeAgainstJob } = require("../utils/ai");

router.post("/apply", auth, async (req, res) => {
  if (req.user.userType !== "candidate") return res.status(403).json({ msg: "Not authorized" });

  const { jobId, resumeText, coverLetter } = req.body;
  if (!jobId || !resumeText || !coverLetter)
    return res.status(400).json({ msg: "Missing required fields" });

  try {
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ msg: "Job not found" });

    const user = await User.findById(req.user.id);
    console.log("Before apply - User resumeParsed:", user.resumeParsed);

    const { score, feedback } = await analyzeResumeAgainstJob(resumeText, job, req.user.id);
    const feedbackArray = Array.isArray(feedback) ? feedback : [feedback || ""];

    const application = new Application({
      candidate: req.user.id,
      job: jobId,
      resumeText,
      coverLetter,
      status: "Applied",
      compatibilityScore: score,
      feedback: feedbackArray,
    });
    await application.save();

    const updatedUser = await User.findById(req.user.id);
    console.log("After apply - User resumeParsed:", updatedUser.resumeParsed);

    // Update job applicant counts
    const jobUpdate = await Job.findByIdAndUpdate(
      jobId,
      {
        $inc: { applicantsCount: 1, newApplicantsCount: 1 },
        $push: { applicants: application._id },
      },
      { new: true, runValidators: true }
    );
    if (!jobUpdate) throw new Error("Failed to update job applicant counts");

    res.status(201).json({ msg: "Application submitted successfully", application });
  } catch (err) {
    console.error("Error in /apply:", err.message, err.stack);
    res.status(500).json({ msg: `Application submission failed: ${err.message}` });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    let query;
    if (req.user.userType === "recruiter") {
      query = {
        job: { $in: await Job.find({ recruiter: req.user.id }).select("_id") },
        status: { $ne: "Not Selected" },
      };
    } else {
      query = { candidate: req.user.id };
    }
    const applications = await Application.find(query)
      .populate("candidate", "username resumeParsed resumeFile")
      .populate("job", "title details skills");
    console.log("Fetched applications:", applications.length);
    res.json(applications);
  } catch (err) {
    console.error("Error in /applications:", err.message, err.stack);
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/analyze", auth, async (req, res) => {
  if (req.user.userType !== "recruiter") return res.status(403).json({ msg: "Not authorized" });

  const { resumeText, jobId } = req.body;
  if (!resumeText || !jobId) return res.status(400).json({ msg: "Missing resumeText or jobId" });

  try {
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ msg: "Job not found" });

    const application = await Application.findOne({ job: jobId, resumeText }).populate("candidate");
    if (!application) return res.status(404).json({ msg: "Application not found" });

    const candidateId = application.candidate?._id;
    if (!candidateId) return res.status(404).json({ msg: "Candidate not found" });

    console.log("Before analyze - Candidate resumeParsed:", application.candidate.resumeParsed);
    const analysis = await analyzeResumeAgainstJob(resumeText, job, candidateId);
    console.log("Analysis result:", analysis);

    const updatedCandidate = await User.findById(candidateId);
    console.log("After analyze - Candidate resumeParsed:", updatedCandidate.resumeParsed);

    res.json(analysis);
  } catch (err) {
    console.error("Error in /analyze:", err.message, err.stack);
    res.status(500).json({ msg: "Server error" });
  }
});

router.put("/:id/status", auth, async (req, res) => {
  if (req.user.userType !== "recruiter") return res.status(403).json({ msg: "Not authorized" });

  const { status } = req.body;
  const validStatuses = ["Applied", "Under Review", "Selected", "Not Selected"];
  if (!validStatuses.includes(status)) return res.status(400).json({ msg: "Invalid status" });

  try {
    console.log("PUT /api/applications/:id/status - ID:", req.params.id, "User:", req.user.id);
    const application = await Application.findById(req.params.id).populate("job");
    if (!application) {
      console.log("Application not found for ID:", req.params.id);
      return res.status(404).json({ msg: "Application not found" });
    }
    console.log("Application found:", application._id, "Job recruiter:", application.job.recruiter);
    if (application.job.recruiter.toString() !== req.user.id) {
      console.log("Unauthorized: Recruiter ID", req.user.id, "does not match", application.job.recruiter);
      return res.status(403).json({ msg: "Not authorized to update this application" });
    }

    application.status = status;
    await application.save();
    console.log("Status updated to:", status);

    if (application.status === "Applied" && status !== "Applied") {
      await Job.findByIdAndUpdate(application.job, { $inc: { newApplicantsCount: -1 } });
    }

    res.status(200).json(application);
  } catch (err) {
    console.error("Error in /status:", err.message, err.stack);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/analytics/applications", auth, async (req, res) => {
  try {
    if (req.user.userType !== "recruiter") {
      return res.status(403).json({ msg: "Not authorized" });
    }

    // Debug: Log the recruiter ID and fetch their jobs
    console.log("Recruiter ID:", req.user.id);
    const recruiterJobs = await Job.find({ recruiter: req.user.id }).select("_id");
    console.log("Recruiter Job IDs:", recruiterJobs.map(j => j._id.toString()));

    // Debug: Check if any applications exist for these jobs
    const matchingApplications = await Application.find({ job: { $in: recruiterJobs.map(j => j._id) } });
    console.log("Matching Applications Count:", matchingApplications.length);
    console.log("Matching Applications:", matchingApplications.map(a => ({ _id: a._id, job: a.job, status: a.status })));

    const stats = await Application.aggregate([
      { $match: { job: { $in: recruiterJobs.map(j => j._id) }, status: { $exists: true } } }, // Ensure status exists
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
        },
      },
    ]);

    console.log("Application Stats Raw:", stats);

    const statusCounts = {
      Applied: 0,
      "Under Review": 0,
      Selected: 0,
      "Not Selected": 0,
    };
    stats.forEach((stat) => {
      statusCounts[stat.status] = stat.count || 0; // Handle null counts
    });

    const monthlyStats = await Application.aggregate([
      { $match: { job: { $in: recruiterJobs.map(j => j._id) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    console.log("Final Status Counts:", statusCounts);

    res.json({
      statusCounts,
      monthlyStats: monthlyStats.map((m) => ({ month: m._id, count: m.count })),
    });
  } catch (err) {
    console.error("Error in /analytics/applications:", err.message, err.stack);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;