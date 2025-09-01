export async function fetchDraft(token) {
  try {
    const res = await fetch("http://localhost:5000/api/resume/get-draft", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch draft");
    const { resumeData } = await res.json();
    return resumeData || null;
  } catch (err) {
    console.error("Error fetching draft:", err);
    throw err;
  }
}