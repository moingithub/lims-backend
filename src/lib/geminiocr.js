const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY not found in .env file");
}

const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genai.getGenerativeModel({ model: "gemini-2.5-pro" });

const PROMPT = `
You are an expert OCR engine specialized in handwritten industrial forms.
Instructions:
- Extract text VERY carefully.
- Pay special attention to handwritten words and numbers.
- Do not guess randomly.
- Preserve units exactly except when normalizing specific fields.
- Double check names, numbers, and well IDs.
- Use nearby context to correct unclear handwriting.
- Extract ALL visible fields including company/lab names.
- If uncertain, provide best interpretation.
- If a field is empty, return empty string.
Special field rules:
- Flow_Rate: ignore any MCFD text and return only the numeric flow rate value.
- Pressure: do not include psia or psig in Pressure. Pressure must be numeric only.
- Pressure_Unit: if the original pressure text includes psia or psig, place exactly one of those values here.
- Temperature: do not include F. Return only the numeric temperature value.
Return STRICT JSON only.
Schema:
{
  "Lab_Name": "",
  "Date": "",
  "Customer": "",
  "Area": "",
  "Sampled_By": "",
  "Producer": "",
  "Well_Lease": "",
  "Meter_Number": "",
  "Sample_Type": "",
  "Pressure": "",
  "Pressure_Unit": "",
  "Temperature": "",
  "Flow_Rate": "",
  "Field_H2S": "",
  "Cylinder_Number": "",
  "Remarks": "",
  "Cost_Code": "",
  "Address": "",
  "Phone": ""
}
`;

function normalizeOcrOutput(parsedJson) {
  const normalized = { ...parsedJson };

  const normalizeNumberOnly = (value) => {
    if (typeof value !== "string") {
      return value === undefined || value === null ? "" : String(value).trim();
    }

    let normalizedValue = value.trim();
    normalizedValue = normalizedValue.replace(/[^0-9.+\-]/g, "");
    return normalizedValue;
  };

  const normalizeFlowRate = (value) => {
    if (typeof value !== "string") {
      return value === undefined || value === null ? "" : String(value).trim();
    }
    return value
      .replace(/\bMCFD\b/gi, "")
      .trim()
      .replace(/[^0-9.+\-]/g, "")
      .trim();
  };

  const normalizeTemperature = (value) => {
    if (typeof value !== "string") {
      return value === undefined || value === null ? "" : String(value).trim();
    }
    return value
      .replace(/°?\s*F\b/gi, "")
      .trim()
      .replace(/[^0-9.+\-]/g, "")
      .trim();
  };

  const normalizePressureUnit = (value) => {
    if (typeof value !== "string") {
      return "";
    }
    const lookup = value.toLowerCase();
    if (lookup.includes("psia")) return "psia";
    if (lookup.includes("psig")) return "psig";
    return "";
  };

  const extractPressureUnitFromPressure = (pressureValue) => {
    if (typeof pressureValue !== "string") {
      return "";
    }
    const lookup = pressureValue.toLowerCase();
    if (lookup.includes("psia")) return "psia";
    if (lookup.includes("psig")) return "psig";
    return "";
  };

  if (normalized.Flow_Rate !== undefined) {
    normalized.Flow_Rate = normalizeFlowRate(normalized.Flow_Rate);
  }

  if (normalized.Temperature !== undefined) {
    normalized.Temperature = normalizeTemperature(normalized.Temperature);
  }

  if (normalized.Pressure_Unit !== undefined) {
    normalized.Pressure_Unit = normalizePressureUnit(normalized.Pressure_Unit);
  }

  if (normalized.Pressure !== undefined) {
    const extractedUnit = extractPressureUnitFromPressure(normalized.Pressure);
    if (extractedUnit) {
      normalized.Pressure_Unit = extractedUnit;
    }
    normalized.Pressure = normalizeNumberOnly(normalized.Pressure);
  }

  return normalized;
}

/**
 * Runs Gemini OCR on an image buffer
 * @param {Buffer} fileBuffer - The file buffer from multer (req.file.buffer)
 * @param {string} mimeType - The MIME type of the file (req.file.mimetype)
 * @returns {Promise<Object>} - Parsed JSON object from Gemini
 */
async function runGeminiOcr(fileBuffer, mimeType) {
  const imageBase64 = fileBuffer.toString("base64");

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([PROMPT, imagePart]);
  let rawText = result.response.text().trim();

  // Remove markdown wrappers if present
  rawText = rawText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  // Parse and normalize JSON
  const parsedJson = JSON.parse(rawText);
  return normalizeOcrOutput(parsedJson);
}

module.exports = { runGeminiOcr };
