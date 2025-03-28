/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var noteElem, detectedNoteElem;

// Variables for note stability detection
var noteBuffer = [];
var noteBufferSize = 16; // Number of samples to check for stability
var requiredStability = 16; // Number of matching samples needed for stability
var lastEmittedNote = null;
var lastDetectionTime = 0;
var detectionDebounceTime = 220; // Minimum time between note detections in ms
var noteStartTime = 0; // When the current note started
var isCurrentlyPlaying = false; // Whether a note is currently being played
var longNoteThreshold = 400; // Time in ms to consider a note as "long"
var silenceThreshold = 100; // Time in ms of silence to consider a note as ended
var lastSilenceTime = 0; // Last time we detected silence

// Helper function to check note stability
function checkNoteStability(note) {
  if (!note) return false;

  // Add new note to buffer
  noteBuffer.push(note);
  // Keep buffer at fixed size
  if (noteBuffer.length > noteBufferSize) {
    noteBuffer.shift();
  }

  // Count occurrences of the current note in the buffer
  const occurrences = noteBuffer.filter((n) => n === note).length;

  // Check if we have enough stable readings
  return occurrences >= requiredStability;
}

window.onload = function () {
  audioContext = new AudioContext();
  MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000)); // corresponds to a 5kHz signal

  // Update Macleod config with actual sample rate
  macleodConfig.sampleRate = audioContext.sampleRate;
  // Initialize Macleod detector
  macleodDetector = Macleod(macleodConfig);

  noteElem = document.getElementById("note");
  detectedNoteElem = document.getElementById("detected-note");
};

function startPitchDetect() {
  // grab an audio context
  audioContext = new AudioContext();

  // Attempt to get audio input
  navigator.mediaDevices
    .getUserMedia({
      audio: {
        mandatory: {
          googEchoCancellation: "false",
          googAutoGainControl: "false",
          googNoiseSuppression: "false",
          googHighpassFilter: "false",
        },
        optional: [],
      },
    })
    .then((stream) => {
      // Create an AudioNode from the stream.
      mediaStreamSource = audioContext.createMediaStreamSource(stream);

      // Connect it to the destination.
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      mediaStreamSource.connect(analyser);
      updatePitch();
    })
    .catch((err) => {
      // always check for errors at the end.
      console.error(`${err.name}: ${err.message}`);
      alert("Stream generation failed.");
    });
}

function toggleOscillator() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
    return "play oscillator";
  }
  sourceNode = audioContext.createOscillator();

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  sourceNode.start(0);
  isPlaying = true;
  isLiveInput = false;
  updatePitch();

  return "stop";
}

function toggleLiveInput() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
  }
  getUserMedia(
    {
      audio: {
        mandatory: {
          googEchoCancellation: "false",
          googAutoGainControl: "false",
          googNoiseSuppression: "false",
          googHighpassFilter: "false",
        },
        optional: [],
      },
    },
    gotStream
  );
}

function togglePlayback() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
    return "start";
  }

  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = theBuffer;
  sourceNode.loop = true;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  sourceNode.start(0);
  isPlaying = true;
  isLiveInput = false;
  updatePitch();

  return "stop";
}

var rafID = null;
var tracks = null;
var buflen = 2048;
var buf = new Float32Array(buflen);

// Macleod pitch detector configuration
const macleodConfig = {
  bufferSize: buflen,
  cutoff: 0.97,
  sampleRate: 44100, // Will be updated with actual sample rate
};

// Initialize Macleod detector
let macleodDetector = null;

var noteStrings = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function noteFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
  return Math.floor(
    (1200 * Math.log(frequency / frequencyFromNoteNumber(note))) / Math.log(2)
  );
}

// Macleod pitch detection algorithm implementation
function Macleod(params = {}) {
  const config = {
    bufferSize: 2048,
    cutoff: 0.97,
    sampleRate: 44100,
    ...params,
  };

  const { bufferSize, cutoff, sampleRate } = config;
  const SMALL_CUTOFF = 0.5;
  const LOWER_PITCH_CUTOFF = 80;
  const nsdf = new Float32Array(bufferSize);
  const squaredBufferSum = new Float32Array(bufferSize);
  let turningPointX, turningPointY;
  let maxPositions = [];
  let periodEstimates = [];
  let ampEstimates = [];

  function normalizedSquareDifference(float32AudioBuffer) {
    squaredBufferSum[0] = float32AudioBuffer[0] * float32AudioBuffer[0];
    for (let i = 1; i < float32AudioBuffer.length; i++) {
      squaredBufferSum[i] =
        float32AudioBuffer[i] * float32AudioBuffer[i] + squaredBufferSum[i - 1];
    }
    for (let tau = 0; tau < float32AudioBuffer.length; tau++) {
      let acf = 0;
      const divisorM =
        squaredBufferSum[float32AudioBuffer.length - 1 - tau] +
        squaredBufferSum[float32AudioBuffer.length - 1] -
        squaredBufferSum[tau];
      for (let i = 0; i < float32AudioBuffer.length - tau; i++) {
        acf += float32AudioBuffer[i] * float32AudioBuffer[i + tau];
      }
      nsdf[tau] = (2 * acf) / divisorM;
    }
  }

  function parabolicInterpolation(tau) {
    const nsdfa = nsdf[tau - 1],
      nsdfb = nsdf[tau],
      nsdfc = nsdf[tau + 1],
      bValue = tau,
      bottom = nsdfc + nsdfa - 2 * nsdfb;
    if (bottom === 0) {
      turningPointX = bValue;
      turningPointY = nsdfb;
    } else {
      const delta = nsdfa - nsdfc;
      turningPointX = bValue + delta / (2 * bottom);
      turningPointY = nsdfb - (delta * delta) / (8 * bottom);
    }
  }

  function peakPicking() {
    let pos = 0;
    let curMaxPos = 0;

    while (pos < (nsdf.length - 1) / 3 && nsdf[pos] > 0) pos++;
    while (pos < nsdf.length - 1 && nsdf[pos] <= 0) pos++;
    if (pos === 0) pos = 1;

    while (pos < nsdf.length - 1) {
      if (nsdf[pos] > nsdf[pos - 1] && nsdf[pos] >= nsdf[pos + 1]) {
        if (curMaxPos === 0 || nsdf[pos] > nsdf[curMaxPos]) {
          curMaxPos = pos;
        }
      }
      pos++;
      if (pos < nsdf.length - 1 && nsdf[pos] <= 0) {
        if (curMaxPos > 0) {
          maxPositions.push(curMaxPos);
          curMaxPos = 0;
        }
        while (pos < nsdf.length - 1 && nsdf[pos] <= 0) pos++;
      }
    }
    if (curMaxPos > 0) maxPositions.push(curMaxPos);
  }

  return function detector(float32AudioBuffer) {
    maxPositions = [];
    periodEstimates = [];
    ampEstimates = [];

    normalizedSquareDifference(float32AudioBuffer);
    peakPicking();

    let highestAmplitude = -Infinity;
    let pitch = -1;

    for (let i = 0; i < maxPositions.length; i++) {
      const tau = maxPositions[i];
      highestAmplitude = Math.max(highestAmplitude, nsdf[tau]);

      if (nsdf[tau] > SMALL_CUTOFF) {
        parabolicInterpolation(tau);
        ampEstimates.push(turningPointY);
        periodEstimates.push(turningPointX);
        highestAmplitude = Math.max(highestAmplitude, turningPointY);
      }
    }

    if (periodEstimates.length) {
      const actualCutoff = cutoff * highestAmplitude;
      let periodIndex = 0;

      for (let i = 0; i < ampEstimates.length; i++) {
        if (ampEstimates[i] >= actualCutoff) {
          periodIndex = i;
          break;
        }
      }

      const period = periodEstimates[periodIndex];
      const pitchEstimate = sampleRate / period;

      if (pitchEstimate > LOWER_PITCH_CUTOFF) {
        pitch = pitchEstimate;
      }
    }

    return {
      probability: highestAmplitude,
      freq: pitch,
    };
  };
}

// Wrapper function to maintain compatibility with existing code
function autoCorrelate(buf, sampleRate) {
  if (!macleodDetector) {
    macleodConfig.sampleRate = sampleRate;
    macleodDetector = Macleod(macleodConfig);
  }

  const result = macleodDetector(buf);
  return result.freq;
}

function updatePitch(time) {
  var cycles = new Array();
  analyser.getFloatTimeDomainData(buf);

  // Calculate RMS volume
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    sum += buf[i] * buf[i];
  }
  const rms = Math.sqrt(sum / buf.length);
  const now = Date.now();

  // Check for silence
  if (rms < 0.03) {
    detectedNoteElem.innerText = "-";
    if (isCurrentlyPlaying) {
      // If we've been silent for long enough, consider the note as ended
      if (now - lastSilenceTime >= silenceThreshold) {
        isCurrentlyPlaying = false;
        noteStartTime = 0;
      } else if (lastSilenceTime === 0) {
        lastSilenceTime = now;
      }
    }
    rafID = window.requestAnimationFrame(updatePitch);
    return;
  }

  // Reset silence timer if we detect sound
  lastSilenceTime = 0;

  var ac = autoCorrelate(buf, audioContext.sampleRate);

  if (ac == -1) {
    detectedNoteElem.innerText = "-";
  } else {
    pitch = ac;
    var note = noteFromPitch(pitch);
    const detectedNote = noteStrings[note % 12];
    detectedNoteElem.innerHTML = detectedNote;

    // Check note stability
    if (checkNoteStability(detectedNote)) {
      if (!isCurrentlyPlaying) {
        // Start of a new note
        noteStartTime = now;
        isCurrentlyPlaying = true;
        emitNoteDetected(detectedNote, false);
      } else if (
        detectedNote !== lastEmittedNote &&
        now - noteStartTime >= longNoteThreshold
      ) {
        // This is a long note that changed to a different note
        noteStartTime = now;
        emitNoteDetected(detectedNote, true);
      }
      lastEmittedNote = detectedNote;
      lastDetectionTime = now;
    }
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = window.webkitRequestAnimationFrame;
  rafID = window.requestAnimationFrame(updatePitch);
}

// Helper function to emit note detected events
function emitNoteDetected(note, isLongNote) {
  // Clear buffer after emitting
  noteBuffer = [];

  // Dispatch noteDetected event with additional info
  const noteDetectedEvent = new CustomEvent("noteDetected", {
    detail: {
      note: note,
      isLongNote: isLongNote,
    },
  });
  document.dispatchEvent(noteDetectedEvent);
}
