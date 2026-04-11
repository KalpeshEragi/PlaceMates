import "dotenv/config";
async function getModels() {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` }
  });
  const data = await res.json();
  if (data.data) {
    console.log(data.data.map((m: any) => m.id));
  } else {
    console.log("Error:", data);
  }
}
getModels();
