"use client";

import Navbar from "@/components/navbar";
import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function ApplicationStatisticsChart() {
  const [chartData, setChartData] = useState(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token") || "");
    }

    const fetchData = async () => {
      if (!token) {
        console.log("No token available, skipping fetch");
        return;
      }
      try {
        const response = await fetch("/api/applications/analytics/applications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Raw Application Statistics Data:", data);
        const statusCounts = data.statusCounts || {};
        const values = Object.values(statusCounts);
        if (values.every((v) => v === 0)) {
          setChartData({
            labels: ["No Applications"],
            datasets: [{ label: "Applications", data: [1], backgroundColor: "var(--accent)" }], // Use var(--accent)
          });
        } else {
          setChartData({
            labels: Object.keys(statusCounts),
            datasets: [
              {
                label: "Applications",
                data: values,
                backgroundColor: "var(--primary)", // Use var(--primary)
              },
            ],
          });
        }
        // Note: monthlyStats is available in data but not displayed. Consider adding a line chart if needed.
      } catch (error) {
        console.error("Error fetching application statistics:", error);
        setChartData({
          labels: ["No Data"],
          datasets: [{ label: "Error", data: [1], backgroundColor: "var(--danger)" }], // Use var(--danger)
        });
      }
    };
    if (token) fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [token]);

  if (!chartData) return <div className="text-foreground text-center">Loading...</div>; // Use text-foreground

  return (
    <div style={{ height: "300px" }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { 
              position: "top",
              labels: {
                color: "var(--foreground)" // Set legend text color
              }
            },
            title: { 
              display: true, 
              text: "Application Statistics",
              color: "var(--foreground)" // Set title text color
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              min: 0,
              max: 10,
              ticks: { 
                stepSize: 1, 
                precision: 0,
                color: "var(--foreground)" // Set y-axis tick color
              },
              grid: {
                color: "rgba(255, 255, 255, 0.1)" // Set grid line color
              }
            },
            x: {
              ticks: {
                color: "var(--foreground)" // Set x-axis tick color
              },
              grid: {
                color: "rgba(255, 255, 255, 0.1)" // Set grid line color
              }
            }
          },
        }}
      />
    </div>
  );
}

function JobPerformance() {
  const [performanceData, setPerformanceData] = useState([]);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token") || "");
    }

    const fetchData = async () => {
      if (!token) {
        console.log("No token available, skipping fetch");
        return;
      }
      try {
        const response = await fetch("/api/jobs/analytics/job-performance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Job Performance Data:", data);
        setPerformanceData(data);
      } catch (error) {
        console.error("Error fetching job performance data:", error);
        setPerformanceData([{ role: "Error", performance: 0, avgScore: 0, applicantsCount: 0 }]);
      }
    };
    if (token) fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [token]);

  if (!performanceData.length) return <div className="text-foreground text-center">Loading...</div>; // Use text-foreground

  return (
    <div className="space-y-4"> {/* Increased space-y for better readability */}
      {performanceData.map((item, index) => (
        <div key={index} className="animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}> {/* Added animation */}
          <div className="flex justify-between items-center mb-1">
            <span className="text-foreground font-medium">{item.role || "Unknown"}</span> {/* Use text-foreground */}
            <span className="text-primary text-sm"> {/* Use text-primary */}
              {item.performance || 0}% (Avg Score: {item.avgScore || 0})
            </span>
          </div>
          <div className="w-full bg-border h-2 rounded-full"> {/* Use bg-border */}
            <div
              className="bg-primary h-2 rounded-full" // Use bg-primary
              style={{ width: `${Math.min(item.performance || 0, 100)}%` }}
            ></div>
          </div>
          <div className="text-gray-400 text-xs mt-1">Applicants: {item.applicantsCount || 0}</div> {/* Use gray-400 */}
        </div>
      ))}
    </div>
  );
}

function CandidateDemographicsChart() {
  const [chartData, setChartData] = useState(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token") || "");
    }

    const fetchData = async () => {
      if (!token) {
        console.log("No token available, skipping fetch");
        return;
      }
      try {
        const response = await fetch("/api/jobs/analytics/demographics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("Candidate Demographics Data:", data);
        setChartData({
          labels: Object.keys(data.demographics || {}),
          datasets: [
            {
              label: "Candidates",
              data: Object.values(data.demographics || {}),
              backgroundColor: "var(--info)", // Use var(--info)
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching candidate demographics:", error);
        setChartData({
          labels: ["No Data"],
          datasets: [{ label: "Error", data: [1], backgroundColor: "var(--danger)" }], // Use var(--danger)
        });
      }
    };
    if (token) fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [token]);

  if (!chartData) return <div className="text-foreground text-center">Loading...</div>; // Use text-foreground

  return (
    <div style={{ height: "300px" }}>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { 
              position: "top",
              labels: {
                color: "var(--foreground)" // Set legend text color
              }
            },
            title: { 
              display: true, 
              text: "Candidate Demographics",
              color: "var(--foreground)" // Set title text color
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              min: 0,
              max: 10,
              ticks: { 
                stepSize: 1, 
                precision: 0,
                color: "var(--foreground)" // Set y-axis tick color
              },
              grid: {
                color: "rgba(255, 255, 255, 0.1)" // Set grid line color
              }
            },
            x: {
              ticks: {
                color: "var(--foreground)" // Set x-axis tick color
              },
              grid: {
                color: "rgba(255, 255, 255, 0.1)" // Set grid line color
              }
            }
          },
        }}
      />
    </div>
  );
}

function AIRecommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("token") || "");
    }

    const fetchData = async () => {
      if (!token) {
        console.log("No token available, skipping fetch");
        return;
      }
      try {
        const response = await fetch("/api/jobs/analytics/recommendations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log("AI Recommendations Data:", data);
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error("Error fetching AI recommendations:", error);
        setRecommendations(["Error fetching recommendations. Please try again later."]);
      }
    };
    if (token) fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [token]);

  if (!recommendations.length) return <div className="text-foreground text-center">Loading...</div>; // Use text-foreground

  return (
    <ul className="space-y-3 text-foreground"> {/* Increased space-y and use text-foreground */}
      {recommendations.map((rec, index) => (
        <li key={index} className="flex items-start gap-2 animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}> {/* Added flex and animation */}
          <span className="text-primary">•</span> {/* Use text-primary for bullet */}
          <span>{rec}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Analytics() {
  return (
    <div className="min-h-screen flex flex-col bg-background"> {/* Use bg-background */}
      <Navbar userType="recruiter" />
      <main className="flex-1 p-4">
        <div className="bg-accent p-6 rounded-lg mb-8"> {/* Use bg-accent and rounded-lg */}
          <h1 className="text-3xl font-bold text-center uppercase text-foreground">AI ANALYTICS</h1> {/* Use text-foreground */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card"> {/* Use card class */}
            <h2 className="text-foreground font-bold mb-4">Application Statistics</h2> {/* Use text-foreground */}
            <ApplicationStatisticsChart />
          </div>

          <div className="card"> {/* Use card class */}
            <h2 className="text-foreground font-bold mb-4">Candidate Demographics</h2> {/* Use text-foreground */}
            <CandidateDemographicsChart />
          </div>

          <div className="card"> {/* Use card class */}
            <h2 className="text-foreground font-bold mb-4">Job Performance</h2> {/* Use text-foreground */}
            <JobPerformance />
          </div>

          <div className="card"> {/* Use card class */}
            <h2 className="text-foreground font-bold mb-4">AI Recommendations</h2> {/* Use text-foreground */}
            <AIRecommendations />
          </div>
        </div>
      </main>
    </div>
  );
}
