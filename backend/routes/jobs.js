const express = require("express");
const router = express.Router();
const Job = require("../models/Job");
const auth = require("../middleware/auth");
const Application = require("../models/Application");
const User = require("../models/User");

router.post("/", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  const { title, details, skills, salary } = req.body;
  if (!title || !details || !skills)
    return res.status(400).json({ msg: "Missing required fields" });

  try {
    const job = new Job({
      title,
      details,
      skills,
      salary,
      recruiter: req.user.id,
    });
    await job.save();
    res.status(201).json(job);
  } catch (err) {
    console.error("Error in POST /jobs:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    console.log("GET /api/jobs - Query:", req.query);
    console.log("User type:", req.user.userType, "User ID:", req.user.id);
    let jobs;
    if (req.user.userType === "candidate") {
      const user = await User.findById(req.user.id);
      console.log("User preferences:", {
        preferredSkills: user.preferredSkills,
        preferredDomains: user.preferredDomains
      });
      const appliedJobs = await Application.find({ candidate: req.user.id }).select("job");
      const appliedJobIds = appliedJobs.map((app) => app.job.toString());

      const includeClosed = req.query.includeClosed === "true";
      if (req.query.all === "true") {
        console.log(`Fetching all jobs for candidate (all=true, includeClosed=${includeClosed})`);
        jobs = await Job.find(includeClosed ? {} : { isClosed: false }).populate("recruiter", "username");
      } else {
        console.log("Fetching preference-matched jobs for candidate");
        const preferredSkills = user.preferredSkills || [];
        const preferredDomains = user.preferredDomains || [];
        
        console.log("Filtering with preferences:", { preferredSkills, preferredDomains });
        
        if (preferredSkills.length === 0 && preferredDomains.length === 0) {
          // If no preferences set, show all open jobs
          jobs = await Job.find({ isClosed: false }).populate("recruiter", "username");
        } else {
          const skillRegexes = preferredSkills.map(skill => new RegExp(skill, "i"));
          const domainRegexes = preferredDomains.map(domain => new RegExp(domain, "i"));
          
          const query = {
            isClosed: false,
            $or: []
          };
          
          if (skillRegexes.length > 0) {
            query.$or.push({ skills: { $in: skillRegexes } });
          }
          
          if (domainRegexes.length > 0) {
            query.$or.push({ details: { $in: domainRegexes } });
          }
          
          jobs = await Job.find(query).populate("recruiter", "username");
          console.log("Found preference-matched jobs:", jobs.length);
        }

        // Sort by relevance score
        jobs = jobs.map(job => {
          let relevanceScore = 0;
          
          // Skill matching score
          const jobSkills = job.skills || [];
          const matchedSkillsCount = jobSkills.filter(jobSkill =>
            preferredSkills.some(prefSkill =>
              jobSkill.toLowerCase().includes(prefSkill.toLowerCase()) ||
              prefSkill.toLowerCase().includes(jobSkill.toLowerCase())
            )
          ).length;
          
          if (jobSkills.length > 0) {
            relevanceScore += (matchedSkillsCount / jobSkills.length) * 70;
          }
          
          // Domain matching score
          const domainMatch = preferredDomains.some(domain =>
            job.details.toLowerCase().includes(domain.toLowerCase()) ||
            domain.toLowerCase().includes(job.details.toLowerCase())
          );
          
          if (domainMatch) {
            relevanceScore += 30;
          }
          
          return { ...job._doc, relevanceScore };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
      }

      jobs = jobs.map((job) => ({
        ...job._doc,
        isApplied: appliedJobIds.includes(job._id.toString()),
      }));
    } else {
      console.log("Fetching all jobs for recruiter");
      jobs = await Job.find({ isClosed: false }).populate("recruiter", "username");
    }
    console.log("Returning jobs:", jobs.length, "Job titles:", jobs.map((j) => j.title));
    res.json(jobs);
  } catch (err) {
    console.error("Error in GET /jobs:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/recruiter", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  try {
    const jobs = await Job.find({ recruiter: req.user.id }).lean();

    for (let job of jobs) {
      const applications = await Application.find({ job: job._id, status: { $ne: "Not Selected" } });
      job.applicantsCount = job.applicantsCount || applications.length;
      job.newApplicantsCount = job.newApplicantsCount || applications.filter((app) => app.status === "Applied").length;
    }

    res.json(jobs);
  } catch (err) {
    console.error("Error in GET /jobs/recruiter:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.put("/:id", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  const { title, details, skills, salary } = req.body;
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: "Job not found" });
    if (job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to edit this job" });
    }

    job.title = title || job.title;
    job.details = details || job.details;
    job.skills = skills || job.skills;
    job.salary = salary || job.salary;
    await job.save();
    res.json(job);
  } catch (err) {
    console.error("Error in PUT /jobs/:id:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.put("/:id/close", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: "Job not found" });
    if (job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to close this job" });
    }

    job.isClosed = true;
    await job.save();
    res.json(job);
  } catch (err) {
    console.error("Error in PUT /jobs/:id/close:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: "Job not found" });
    if (job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not authorized to delete this job" });
    }

    // Delete associated applications
    await Application.deleteMany({ job: req.params.id });
    
    // Delete the job
    await Job.findByIdAndDelete(req.params.id);
    
    res.json({ msg: "Job and associated applications deleted successfully" });
  } catch (err) {
    console.error("Error in DELETE /jobs/:id:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/analytics/job-performance", auth, async (req, res) => {
  try {
    if (req.user.userType !== "recruiter") {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const jobs = await Job.find({ recruiter: req.user.id }).lean();
    const performanceData = await Promise.all(
      jobs.map(async (job) => {
        const applications = await Application.find({ job: job._id });
        const totalApps = applications.length;
        const selectedApps = applications.filter((a) => a.status === "Selected").length;
        const avgScore =
          totalApps > 0
            ? (applications.reduce((sum, a) => sum + (a.compatibilityScore || 0), 0) / totalApps).toFixed(2)
            : 0;

        return {
          role: job.title,
          performance: totalApps > 0 ? Math.round((selectedApps / totalApps) * 100) : 0,
          avgScore: parseFloat(avgScore),
          applicantsCount: job.applicantsCount || totalApps,
        };
      })
    );

    res.json(performanceData);
  } catch (err) {
    console.error("Error in /analytics/job-performance:", err.message, err.stack);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/analytics/demographics", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  try {
    const applications = await Application.find({ job: { $in: await Job.find({ recruiter: req.user.id }).select("_id") } }).populate("candidate");
    const demographics = {};

    // Use a Set to track unique candidate IDs
    const uniqueCandidates = new Set();
    applications.forEach((app) => {
      const candidateId = app.candidate?._id.toString();
      if (!uniqueCandidates.has(candidateId)) {
        uniqueCandidates.add(candidateId);

        const resumeParsed = app.candidate.resumeParsed || {};
        const experienceLevel = resumeParsed.experience?.reduce((max, exp) => Math.max(max, exp.duration || 0), 0) > 5 ? "Senior" : "Junior";
        const location = resumeParsed.contact?.location || "Unknown";

        // Use a single key combining experience and location, with a fallback
        const key = location === "Unknown" ? experienceLevel : `${experienceLevel} (${location})`;
        demographics[key] = (demographics[key] || 0) + 1;

        // Debug log to verify data
        console.log(`Candidate ${candidateId}: Experience=${experienceLevel}, Location=${location}, Key=${key}`);
      }
    });

    console.log("Candidate Demographics Data:", demographics);
    res.json({ demographics });
  } catch (err) {
    console.error("Error in GET /jobs/analytics/demographics:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.get("/analytics/recommendations", auth, async (req, res) => {
  if (req.user.userType !== "recruiter")
    return res.status(403).json({ msg: "Not authorized" });

  try {
    const jobs = await Job.find({ recruiter: req.user.id });
    const applications = await Application.find({ job: { $in: jobs.map((j) => j._id) } }).populate("candidate");

    const recommendations = [
      "Optimize job postings with high-demand skills.",
      applications.length < 10 ? "Increase job visibility to attract more applicants." : "Review applicant quality for better matches.",
      jobs.some((j) => !j.salary) ? "Add salary details to improve application rates." : "Consider adjusting salary ranges based on market trends.",
    ];

    console.log("AI Recommendations Data:", recommendations);
    res.json({ recommendations });
  } catch (err) {
    console.error("Error in GET /jobs/analytics/recommendations:", err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;