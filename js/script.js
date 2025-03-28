// Helper function to normalize notes to a standard form for comparison
function normalizeNote(note) {
  // Define preferred forms for enharmonic groups
  const preferredForm = {
    // For circular references, we choose one canonical form
    "C#": "Db", // Prefer flats
    "D#": "Eb",
    "F#": "Gb",
    "G#": "Ab",
    "A#": "Bb",
    "B#": "C", // Prefer natural
    "E#": "F",
    Cb: "B", // Prefer natural
    Fb: "E",
    // Add mappings for all possible input forms
    Db: "Db",
    Eb: "Eb",
    Gb: "Gb",
    Ab: "Ab",
    Bb: "Bb",
    C: "C",
    F: "F",
    B: "B",
    E: "E",
    // Add remaining natural notes
    D: "D",
    G: "G",
    A: "A",
  };

  // First remove any numbers (octave indicators)
  note = note.replace(/[0-9]/g, "");

  // Return the preferred form of this note
  return preferredForm[note] || note;
}

document.addEventListener("DOMContentLoaded", () => {
  let lastNoteUpdateTime = 0;
  let lastDetectedNote = null;
  const gracePeriod = 400; // ms to wait before playing incorrect sounds after a note update

  document.addEventListener("noteDetected", (e) => {
    const detectedNote = e.detail.note;
    const isLongNote = e.detail.isLongNote;
    const now = Date.now();

    // Compare with current displayed note using normalized forms
    const normalizedDetected = normalizeNote(detectedNote);
    const normalizedDisplayed = normalizeNote(currentNote);

    if (normalizedDetected === normalizedDisplayed) {
      audioFeedback.playCorrect();
      // Only move to next note in practice mode if it's not a long note
      if (practiceMode && !isLongNote) {
        const now = Date.now();
        if (!window.correctNoteTimes) {
          window.correctNoteTimes = [];
        }

        if (window.correctNoteTimes.length > 0) {
          // Calculate time difference with last note
          const timeDiff =
            now - window.correctNoteTimes[window.correctNoteTimes.length - 1];
          const instantBpm = Math.round(60000 / timeDiff);

          // Only update if the BPM is reasonable (between 10 and 240)
          if (instantBpm >= 10 && instantBpm <= 240) {
            window.correctNoteTimes.push(now);
            // Keep only the last 6 timestamps
            if (window.correctNoteTimes.length > 6) {
              window.correctNoteTimes.shift();
            }

            // Calculate average BPM from all intervals if we have enough notes
            if (window.correctNoteTimes.length >= 6) {
              let totalBpm = 0;
              for (let i = 1; i < window.correctNoteTimes.length; i++) {
                const interval =
                  window.correctNoteTimes[i] - window.correctNoteTimes[i - 1];
                totalBpm += 60000 / interval;
              }
              const averageBpm = Math.round(
                totalBpm / (window.correctNoteTimes.length - 1)
              );
              tempoValue.textContent = averageBpm;
            }
          } else {
            // Reset if timing is unreasonable
            window.correctNoteTimes = [];
            tempoValue.textContent = "--";
          }
        } else {
          window.correctNoteTimes.push(now);
        }
        // In practice mode, move to next note when correct note is detected
        updateNote();
      }
    } else {
      // Play incorrect sound if:
      // 1. We're outside the grace period, OR
      // 2. We're inside the grace period but detected a different note than before
      if (now - lastNoteUpdateTime > gracePeriod || 
          (lastDetectedNote !== null && normalizedDetected !== normalizeNote(lastDetectedNote))) {
        audioFeedback.playIncorrect();
      }
      lastDetectedNote = detectedNote;
    }
  });

  // Get DOM elements
  const noteElement = document.getElementById("note");
  const tempoSlider = document.getElementById("tempo");
  const tempoValue = document.getElementById("tempo-value");
  const selectAllBtn = document.getElementById("select-all");
  const deselectAllBtn = document.getElementById("deselect-all");
  const startListeningBtn = document.getElementById("start-listening");
  const stopListeningBtn = document.getElementById("stop-listening");

  // American notation musical notes (C through B)
  const musicalNotes = ["C", "D", "E", "F", "G", "A", "B"];

  // Accidentals (natural, sharp, flat)
  const accidentalSymbols = { natural: "", sharp: "#", flat: "b" };

  // Store the current note to avoid repetition
  let currentNote = "";

  // Store the interval ID for the metronome
  let metronomeInterval = null;
  let tempo = 60; // Default tempo (60 BPM = 1 second)
  let practiceMode = false; // Practice mode flag
  let lastCorrectNoteTime = 0; // Track timing for BPM calculation
  let correctNoteCount = 0; // Count consecutive correct notes
  const bpmWindow = 5; // Number of correct notes to calculate average BPM

  // Initialize local storage for settings or use defaults
  function initializeSettings() {
    try {
      const savedSettings = localStorage.getItem("notamizerSettings");
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        tempo = settings.tempo || 60;
        tempoSlider.value = tempo;
        practiceMode = settings.practiceMode || false;
        document.getElementById("practice-mode").checked = practiceMode;
        // Set initial tempo control visibility and display
        document
          .querySelector(".tempo-control")
          .classList.toggle("hidden", practiceMode);
        tempoValue.textContent = practiceMode ? "--" : tempo;

        // Apply saved checkbox states if available
        if (settings.noteSelections) {
          for (const noteKey in settings.noteSelections) {
            const checkbox = document.getElementById(noteKey);
            if (checkbox) {
              checkbox.checked = settings.noteSelections[noteKey];
            }
          }
        }
      }
    } catch (e) {
      console.error("Error loading settings:", e);
      // If there's an error, we'll just use the defaults
    }
  }

  // Save settings to local storage
  function saveSettings() {
    const settings = {
      tempo: tempo,
      practiceMode: practiceMode,
      noteSelections: {},
    };

    // Save all checkbox states
    musicalNotes.forEach((note) => {
      ["natural", "sharp", "flat"].forEach((accidental) => {
        const checkboxId = `${note}-${accidental}`;
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          settings.noteSelections[checkboxId] = checkbox.checked;
        }
      });
    });

    localStorage.setItem("notamizerSettings", JSON.stringify(settings));
  }

  // Get all selected notes based on checkbox selections
  function getSelectedNotes() {
    const selectedNotes = [];

    musicalNotes.forEach((note) => {
      ["natural", "sharp", "flat"].forEach((accidental) => {
        const checkboxId = `${note}-${accidental}`;
        const checkbox = document.getElementById(checkboxId);

        if (checkbox && checkbox.checked) {
          selectedNotes.push(note + accidentalSymbols[accidental]);
        }
      });
    });

    return selectedNotes;
  }

  // Object to track how many times each note has been shown
  let noteFrequencies = {};

  // Function to reset note frequencies when selection changes
  function resetNoteFrequencies() {
    noteFrequencies = {};
    const selectedNotes = getSelectedNotes();
    selectedNotes.forEach(note => {
      noteFrequencies[note] = 0;
    });
  }

  // Function to generate a random note that's different from the current one
  function getRandomNote() {
    const selectedNotes = getSelectedNotes();

    // If no notes are selected, return a message
    if (selectedNotes.length === 0) {
      return "Select notes";
    }

    // If only one note is selected, return it
    if (selectedNotes.length === 1) {
      return selectedNotes[0];
    }

    // Initialize frequencies if needed
    if (Object.keys(noteFrequencies).length === 0) {
      resetNoteFrequencies();
    }

    // Check if we need to reset frequencies (if selection changed)
    const currentNotes = Object.keys(noteFrequencies);
    if (currentNotes.length !== selectedNotes.length || 
        !selectedNotes.every(note => currentNotes.includes(note))) {
      resetNoteFrequencies();
    }

    // Calculate weights based on inverse frequency
    const maxFreq = Math.max(...Object.values(noteFrequencies));
    const weights = selectedNotes.map(note => {
      const freq = noteFrequencies[note];
      // Add 1 to avoid division by zero and ensure some chance for all notes
      return maxFreq - freq + 1;
    });

    // Calculate total weight
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    // Get a random value between 0 and total weight
    let random = Math.random() * totalWeight;
    let newNote;

    // Select note based on weights
    for (let i = 0; i < selectedNotes.length; i++) {
      if (random <= weights[i]) {
        newNote = selectedNotes[i];
        break;
      }
      random -= weights[i];
    }

    // If no note was selected or it's the same as current (and we have options)
    if (!newNote || (newNote === currentNote && selectedNotes.length > 1)) {
      // Try again with the least shown note that's different from current
      const sortedNotes = selectedNotes
        .filter(note => note !== currentNote)
        .sort((a, b) => noteFrequencies[a] - noteFrequencies[b]);
      newNote = sortedNotes[0] || selectedNotes[0];
    }

    // Update frequency for the selected note
    noteFrequencies[newNote]++;

    return newNote;
  }

  // Function to update the displayed note
  function updateNote() {
    // Add animation class
    noteElement.classList.add("note-change");

    // Update the last note update time
    lastNoteUpdateTime = Date.now();

    // Generate a new random note
    const newNote = getRandomNote();
    currentNote = newNote; // Store the new note

    // Update the note text
    setTimeout(() => {
      noteElement.textContent = newNote;
      // Remove animation class
      noteElement.classList.remove("note-change");
    }, 150);
  }

  // Start the metronome with the current tempo
  function startMetronome() {
    // Clear any existing interval
    if (metronomeInterval) {
      clearInterval(metronomeInterval);
    }

    if (!practiceMode) {
      // In normal mode, use interval-based updates
      const intervalMs = Math.round(60000 / tempo);
      metronomeInterval = setInterval(updateNote, intervalMs);
    } else {
      // In practice mode, just show the first note
      updateNote();
    }
  }

  // Event listener for practice mode toggle
  document.getElementById("practice-mode").addEventListener("change", (e) => {
    practiceMode = e.target.checked;
    // Toggle tempo control visibility
    document
      .querySelector(".tempo-control")
      .classList.toggle("hidden", practiceMode);
    // Reset BPM tracking when entering practice mode
    if (practiceMode) {
      tempoValue.textContent = "--";
      window.correctNoteTimes = [];
      // Start pitch detection if not already started
      if (!isPlaying) {
        startPitchDetect();
        startListeningBtn.disabled = true;
        stopListeningBtn.disabled = false;
        isPlaying = true;
      }
    } else {
      tempoValue.textContent = tempo;
      // Stop pitch detection if it was started by practice mode
      if (isPlaying) {
        if (mediaStreamSource) {
          mediaStreamSource.disconnect();
        }
        if (analyser) {
          analyser.disconnect();
        }
        if (!window.cancelAnimationFrame) {
          window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        }
        window.cancelAnimationFrame(rafID);
        audioContext = null;
        isPlaying = false;
        startListeningBtn.disabled = false;
        stopListeningBtn.disabled = true;
      }
    }
    startMetronome();
    saveSettings();
  });

  // Event listener for tempo slider
  tempoSlider.addEventListener("input", (e) => {
    if (!practiceMode) {
      tempo = parseInt(e.target.value);
      tempoValue.textContent = tempo;
      startMetronome();
      saveSettings();
    }
  });

  // Function to toggle all checkboxes in a row (for a specific note)
  function toggleNoteRow(note) {
    // First, determine if we should check or uncheck based on current state
    // If any checkbox in the row is unchecked, we'll check all of them
    // Otherwise, we'll uncheck all of them
    const checkboxes = document.querySelectorAll(`input[data-note="${note}"]`);
    let shouldCheck = false;

    // Check if any checkbox is unchecked
    checkboxes.forEach((checkbox) => {
      if (!checkbox.checked) {
        shouldCheck = true;
      }
    });

    // Set all checkboxes in the row to the determined state
    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheck;
    });

    saveSettings();
  }

  // Function to toggle all checkboxes in a column (for a specific accidental type)
  function toggleAccidentalColumn(accidentalType) {
    // First, determine if we should check or uncheck based on current state
    // If any checkbox in the column is unchecked, we'll check all of them
    // Otherwise, we'll uncheck all of them
    const checkboxes = document.querySelectorAll(
      `input[data-type="${accidentalType}"]`
    );
    let shouldCheck = false;

    // Check if any checkbox is unchecked
    checkboxes.forEach((checkbox) => {
      if (!checkbox.checked) {
        shouldCheck = true;
      }
    });

    // Set all checkboxes in the column to the determined state
    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheck;
    });

    saveSettings();
  }

  // Event listeners for note selection checkboxes
  musicalNotes.forEach((note) => {
    ["natural", "sharp", "flat"].forEach((accidental) => {
      const checkboxId = `${note}-${accidental}`;
      const checkbox = document.getElementById(checkboxId);

      if (checkbox) {
        checkbox.addEventListener("change", () => {
          saveSettings();
        });
      }
    });
  });

  // Event listeners for row toggling (note names)
  document.querySelectorAll(".toggle-row").forEach((element) => {
    element.addEventListener("click", () => {
      const note = element.getAttribute("data-note");
      toggleNoteRow(note);
    });
  });

  // Event listeners for column toggling (accidental types)
  document.querySelectorAll(".toggle-column").forEach((element) => {
    element.addEventListener("click", () => {
      const accidentalType = element.getAttribute("data-column");
      toggleAccidentalColumn(accidentalType);
    });
  });

  // Select All button
  selectAllBtn.addEventListener("click", () => {
    musicalNotes.forEach((note) => {
      ["natural", "sharp", "flat"].forEach((accidental) => {
        const checkbox = document.getElementById(`${note}-${accidental}`);
        if (checkbox) checkbox.checked = true;
      });
    });
    saveSettings();
  });

  // Deselect All button
  deselectAllBtn.addEventListener("click", () => {
    musicalNotes.forEach((note) => {
      ["natural", "sharp", "flat"].forEach((accidental) => {
        const checkbox = document.getElementById(`${note}-${accidental}`);
        if (checkbox) checkbox.checked = false;
      });
    });
    saveSettings();
  });

  // Initialize settings from local storage
  initializeSettings();

  // Initial note update
  updateNote();

  // Start the metronome
  startMetronome();

  // Setup pitch detection controls
  startListeningBtn.addEventListener("click", () => {
    startPitchDetect();
    startListeningBtn.disabled = true;
    stopListeningBtn.disabled = false;
  });

  stopListeningBtn.addEventListener("click", () => {
    if (mediaStreamSource) {
      mediaStreamSource.disconnect();
      mediaStreamSource = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
    if (rafID) {
      cancelAnimationFrame(rafID);
      rafID = null;
    }
    startListeningBtn.disabled = false;
    stopListeningBtn.disabled = true;
  });
});
