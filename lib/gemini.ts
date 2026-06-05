export class QuotaExceededError extends Error {
  constructor(message = "Gemini quota exceeded.") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function getMimeType(base64Image: string) {
  const match = base64Image.match(/^data:(.+);base64,(.+)$/);

  if (!match) {
    return {
      data: base64Image,
      mimeType: "image/jpeg",
    };
  }

  return {
    data: match[2],
    mimeType: match[1],
  };
}

export async function extractPlaceFromImage(base64Image: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const { data, mimeType } = getMimeType(base64Image);
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extract the name and location of the place shown in this image. Return only: name, city, country. Nothing else.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (response.status === 429) {
    throw new QuotaExceededError();
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Gemini request failed.");
  }

  const payload = (await response.json()) as GeminiResponse;
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text?.trim() ?? "")
    .join(" ")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text.replace(/^```[\w-]*\s*|\s*```$/g, "").trim();
}
