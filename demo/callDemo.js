let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let currentAudio = null;

// API Configuration
const API_CONFIG = {
	openai: {
		apiKey: "your-openai-api-key", // Replace with your OpenAI API key
		endpoint: "https://api.openai.com/v1/audio/transcriptions",
	},
	gemini: {
		apiKey: "AIzaSyAFBgIMQ4HlIKXgLLWFhXNCoKkbeEZychY",
		endpoint:
			"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent",
	},
	googleTTS: {
		apiKey: "your-google-tts-api-key", // Replace with your Google Cloud TTS API key
		endpoint: "https://texttospeech.googleapis.com/v1/text:synthesize",
	},
};

// File upload handler with actual STT
async function handleFileUpload(input) {
	const file = input.files[0];
	if (file) {
		const originalText = document.getElementById("originalText");
		originalText.innerHTML = `<div class="loading"></div> Processing audio file: ${file.name}...`;

		try {
			const transcribedText = await transcribeAudio(file);
			originalText.textContent = transcribedText;
			document.getElementById("translateBtn").style.display = "flex";
		} catch (error) {
			console.error("STT Error:", error);
			originalText.textContent =
				"Error processing audio file. Please try again.";
		}
	}
}

// OpenAI Whisper STT API call
async function transcribeAudio(audioFile) {
	const formData = new FormData();
	formData.append("file", audioFile);
	formData.append("model", "whisper-1");
	formData.append("language", "auto"); // Auto-detect language

	const response = await fetch(API_CONFIG.openai.endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${API_CONFIG.openai.apiKey}`,
		},
		body: formData,
	});

	if (!response.ok) {
		throw new Error(`STT API error: ${response.status}`);
	}

	const result = await response.json();
	return result.text;
}

// Recording functionality
function toggleRecording() {
	if (!isRecording) {
		startRecording();
	} else {
		stopRecording();
	}
}

async function startRecording() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: true,
		});
		mediaRecorder = new MediaRecorder(stream);
		recordedChunks = [];

		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				recordedChunks.push(event.data);
			}
		};

		mediaRecorder.onstop = () => {
			const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });
			processRecordedAudio(audioBlob);
		};

		mediaRecorder.start();
		isRecording = true;

		const recordBtn = document.getElementById("recordBtn");
		const recordIcon = document.getElementById("recordIcon");
		const recordText = document.getElementById("recordText");

		recordBtn.classList.add("recording");
		recordIcon.textContent = "⏹️";
		recordText.textContent = "Stop Recording";

		document.getElementById("originalText").innerHTML =
			'<div class="loading"></div> Recording in progress...';
	} catch (error) {
		console.error("Error accessing microphone:", error);
		alert("Unable to access microphone. Please check permissions.");
	}
}

function stopRecording() {
	if (mediaRecorder && isRecording) {
		mediaRecorder.stop();
		mediaRecorder.stream.getTracks().forEach((track) => track.stop());
		isRecording = false;

		const recordBtn = document.getElementById("recordBtn");
		const recordIcon = document.getElementById("recordIcon");
		const recordText = document.getElementById("recordText");

		recordBtn.classList.remove("recording");
		recordIcon.textContent = "🎤";
		recordText.textContent = "Start Recording";
	}
}

async function processRecordedAudio(audioBlob) {
	const originalText = document.getElementById("originalText");
	originalText.innerHTML =
		'<div class="loading"></div> Processing recorded audio...';

	try {
		// Convert blob to file for API
		const audioFile = new File([audioBlob], "recording.wav", {
			type: "audio/wav",
		});
		const transcribedText = await transcribeAudio(audioFile);
		originalText.textContent = transcribedText;
		document.getElementById("translateBtn").style.display = "flex";
	} catch (error) {
		console.error("STT Error:", error);
		originalText.textContent =
			"Error processing recorded audio. Please try again.";
	}
}

// Translation with Gemini Flash 2.5
async function translateText() {
	const originalText = document.getElementById("originalText").textContent;
	const targetLang = document.getElementById("targetLanguage").value;
	const targetLanguageName =
		document.getElementById("targetLanguage").selectedOptions[0]
			.textContent;
	const translatedTextDiv = document.getElementById("translatedText");

	if (
		originalText.includes("will appear here") ||
		originalText.includes("Processing") ||
		originalText.includes("Recording") ||
		originalText.includes("Error")
	) {
		alert("Please record or upload audio first!");
		return;
	}

	translatedTextDiv.innerHTML = '<div class="loading"></div> Translating...';

	try {
		const translatedText = await translateWithGemini(
			originalText,
			targetLanguageName
		);
		translatedTextDiv.textContent = translatedText;
		document.getElementById("playBtn").style.display = "flex";
	} catch (error) {
		console.error("Translation Error:", error);
		translatedTextDiv.textContent =
			"Error translating text. Please try again.";
	}
}

// Gemini Flash 2.5 Translation API call
async function translateWithGemini(text, targetLanguage) {
	const prompt = `Translate the following text to ${targetLanguage}. Only return the translated text, no additional commentary or explanation:\n\n"${text}"`;

	const requestBody = {
		contents: [
			{
				parts: [
					{
						text: prompt,
					},
				],
			},
		],
		generationConfig: {
			temperature: 0.1,
			topK: 1,
			topP: 1,
			maxOutputTokens: 2048,
		},
	};

	const response = await fetch(
		`${API_CONFIG.gemini.endpoint}?key=${API_CONFIG.gemini.apiKey}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		}
	);

	if (!response.ok) {
		throw new Error(`Translation API error: ${response.status}`);
	}

	const result = await response.json();
	return result.candidates[0].content.parts[0].text.trim();
}

// Google Text-to-Speech functionality
async function playTranslation() {
	const translatedText =
		document.getElementById("translatedText").textContent;
	const targetLang = document.getElementById("targetLanguage").value;
	const playBtn = document.getElementById("playBtn");

	if (
		translatedText.includes("will appear here") ||
		translatedText.includes("Translating") ||
		translatedText.includes("Error")
	) {
		alert("Please translate the text first!");
		return;
	}

	// Update button to show loading state
	const originalContent = playBtn.innerHTML;
	playBtn.innerHTML = '<div class="loading"></div> Generating Audio...';
	playBtn.disabled = true;

	try {
		const audioBlob = await generateTTSAudio(translatedText, targetLang);

		// Create audio element and play
		if (currentAudio) {
			currentAudio.pause();
		}

		const audioUrl = URL.createObjectURL(audioBlob);
		currentAudio = new Audio(audioUrl);

		currentAudio.onended = () => {
			URL.revokeObjectURL(audioUrl);
		};

		await currentAudio.play();
	} catch (error) {
		console.error("TTS Error:", error);
		alert("Error generating audio. Please try again.");
	} finally {
		// Restore button
		playBtn.innerHTML = originalContent;
		playBtn.disabled = false;
	}
}

// Google Cloud TTS API call
async function generateTTSAudio(text, languageCode) {
	// Map language codes to Google TTS voice names
	const voiceMap = {
		en: { languageCode: "en-US", name: "en-US-Journey-D" },
		hi: { languageCode: "hi-IN", name: "hi-IN-Wavenet-A" },
		es: { languageCode: "es-ES", name: "es-ES-Wavenet-B" },
		fr: { languageCode: "fr-FR", name: "fr-FR-Wavenet-A" },
		de: { languageCode: "de-DE", name: "de-DE-Wavenet-A" },
		zh: { languageCode: "zh-CN", name: "zh-CN-Wavenet-A" },
		ja: { languageCode: "ja-JP", name: "ja-JP-Wavenet-A" },
		pt: { languageCode: "pt-BR", name: "pt-BR-Wavenet-A" },
		ru: { languageCode: "ru-RU", name: "ru-RU-Wavenet-A" },
		it: { languageCode: "it-IT", name: "it-IT-Wavenet-A" },
	};

	const voice = voiceMap[languageCode] || voiceMap["en"];

	const requestBody = {
		input: { text: text },
		voice: {
			languageCode: voice.languageCode,
			name: voice.name,
		},
		audioConfig: {
			audioEncoding: "MP3",
			speakingRate: 1.0,
			pitch: 0.0,
		},
	};

	const response = await fetch(
		`${API_CONFIG.googleTTS.endpoint}?key=${API_CONFIG.googleTTS.apiKey}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		}
	);

	if (!response.ok) {
		throw new Error(`TTS API error: ${response.status}`);
	}

	const result = await response.json();

	// Convert base64 audio to blob
	const audioBytes = atob(result.audioContent);
	const audioArray = new Uint8Array(audioBytes.length);
	for (let i = 0; i < audioBytes.length; i++) {
		audioArray[i] = audioBytes.charCodeAt(i);
	}

	return new Blob([audioArray], { type: "audio/mpeg" });
}

// Utility functions
function clearAll() {
	document.getElementById("originalText").textContent =
		"Your spoken words will appear here...";
	document.getElementById("translatedText").textContent =
		"Translation will appear here...";
	document.getElementById("fileInput").value = "";
	document.getElementById("translateBtn").style.display = "none";
	document.getElementById("playBtn").style.display = "none";

	if (currentAudio) {
		currentAudio.pause();
		currentAudio = null;
	}

	if (isRecording) {
		stopRecording();
	}
}

function downloadTranscript() {
	const originalText = document.getElementById("originalText").textContent;
	const translatedText =
		document.getElementById("translatedText").textContent;
	const targetLang =
		document.getElementById("targetLanguage").selectedOptions[0]
			.textContent;

	if (originalText.includes("will appear here")) {
		alert("Nothing to download. Please record or upload audio first!");
		return;
	}

	const content = `Vocular Translation Transcript\n\nOriginal Text:\n${originalText}\n\nTranslated Text (${targetLang}):\n${translatedText}\n\nGenerated on: ${new Date().toLocaleString()}`;

	const blob = new Blob([content], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "vocular-transcript.txt";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// Initialize
document.addEventListener("DOMContentLoaded", function () {
	console.log("Vocular Translation Platform loaded");

	// Check if API keys are configured
	if (API_CONFIG.openai.apiKey === "your-openai-api-key") {
		console.warn("Please configure your API keys in the API_CONFIG object");
	}
});
